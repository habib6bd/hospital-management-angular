import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { APP_CONFIG } from '../../../core/config/app-config';
import { AuthService } from '../../../core/auth/auth.service';
import { authContext } from '../../../core/http/http-context';
import { toQueryParams, type PaginatedDto } from '../../../core/http/paginated';
import { todayIso } from '../../appointments/appointment.service';
import { toAppointment, type AppointmentDto } from '../../../shared/models/appointment.dto';
import { APPOINTMENT_STATUS_LABELS, appointmentTone } from '../../../shared/models/appointment.model';
import { CardComponent } from '../../../shared/ui/card/card.component';
import { BadgeComponent } from '../../../shared/ui/badge/badge.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state/empty-state.component';
import { WIDGET_LINK_CLASS } from './widget-link';

const MAX_ROWS = 8;

/**
 * A doctor sees their own list; anyone else (reception) sees the whole
 * clinic's day, since they book for every doctor.
 */
@Component({
  selector: 'hms-my-appointments-widget',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, CardComponent, BadgeComponent, SkeletonComponent, EmptyStateComponent],
  template: `
    <hms-card [heading]="heading()" [subheading]="subheading()" [padded]="false">
      <a card-actions routerLink="/app/appointments" [class]="linkClass">All appointments</a>

      @if (resource.isLoading() && !resource.hasValue()) {
        <div class="p-5"><hms-skeleton [lines]="5" [height]="16" label="Loading appointments" /></div>
      } @else if (appointments().length === 0) {
        <hms-empty-state title="No appointments today" />
      } @else {
        <ul role="list" class="divide-y divide-surface-border">
          @for (appointment of visible(); track appointment.id) {
            <li class="flex items-center gap-3 px-4 py-2.5">
              <span class="w-12 shrink-0 font-mono text-sm tabular-nums text-surface-fg">
                {{ appointment.startTime }}
              </span>
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium text-surface-fg">{{ appointment.patientName }}</p>
                <p class="truncate text-xs text-surface-fg-muted">
                  {{ doctorId() === null ? appointment.doctorName : appointment.reason || appointment.patientMrn }}
                </p>
              </div>
              <hms-badge [tone]="tone(appointment.status)">{{ labels[appointment.status] }}</hms-badge>
            </li>
          }
        </ul>
        @if (appointments().length > visible().length) {
          <p class="border-t border-surface-border px-4 py-2 text-xs text-surface-fg-muted">
            and {{ appointments().length - visible().length }} more
          </p>
        }
      }
    </hms-card>
  `,
})
export class MyAppointmentsWidgetComponent {
  private readonly config = inject(APP_CONFIG);
  private readonly auth = inject(AuthService);
  protected readonly linkClass = WIDGET_LINK_CLASS;
  protected readonly labels = APPOINTMENT_STATUS_LABELS;
  protected readonly tone = appointmentTone;

  protected readonly doctorId = computed(() => this.auth.user()?.doctorId ?? null);

  protected readonly resource = httpResource<PaginatedDto<AppointmentDto>>(() => ({
    url: `${this.config.apiBaseUrl}/appointments/`,
    params: toQueryParams({
      date: todayIso(),
      doctor: this.doctorId() ?? '',
      ordering: 'start_time',
      page_size: 200,
    }),
    context: authContext({ skipLoading: true }),
  }));

  protected readonly appointments = computed(
    () => this.resource.value()?.results.map(toAppointment) ?? [],
  );
  protected readonly visible = computed(() => this.appointments().slice(0, MAX_ROWS));

  protected readonly heading = computed(() =>
    this.doctorId() === null ? "Today's appointments" : 'My appointments today',
  );
  protected readonly subheading = computed(() => {
    const remaining = this.appointments().filter(
      (row) => row.status === 'booked' || row.status === 'checked_in',
    ).length;
    return `${this.appointments().length} booked · ${remaining} still to see`;
  });
}
