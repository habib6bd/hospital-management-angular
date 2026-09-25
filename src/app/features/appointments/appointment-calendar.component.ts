import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AppointmentService, DoctorService, addDays, todayIso } from './appointment.service';
import { PermissionService } from '../../core/auth/permission.service';
import { CardComponent } from '../../shared/ui/card/card.component';
import { PageHeaderComponent } from '../../shared/ui/page-header/page-header.component';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { BadgeComponent } from '../../shared/ui/badge/badge.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';
import {
  APPOINTMENT_STATUS_LABELS,
  appointmentTone,
  type Appointment,
} from '../../shared/models/appointment.model';

const DAY_FORMATTER = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric' });
const RANGE_FORMATTER = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });

@Component({
  selector: 'hms-appointment-calendar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CardComponent,
    PageHeaderComponent,
    ButtonComponent,
    BadgeComponent,
    SkeletonComponent,
  ],
  template: `
    <hms-page-header heading="Appointments" description="Clinic schedule by week.">
      @if (canManage()) {
        <hms-button (pressed)="book()">Book appointment</hms-button>
      }
    </hms-page-header>

    <hms-card [padded]="false">
      <div class="flex flex-wrap items-center gap-2 border-b border-surface-border p-3">
        <div class="flex items-center gap-1">
          <hms-button variant="ghost" size="sm" ariaLabel="Previous week" (pressed)="appointments.shiftWeek(-1)">
            ‹
          </hms-button>
          <hms-button variant="secondary" size="sm" (pressed)="appointments.goToCurrentWeek()">
            This week
          </hms-button>
          <hms-button variant="ghost" size="sm" ariaLabel="Next week" (pressed)="appointments.shiftWeek(1)">
            ›
          </hms-button>
        </div>

        <p class="text-sm font-medium text-surface-fg" aria-live="polite">{{ weekLabel() }}</p>

        <div class="flex-1"></div>

        <label class="flex items-center gap-1.5">
          <span class="sr-only-focusable">Filter by doctor</span>
          <select
            class="h-9 rounded-control bg-surface px-2 text-sm text-surface-fg ring-1 ring-inset ring-surface-border focus:ring-2 focus:ring-brand-500"
            [value]="appointments.calendarDoctor()"
            (change)="onDoctorChange($event)"
          >
            <option value="">All doctors</option>
            @for (doctor of doctors.doctors(); track doctor.id) {
              <option [value]="doctor.id">{{ doctor.fullName }} — {{ doctor.specialty }}</option>
            }
          </select>
        </label>
      </div>

      @if (appointments.isWeekLoading() && appointments.weekAppointments().length === 0) {
        <div class="p-5"><hms-skeleton [lines]="7" [height]="20" label="Loading schedule" /></div>
      } @else {
        <!-- Seven columns on desktop; stacks to a day list on narrow screens. -->
        <div class="grid grid-cols-1 divide-y divide-surface-border sm:grid-cols-7 sm:divide-x sm:divide-y-0">
          @for (day of days(); track day.date) {
            <section class="min-w-0" [class.bg-brand-50/50]="day.isToday" [class.dark:bg-brand-950/30]="day.isToday">
              <h2
                class="sticky top-0 border-b border-surface-border bg-surface-raised px-3 py-2 text-xs font-semibold"
                [class]="day.isToday ? 'text-brand-700 dark:text-brand-300' : 'text-surface-fg-muted'"
              >
                {{ day.label }}
                <span class="ml-1 font-normal">({{ day.appointments.length }})</span>
              </h2>

              <ul role="list" class="hms-scrollbar max-h-96 space-y-1 overflow-y-auto p-2">
                @for (appointment of day.appointments; track appointment.id) {
                  <li>
                    <button
                      type="button"
                      class="w-full rounded-control bg-surface p-2 text-left ring-1 ring-inset ring-surface-border transition-colors hover:bg-surface-sunken"
                      [attr.aria-label]="cardLabel(appointment)"
                      (click)="openPatient(appointment)"
                    >
                      <span class="block font-mono text-xs font-semibold text-surface-fg">
                        {{ appointment.startTime }}
                      </span>
                      <span class="mt-0.5 block truncate text-xs text-surface-fg">
                        {{ appointment.patientName }}
                      </span>
                      <span class="mt-0.5 block truncate text-[11px] text-surface-fg-muted">
                        {{ appointment.doctorName }}
                      </span>
                      <span class="mt-1 block">
                        <hms-badge [tone]="tone(appointment)" [dot]="false">
                          {{ statusLabel(appointment) }}
                        </hms-badge>
                      </span>
                    </button>
                  </li>
                } @empty {
                  <li class="px-2 py-4 text-center text-xs text-surface-fg-muted">No clinics</li>
                }
              </ul>
            </section>
          }
        </div>
      }
    </hms-card>
  `,
})
export class AppointmentCalendarComponent {
  protected readonly appointments = inject(AppointmentService);
  protected readonly doctors = inject(DoctorService);
  private readonly permissions = inject(PermissionService);
  private readonly router = inject(Router);

  protected readonly canManage = this.permissions.hasPermission('appointments.manage');

  protected readonly days = computed(() => {
    const byDay = this.appointments.weekByDay();
    const today = todayIso();
    return this.appointments.weekDays().map((date) => ({
      date,
      label: DAY_FORMATTER.format(new Date(`${date}T00:00:00`)),
      isToday: date === today,
      appointments: byDay.get(date) ?? [],
    }));
  });

  protected readonly weekLabel = computed(() => {
    const start = this.appointments.currentWeekStart();
    const end = addDays(start, 6);
    return `${RANGE_FORMATTER.format(new Date(`${start}T00:00:00`))} – ${RANGE_FORMATTER.format(
      new Date(`${end}T00:00:00`),
    )}`;
  });

  protected tone(appointment: Appointment) {
    return appointmentTone(appointment.status);
  }

  protected statusLabel(appointment: Appointment): string {
    return APPOINTMENT_STATUS_LABELS[appointment.status];
  }

  protected cardLabel(appointment: Appointment): string {
    return `${appointment.startTime} ${appointment.patientName} with ${appointment.doctorName}, ${this.statusLabel(appointment)}`;
  }

  protected onDoctorChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.appointments.setCalendarDoctor(value === '' ? '' : Number(value));
  }

  protected async openPatient(appointment: Appointment): Promise<void> {
    // Online guest bookings have no patient record until reception registers them.
    if (appointment.patientId === 0) {
      return;
    }
    await this.router.navigate(['/app/patients', appointment.patientId]);
  }

  protected async book(): Promise<void> {
    await this.router.navigate(['/app/appointments', 'book']);
  }
}
