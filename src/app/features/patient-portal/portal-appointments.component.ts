import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { PatientPortalFacade } from './patient-portal.facade';
import { CardComponent } from '../../shared/ui/card/card.component';
import { PageHeaderComponent } from '../../shared/ui/page-header/page-header.component';
import { BadgeComponent } from '../../shared/ui/badge/badge.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { HmsDatePipe } from '../../shared/pipes/hms-pipes';
import {
  APPOINTMENT_STATUS_LABELS,
  appointmentTone,
  type Appointment,
} from '../../shared/models/appointment.model';

@Component({
  selector: 'hms-portal-appointments',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CardComponent,
    PageHeaderComponent,
    BadgeComponent,
    SkeletonComponent,
    EmptyStateComponent,
    HmsDatePipe,
  ],
  template: `
    <hms-page-header
      heading="My appointments"
      description="Your scheduled and past visits."
    />

    @if (portal.isAppointmentsLoading() && portal.appointments().length === 0) {
      <hms-card><hms-skeleton [lines]="5" [height]="20" label="Loading appointments" /></hms-card>
    } @else {
      <div class="grid gap-4">
        <hms-card heading="Upcoming" [padded]="false">
          @if (portal.upcomingAppointments().length === 0) {
            <hms-empty-state title="Nothing scheduled" [description]="null" />
          } @else {
            <ul role="list" class="divide-y divide-surface-border">
              @for (appointment of portal.upcomingAppointments(); track appointment.id) {
                <li class="flex flex-wrap items-center gap-4 px-5 py-4">
                  <div class="min-w-0 flex-1">
                    <p class="text-sm font-medium text-surface-fg">{{ appointment.doctorName }}</p>
                    <p class="mt-0.5 text-xs text-surface-fg-muted">
                      {{ appointment.specialty }} · {{ appointment.reason || 'Consultation' }}
                    </p>
                  </div>
                  <div class="text-right">
                    <p class="text-sm text-surface-fg">
                      {{ appointment.date | hmsDate }} at {{ appointment.startTime }}
                    </p>
                    <p class="mt-1">
                      <hms-badge [tone]="tone(appointment)">{{ label(appointment) }}</hms-badge>
                    </p>
                  </div>
                </li>
              }
            </ul>
          }
        </hms-card>

        <hms-card heading="Past visits" [padded]="false">
          @if (portal.pastAppointments().length === 0) {
            <hms-empty-state title="No past visits" [description]="null" />
          } @else {
            <ul role="list" class="divide-y divide-surface-border">
              @for (appointment of portal.pastAppointments(); track appointment.id) {
                <li class="flex flex-wrap items-center gap-4 px-5 py-3">
                  <div class="min-w-0 flex-1">
                    <p class="text-sm text-surface-fg">{{ appointment.doctorName }}</p>
                    <p class="text-xs text-surface-fg-muted">{{ appointment.specialty }}</p>
                  </div>
                  <p class="text-xs text-surface-fg-muted">{{ appointment.date | hmsDate }}</p>
                  <hms-badge [tone]="tone(appointment)">{{ label(appointment) }}</hms-badge>
                </li>
              }
            </ul>
          }
        </hms-card>
      </div>
    }
  `,
})
export class PortalAppointmentsComponent {
  protected readonly portal = inject(PatientPortalFacade);

  protected tone(appointment: Appointment) {
    return appointmentTone(appointment.status);
  }

  protected label(appointment: Appointment): string {
    return APPOINTMENT_STATUS_LABELS[appointment.status];
  }
}
