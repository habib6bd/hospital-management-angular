import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  PLATFORM_ID,
  computed,
  inject,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AppointmentService } from '../../appointments/appointment.service';
import { CardComponent } from '../../../shared/ui/card/card.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state/empty-state.component';
import { RelativeTimePipe } from '../../../shared/pipes/hms-pipes';
import { StatTileComponent } from './stat-tile.component';
import { WIDGET_LINK_CLASS } from './widget-link';

/** Same cadence as the full OPD queue page. */
const POLL_INTERVAL_MS = 20_000;
const MAX_ROWS = 5;

@Component({
  selector: 'hms-opd-queue-widget',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, CardComponent, SkeletonComponent, EmptyStateComponent, RelativeTimePipe, StatTileComponent],
  template: `
    <hms-card heading="OPD queue" subheading="Today, refreshes automatically">
      <a card-actions routerLink="/app/appointments/queue" [class]="linkClass">Open queue</a>

      @if (appointments.isQueueLoading() && appointments.queue().length === 0) {
        <hms-skeleton [lines]="5" [height]="16" label="Loading queue" />
      } @else {
        <div class="grid grid-cols-3 gap-2">
          <hms-stat-tile label="Not arrived" [value]="'' + appointments.notArrived().length" />
          <hms-stat-tile label="Waiting" [value]="'' + appointments.waiting().length" />
          <hms-stat-tile label="With doctor" [value]="'' + appointments.inConsultation().length" />
        </div>

        <h3 class="mt-4 mb-1 text-xs font-medium text-surface-fg-muted">Next in line</h3>
        @if (nextUp().length === 0) {
          <hms-empty-state title="Nobody waiting" />
        } @else {
          <ul role="list" class="divide-y divide-surface-border">
            @for (appointment of nextUp(); track appointment.id) {
              <li class="flex items-center gap-3 py-2">
                <span
                  class="flex size-8 shrink-0 items-center justify-center rounded-control bg-surface-sunken font-mono text-sm font-semibold text-surface-fg"
                  [attr.aria-label]="'Token ' + appointment.tokenNumber"
                >
                  {{ appointment.tokenNumber }}
                </span>
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium text-surface-fg">{{ appointment.patientName }}</p>
                  <p class="truncate text-xs text-surface-fg-muted">
                    {{ appointment.doctorName }}
                    @if (appointment.checkedInAt !== null) {
                      · waiting since {{ appointment.checkedInAt | relativeTime }}
                    }
                  </p>
                </div>
              </li>
            }
          </ul>
        }
      }
    </hms-card>
  `,
})
export class OpdQueueWidgetComponent {
  protected readonly appointments = inject(AppointmentService);
  protected readonly linkClass = WIDGET_LINK_CLASS;

  /** Checked-in patients are called before those who have not arrived yet. */
  protected readonly nextUp = computed(() =>
    [...this.appointments.waiting(), ...this.appointments.notArrived()].slice(0, MAX_ROWS),
  );

  constructor() {
    if (isPlatformBrowser(inject(PLATFORM_ID))) {
      const timer = setInterval(() => this.appointments.refreshQueue(), POLL_INTERVAL_MS);
      inject(DestroyRef).onDestroy(() => clearInterval(timer));
    }
  }
}
