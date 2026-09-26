import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LabService } from '../../lab-reports/lab.service';
import { LAB_ORDER_STATUS_LABELS, labOrderTone } from '../../../shared/models/lab.model';
import { CardComponent } from '../../../shared/ui/card/card.component';
import { BadgeComponent } from '../../../shared/ui/badge/badge.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state/empty-state.component';
import { RelativeTimePipe } from '../../../shared/pipes/hms-pipes';
import { StatTileComponent } from './stat-tile.component';
import { WIDGET_LINK_CLASS } from './widget-link';

const MAX_ROWS = 5;

@Component({
  selector: 'hms-pending-lab-widget',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    CardComponent,
    BadgeComponent,
    SkeletonComponent,
    EmptyStateComponent,
    RelativeTimePipe,
    StatTileComponent,
  ],
  template: `
    <hms-card heading="Pending lab orders" [subheading]="lab.pendingCount() + ' open orders'">
      <a card-actions routerLink="/app/lab" [class]="linkClass">View lab</a>

      @if (lab.isPendingLoading() && lab.pendingCount() === 0) {
        <hms-skeleton [lines]="5" [height]="16" label="Loading lab orders" />
      } @else if (lab.pendingCount() === 0) {
        <hms-empty-state title="No open orders" description="Every order has a result." />
      } @else {
        <div class="grid grid-cols-3 gap-2">
          <hms-stat-tile label="Awaiting sample" [value]="'' + lab.awaitingSample().length" />
          <hms-stat-tile label="Awaiting analysis" [value]="'' + lab.awaitingAnalysis().length" />
          <hms-stat-tile label="In progress" [value]="'' + lab.inProgress().length" />
        </div>

        <h3 class="mt-4 mb-1 flex items-center gap-2 text-xs font-medium text-surface-fg-muted">
          Urgent
          <hms-badge [tone]="lab.urgentPending().length > 0 ? 'critical' : 'neutral'">
            {{ lab.urgentPending().length }}
          </hms-badge>
        </h3>
        @if (urgent().length === 0) {
          <p class="py-2 text-sm text-surface-fg-muted">No urgent orders open.</p>
        } @else {
          <ul role="list" class="divide-y divide-surface-border">
            @for (order of urgent(); track order.id) {
              <li class="flex items-center justify-between gap-3 py-2">
                <div class="min-w-0">
                  <p class="truncate text-sm font-medium text-surface-fg">
                    {{ order.patientName }}
                    <span class="font-mono text-xs text-surface-fg-muted">{{ order.orderNumber }}</span>
                  </p>
                  <p class="truncate text-xs text-surface-fg-muted">
                    {{ order.tests.length }} test{{ order.tests.length === 1 ? '' : 's' }} · ordered
                    {{ order.orderedAt | relativeTime }}
                  </p>
                </div>
                <hms-badge [tone]="tone(order.status)">{{ labels[order.status] }}</hms-badge>
              </li>
            }
          </ul>
        }
      }
    </hms-card>
  `,
})
export class PendingLabWidgetComponent {
  protected readonly lab = inject(LabService);
  protected readonly linkClass = WIDGET_LINK_CLASS;
  protected readonly labels = LAB_ORDER_STATUS_LABELS;
  protected readonly tone = labOrderTone;
  protected readonly urgent = computed(() => this.lab.urgentPending().slice(0, MAX_ROWS));
}
