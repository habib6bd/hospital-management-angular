import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, httpResource } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { APP_CONFIG } from '../../core/config/app-config';
import { authContext } from '../../core/http/http-context';
import { mapPage, toQueryParams, type Page, type PaginatedDto } from '../../core/http/paginated';
import {
  toAppointment,
  toAppointmentWriteDto,
  toDoctor,
  toDoctorSchedule,
  toTimeSlot,
  type AppointmentDto,
  type DoctorDto,
  type DoctorScheduleDto,
  type TimeSlotDto,
} from '../../shared/models/appointment.dto';
import {
  ACTIVE_QUEUE_STATUSES,
  type Appointment,
  type AppointmentInput,
  type AppointmentStatus,
  type Doctor,
  type DoctorSchedule,
  type TimeSlot,
} from '../../shared/models/appointment.model';

/** Actions the backend exposes as `POST /appointments/:id/<action>/`. */
export type AppointmentAction = 'check-in' | 'start' | 'complete' | 'cancel' | 'no-show';

export interface AppointmentListQuery {
  readonly page: number;
  readonly pageSize: number;
  readonly search: string;
  readonly date: string;
  readonly doctorId: number | '';
  readonly status: AppointmentStatus | '';
  readonly ordering: string;
}

/**
 * Formats a date from its *local* components.
 *
 * `toISOString()` converts to UTC first, so for any user east of UTC (Dhaka is
 * +06) local midnight becomes the previous day — every clinic date would shift
 * back by one. Calendar dates here are wall-clock dates at the hospital, so
 * they must never round-trip through UTC.
 */
export function formatIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayIso(): string {
  return formatIsoDate(new Date());
}

function toAppointmentParams(query: AppointmentListQuery): Record<string, string> {
  return toQueryParams({
    page: query.page,
    page_size: query.pageSize,
    search: query.search,
    date: query.date,
    doctor: query.doctorId,
    status: query.status,
    ordering: query.ordering,
  });
}

@Injectable({ providedIn: 'root' })
export class DoctorService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(APP_CONFIG);
  private readonly baseUrl = `${this.config.apiBaseUrl}/doctors`;

  private readonly doctorsResource = httpResource<PaginatedDto<DoctorDto>>(
    () => `${this.baseUrl}/`,
  );

  readonly doctors = computed<readonly Doctor[]>(
    () => this.doctorsResource.value()?.results.map(toDoctor) ?? [],
  );
  readonly isLoading = this.doctorsResource.isLoading;

  doctorById(id: number): Doctor | undefined {
    return this.doctors().find((doctor) => doctor.id === id);
  }

  /** Schedules for the schedule editor; kept here since they belong to a doctor. */
  private readonly scheduleDoctorId = signal<number | null>(null);

  private readonly schedulesResource = httpResource<PaginatedDto<DoctorScheduleDto>>(() => {
    const doctorId = this.scheduleDoctorId();
    return doctorId === null
      ? undefined
      : { url: `${this.config.apiBaseUrl}/schedules/`, params: { doctor: String(doctorId) } };
  });

  readonly schedules = computed<readonly DoctorSchedule[]>(
    () => this.schedulesResource.value()?.results.map(toDoctorSchedule) ?? [],
  );
  readonly isSchedulesLoading = this.schedulesResource.isLoading;

  selectScheduleDoctor(doctorId: number | null): void {
    this.scheduleDoctorId.set(doctorId);
  }

  async updateSchedule(
    id: number,
    changes: { isActive?: boolean; startTime?: string; endTime?: string; slotMinutes?: number },
  ): Promise<DoctorSchedule> {
    const payload: Record<string, unknown> = {};
    if (changes.isActive !== undefined) {
      payload['is_active'] = changes.isActive;
    }
    if (changes.startTime !== undefined) {
      payload['start_time'] = changes.startTime;
    }
    if (changes.endTime !== undefined) {
      payload['end_time'] = changes.endTime;
    }
    if (changes.slotMinutes !== undefined) {
      payload['slot_minutes'] = changes.slotMinutes;
    }

    const dto = await firstValueFrom(
      this.http.patch<DoctorScheduleDto>(`${this.config.apiBaseUrl}/schedules/${id}/`, payload),
    );
    this.schedulesResource.reload();
    return toDoctorSchedule(dto);
  }
}

@Injectable({ providedIn: 'root' })
export class AppointmentService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(APP_CONFIG);
  private readonly baseUrl = `${this.config.apiBaseUrl}/appointments`;

  private readonly queryState = signal<AppointmentListQuery>({
    page: 1,
    pageSize: this.config.pageSize,
    search: '',
    date: todayIso(),
    doctorId: '',
    status: '',
    ordering: 'start_time',
  });

  readonly query = this.queryState.asReadonly();

  private readonly listResource = httpResource<PaginatedDto<AppointmentDto>>(() => ({
    url: `${this.baseUrl}/`,
    params: toAppointmentParams(this.queryState()),
  }));

  readonly appointments = computed<Page<Appointment> | undefined>(() => {
    const value = this.listResource.value();
    if (value === undefined) {
      return undefined;
    }
    const { page, pageSize } = this.queryState();
    return mapPage(value, toAppointment, page, pageSize);
  });

  readonly isLoading = this.listResource.isLoading;

  patchQuery(changes: Partial<AppointmentListQuery>): void {
    this.queryState.update((current) => ({ ...current, ...changes, page: changes.page ?? 1 }));
  }

  setPage(page: number): void {
    this.queryState.update((current) => ({ ...current, page }));
  }

  reload(): void {
    this.listResource.reload();
  }

  /* -------------------------------------------------------- week view */

  private readonly weekStart = signal<string>(startOfWeek(todayIso()));
  private readonly calendarDoctorId = signal<number | ''>('');

  readonly currentWeekStart = this.weekStart.asReadonly();
  readonly calendarDoctor = this.calendarDoctorId.asReadonly();

  readonly weekDays = computed<readonly string[]>(() => {
    const start = this.weekStart();
    return Array.from({ length: 7 }, (_, offset) => addDays(start, offset));
  });

  private readonly weekResource = httpResource<PaginatedDto<AppointmentDto>>(() => {
    const days = this.weekDays();
    return {
      url: `${this.baseUrl}/`,
      params: toQueryParams({
        date_after: days[0],
        date_before: days[days.length - 1],
        doctor: this.calendarDoctorId(),
        // One clinic week is well under this; a real page cap would hide rows.
        page_size: 500,
        ordering: 'start_time',
      }),
    };
  });

  readonly weekAppointments = computed<readonly Appointment[]>(
    () => this.weekResource.value()?.results.map(toAppointment) ?? [],
  );

  readonly isWeekLoading = this.weekResource.isLoading;

  /** Appointments grouped by date, for the calendar's day columns. */
  readonly weekByDay = computed<ReadonlyMap<string, readonly Appointment[]>>(() => {
    const grouped = new Map<string, Appointment[]>();
    for (const day of this.weekDays()) {
      grouped.set(day, []);
    }
    for (const appointment of this.weekAppointments()) {
      grouped.get(appointment.date)?.push(appointment);
    }
    return grouped;
  });

  shiftWeek(weeks: number): void {
    this.weekStart.update((current) => addDays(current, weeks * 7));
  }

  goToCurrentWeek(): void {
    this.weekStart.set(startOfWeek(todayIso()));
  }

  setCalendarDoctor(doctorId: number | ''): void {
    this.calendarDoctorId.set(doctorId);
  }

  /* -------------------------------------------------------- OPD queue */

  private readonly queueDoctorId = signal<number | ''>('');
  private readonly queueRefreshTick = signal(0);

  readonly queueDoctor = this.queueDoctorId.asReadonly();

  private readonly queueResource = httpResource<PaginatedDto<AppointmentDto>>(() => {
    // Reading the tick makes the resource re-fetch on each poll.
    this.queueRefreshTick();
    return {
      url: `${this.baseUrl}/`,
      params: toQueryParams({
        date: todayIso(),
        doctor: this.queueDoctorId(),
        status__in: ACTIVE_QUEUE_STATUSES.join(','),
        page_size: 200,
        ordering: 'token_number',
      }),
      // Background poll: no global spinner, no toast on a transient failure.
      context: authContext({ skipLoading: true, skipErrorToast: true }),
    };
  });

  readonly queue = computed<readonly Appointment[]>(
    () => this.queueResource.value()?.results.map(toAppointment) ?? [],
  );

  readonly isQueueLoading = this.queueResource.isLoading;

  readonly waiting = computed(() =>
    this.queue().filter((appointment) => appointment.status === 'checked_in'),
  );
  readonly notArrived = computed(() =>
    this.queue().filter((appointment) => appointment.status === 'booked'),
  );
  readonly inConsultation = computed(() =>
    this.queue().filter((appointment) => appointment.status === 'in_consultation'),
  );

  setQueueDoctor(doctorId: number | ''): void {
    this.queueDoctorId.set(doctorId);
  }

  /** Called by the queue component's interval; cheap because it only bumps a signal. */
  refreshQueue(): void {
    this.queueRefreshTick.update((tick) => tick + 1);
  }

  /* ------------------------------------------------------------ writes */

  async book(input: AppointmentInput): Promise<Appointment> {
    const dto = await firstValueFrom(
      this.http.post<AppointmentDto>(`${this.baseUrl}/`, toAppointmentWriteDto(input)),
    );
    this.reloadAll();
    return toAppointment(dto);
  }

  async transition(id: number, action: AppointmentAction): Promise<Appointment> {
    const dto = await firstValueFrom(
      this.http.post<AppointmentDto>(`${this.baseUrl}/${id}/${action}/`, {}),
    );
    this.reloadAll();
    return toAppointment(dto);
  }

  /** Slots for a doctor on a date; `undefined` inputs simply skip the fetch. */
  slotsFor(doctorId: () => number | null, date: () => string) {
    return httpResource<{ results: readonly TimeSlotDto[] }>(() => {
      const id = doctorId();
      const day = date();
      return id === null || day === ''
        ? undefined
        : {
            url: `${this.config.apiBaseUrl}/doctors/${id}/slots/`,
            params: { date: day },
            context: authContext({ skipErrorToast: true }),
          };
    });
  }

  mapSlots(value: { results: readonly TimeSlotDto[] } | undefined): readonly TimeSlot[] {
    return value?.results.map(toTimeSlot) ?? [];
  }

  private reloadAll(): void {
    this.listResource.reload();
    this.weekResource.reload();
    this.queueResource.reload();
  }
}

/** Weeks start on Sunday, matching the Bangladeshi working week. */
export function startOfWeek(date: string): string {
  const parsed = new Date(`${date}T00:00:00`);
  parsed.setDate(parsed.getDate() - parsed.getDay());
  return formatIsoDate(parsed);
}

export function addDays(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00`);
  parsed.setDate(parsed.getDate() + days);
  return formatIsoDate(parsed);
}
