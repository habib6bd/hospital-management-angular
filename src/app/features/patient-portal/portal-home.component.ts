import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PatientPortalFacade } from './patient-portal.facade';
import { CardComponent } from '../../shared/ui/card/card.component';
import { PageHeaderComponent } from '../../shared/ui/page-header/page-header.component';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { BadgeComponent } from '../../shared/ui/badge/badge.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { HmsDatePipe } from '../../shared/pipes/hms-pipes';
import { APPOINTMENT_STATUS_LABELS, appointmentTone } from '../../shared/models/appointment.model';
import { REPORT_STATUS_LABELS, reportTone, type ReportDocument } from '../../shared/models/lab.model';

@Component({
  selector: 'hms-portal-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    CardComponent,
    PageHeaderComponent,
    ButtonComponent,
    BadgeComponent,
    SkeletonComponent,
    EmptyStateComponent,
    HmsDatePipe,
  ],
  template: `
    <hms-page-header
      [heading]="greeting()"
      description="Your reports, appointments and records in one place."
    />

    @if (portal.isLoading() && summary().totalReports === 0) {
      <hms-card><hms-skeleton [lines]="5" [height]="20" label="Loading your summary" /></hms-card>
    } @else {
      <div class="mb-4 grid gap-3 sm:grid-cols-3">
        <div class="rounded-card bg-surface-raised p-4 ring-1 ring-surface-border ring-inset">
          <p class="text-xs text-surface-fg-muted">Reports ready</p>
          <p class="mt-1 text-2xl font-semibold text-status-ready-strong">
            {{ summary().readyCount }}
          </p>
        </div>
        <div class="rounded-card bg-surface-raised p-4 ring-1 ring-surface-border ring-inset">
          <p class="text-xs text-surface-fg-muted">Awaiting release</p>
          <p class="mt-1 text-2xl font-semibold text-status-pending-strong">
            {{ summary().pendingCount }}
          </p>
        </div>
        <div class="rounded-card bg-surface-raised p-4 ring-1 ring-surface-border ring-inset">
          <p class="text-xs text-surface-fg-muted">Upcoming appointments</p>
          <p class="mt-1 text-2xl font-semibold text-surface-fg">{{ summary().upcomingCount }}</p>
        </div>
      </div>

      <div class="grid gap-4 lg:grid-cols-2">
        <hms-card heading="Latest reports" [padded]="false">
          <span card-actions>
            <hms-button variant="ghost" size="sm" routerLink="/patient/reports">View all</hms-button>
          </span>

          @if (latestReports().length === 0) {
            <hms-empty-state
              title="No reports yet"
              description="They appear here as soon as your results are released."
            />
          } @else {
            <ul role="list" class="divide-y divide-surface-border">
              @for (report of latestReports(); track report.id) {
                <li class="flex items-center gap-3 px-5 py-3">
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-sm text-surface-fg">{{ report.title }}</p>
                    <p class="text-xs text-surface-fg-muted">{{ report.issuedAt | hmsDate }}</p>
                  </div>
                  <hms-badge [tone]="reportBadge(report)">{{ reportLabel(report) }}</hms-badge>
                </li>
              }
            </ul>
          }
        </hms-card>

        <hms-card heading="Upcoming appointments" [padded]="false">
          <span card-actions>
            <hms-button variant="ghost" size="sm" routerLink="/patient/appointments">
              View all
            </hms-button>
          </span>

          @if (upcoming().length === 0) {
            <hms-empty-state
              title="Nothing scheduled"
              description="Contact reception to book an appointment."
            />
          } @else {
            <ul role="list" class="divide-y divide-surface-border">
              @for (appointment of upcoming(); track appointment.id) {
                <li class="flex items-center gap-3 px-5 py-3">
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-sm text-surface-fg">{{ appointment.doctorName }}</p>
                    <p class="text-xs text-surface-fg-muted">
                      {{ appointment.date | hmsDate }} at {{ appointment.startTime }} ·
                      {{ appointment.specialty }}
                    </p>
                  </div>
                  <div class="text-right">
                    <hms-badge [tone]="appointmentBadge(appointment.status)">
                      {{ appointmentLabel(appointment.status) }}
                    </hms-badge>
                    @if (appointment.tokenNumber !== null) {
                      <p class="mt-1 text-xs text-surface-fg-muted">
                        Token {{ appointment.tokenNumber }}
                      </p>
                    }
                  </div>
                </li>
              }
            </ul>
          }
        </hms-card>
      </div>
    }
  `,
})
export class PortalHomeComponent {
  protected readonly portal = inject(PatientPortalFacade);

  protected readonly summary = this.portal.summary;

  protected greeting(): string {
    const name = this.summary().patientName;
    return name === '' ? 'Welcome' : `Welcome, ${name.split(' ')[0]}`;
  }

  protected latestReports(): readonly ReportDocument[] {
    return (this.portal.reports()?.items ?? []).slice(0, 5);
  }

  protected upcoming() {
    return this.portal.upcomingAppointments().slice(0, 5);
  }

  protected reportBadge(report: ReportDocument) {
    return reportTone(report.status);
  }

  protected reportLabel(report: ReportDocument): string {
    return REPORT_STATUS_LABELS[report.status];
  }

  protected appointmentBadge(status: keyof typeof APPOINTMENT_STATUS_LABELS) {
    return appointmentTone(status);
  }

  protected appointmentLabel(status: keyof typeof APPOINTMENT_STATUS_LABELS): string {
    return APPOINTMENT_STATUS_LABELS[status];
  }
}
