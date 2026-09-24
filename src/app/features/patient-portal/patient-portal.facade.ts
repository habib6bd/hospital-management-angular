import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { HttpClient, httpResource } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { APP_CONFIG } from '../../core/config/app-config';
import { AuthService } from '../../core/auth/auth.service';
import { authContext } from '../../core/http/http-context';
import { mapPage, toQueryParams, type Page, type PaginatedDto } from '../../core/http/paginated';
import {
  toDownloadTicket,
  toReportDocument,
  type DownloadTicketDto,
  type ReportDocumentDto,
} from '../../shared/models/lab.dto';
import { toAppointment, type AppointmentDto } from '../../shared/models/appointment.dto';
import { toPatient, type PatientDto } from '../../shared/models/patient.dto';
import type { DownloadTicket, ReportDocument, ReportKind, ReportStatus } from '../../shared/models/lab.model';
import type { Appointment } from '../../shared/models/appointment.model';
import type { Patient } from '../../shared/models/patient.model';
import { todayIso } from '../appointments/appointment.service';

export interface PortalReportQuery {
  readonly page: number;
  readonly pageSize: number;
  readonly search: string;
  readonly kind: ReportKind | '';
  readonly status: ReportStatus | '';
}

/**
 * Aggregates everything the signed-in patient sees: reports, appointments and
 * their own record. Components talk only to this facade, so no portal screen
 * ever has to know which endpoints combine into a view.
 *
 * Security note: every portal endpoint is scoped server-side to the patient the
 * access token belongs to. No patient id is ever sent from the client — the
 * guard and this facade are defence in depth, not the boundary.
 */
@Injectable({ providedIn: 'root' })
export class PatientPortalFacade {
  private readonly http = inject(HttpClient);
  private readonly config = inject(APP_CONFIG);
  private readonly auth = inject(AuthService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly baseUrl = `${this.config.apiBaseUrl}/portal`;

  private readonly queryState = signal<PortalReportQuery>({
    page: 1,
    pageSize: this.config.pageSize,
    search: '',
    kind: '',
    status: '',
  });

  readonly query = this.queryState.asReadonly();

  /** Only fetch once a patient session exists, so no request 401s on startup. */
  private readonly isPatient = computed(() => this.auth.role() === 'patient');

  private readonly reportsResource = httpResource<PaginatedDto<ReportDocumentDto>>(() =>
    this.isPatient()
      ? {
          url: `${this.baseUrl}/reports/`,
          params: toQueryParams({
            page: this.queryState().page,
            page_size: this.queryState().pageSize,
            search: this.queryState().search,
            kind: this.queryState().kind,
            status: this.queryState().status,
          }),
        }
      : undefined,
  );

  readonly reports = computed<Page<ReportDocument> | undefined>(() => {
    const value = this.reportsResource.value();
    if (value === undefined) {
      return undefined;
    }
    const { page, pageSize } = this.queryState();
    return mapPage(value, toReportDocument, page, pageSize);
  });

  readonly isReportsLoading = this.reportsResource.isLoading;
  readonly reportsError = this.reportsResource.error;

  private readonly appointmentsResource = httpResource<PaginatedDto<AppointmentDto>>(() =>
    this.isPatient() ? { url: `${this.baseUrl}/appointments/`, params: { page_size: '100' } } : undefined,
  );

  readonly appointments = computed<readonly Appointment[]>(
    () => this.appointmentsResource.value()?.results.map(toAppointment) ?? [],
  );

  readonly isAppointmentsLoading = this.appointmentsResource.isLoading;

  readonly upcomingAppointments = computed(() => {
    const today = todayIso();
    return this.appointments()
      .filter(
        (appointment) =>
          appointment.date >= today &&
          appointment.status !== 'cancelled' &&
          appointment.status !== 'completed',
      )
      .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`));
  });

  readonly pastAppointments = computed(() => {
    const today = todayIso();
    return this.appointments().filter(
      (appointment) => appointment.date < today || appointment.status === 'completed',
    );
  });

  private readonly profileResource = httpResource<PatientDto>(() =>
    this.isPatient() ? { url: `${this.baseUrl}/profile/` } : undefined,
  );

  readonly profile = computed<Patient | undefined>(() => {
    const value = this.profileResource.value();
    return value === undefined ? undefined : toPatient(value);
  });

  /** Single view model for the portal home, so the page reads one signal. */
  readonly summary = computed(() => {
    const page = this.reports();
    const all = page?.items ?? [];
    return {
      readyCount: all.filter((report) => report.status === 'ready').length,
      pendingCount: all.filter((report) => report.status === 'pending').length,
      totalReports: page?.total ?? 0,
      nextAppointment: this.upcomingAppointments()[0] ?? null,
      upcomingCount: this.upcomingAppointments().length,
      patientName: this.profile()?.fullName ?? this.auth.user()?.fullName ?? '',
    };
  });

  readonly isLoading = computed(
    () => this.isReportsLoading() || this.isAppointmentsLoading() || this.profileResource.isLoading(),
  );

  patchQuery(changes: Partial<PortalReportQuery>): void {
    this.queryState.update((current) => ({ ...current, ...changes, page: changes.page ?? 1 }));
  }

  setPage(page: number): void {
    this.queryState.update((current) => ({ ...current, page }));
  }

  reload(): void {
    this.reportsResource.reload();
  }

  /**
   * Fetches a signed URL at click time rather than rendering one into the DOM
   * ahead of time — an unclicked link would otherwise sit in the page markup
   * with a live signature.
   */
  async requestDownloadUrl(reportId: number): Promise<DownloadTicket> {
    const dto = await firstValueFrom(
      this.http.get<DownloadTicketDto>(`${this.baseUrl}/reports/${reportId}/download-url/`, {
        context: authContext({ skipErrorToast: true }),
      }),
    );
    return toDownloadTicket(dto);
  }

  /**
   * Records the `ReportDownloaded` audit event, then hands the file to the
   * browser. The audit call comes first: a download that was not logged is
   * worse, for compliance, than one logged but not completed.
   */
  async download(report: ReportDocument): Promise<void> {
    const ticket = await this.requestDownloadUrl(report.id);

    await firstValueFrom(
      this.http.post<ReportDocumentDto>(`${this.baseUrl}/reports/${report.id}/downloads/`, {}),
    );
    this.reportsResource.reload();

    if (this.isBrowser) {
      const link = document.createElement('a');
      link.href = ticket.url;
      link.download = ticket.filename;
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
  }
}
