import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { InventoryService } from '../../inventory/inventory.service';
import {
  STOCK_STATUS_LABELS,
  stockStatus,
  stockStatusTone,
  type StockStatus,
} from '../../../shared/models/inventory.model';
import { CardComponent } from '../../../shared/ui/card/card.component';
import { BadgeComponent } from '../../../shared/ui/badge/badge.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state/empty-state.component';
import { WIDGET_LINK_CLASS } from './widget-link';

const MAX_ROWS = 5;

@Component({
  selector: 'hms-inventory-alerts-widget',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, CardComponent, BadgeComponent, SkeletonComponent, EmptyStateComponent],
  template: `
    <hms-card heading="Inventory alerts" [subheading]="inventory.alertCount() + ' items need attention'" [padded]="false">
      <a card-actions routerLink="/app/inventory" [class]="linkClass">View inventory</a>

      @if (inventory.isAlertsLoading() && inventory.alertCount() === 0) {
        <div class="p-5"><hms-skeleton [lines]="5" [height]="16" label="Loading alerts" /></div>
      } @else if (inventory.alertCount() === 0) {
        <hms-empty-state title="All stock healthy" description="Nothing is low, out, or expiring." />
      } @else {
        <dl class="grid grid-cols-2 gap-2 p-4 sm:grid-cols-4">
          @for (group of groups(); track group.status) {
            <div class="rounded-control bg-surface-sunken px-3 py-2">
              <dt class="truncate text-xs text-surface-fg-muted">{{ group.label }}</dt>
              <dd class="mt-0.5 flex items-center gap-2">
                <span class="text-lg font-semibold tabular-nums text-surface-fg">{{ group.count }}</span>
                @if (group.count > 0) {
                  <hms-badge [tone]="group.tone">{{ group.tone === 'critical' ? 'Act now' : 'Watch' }}</hms-badge>
                }
              </dd>
            </div>
          }
        </dl>

        <ul role="list" class="divide-y divide-surface-border border-t border-surface-border">
          @for (item of topItems(); track item.id) {
            <li class="flex items-center justify-between gap-3 px-4 py-2.5">
              <div class="min-w-0">
                <p class="truncate text-sm font-medium text-surface-fg">{{ item.name }}</p>
                <p class="truncate text-xs text-surface-fg-muted">
                  {{ item.quantityInStock }} {{ item.unit }} in stock · reorder at {{ item.reorderLevel }}
                </p>
              </div>
              <hms-badge [tone]="tone(item.status)">{{ labels[item.status] }}</hms-badge>
            </li>
          }
        </ul>
      }
    </hms-card>
  `,
})
export class InventoryAlertsWidgetComponent {
  protected readonly inventory = inject(InventoryService);
  protected readonly linkClass = WIDGET_LINK_CLASS;
  protected readonly labels = STOCK_STATUS_LABELS;
  protected readonly tone = stockStatusTone;

  protected readonly groups = computed(() =>
    (
      [
        ['out_of_stock', this.inventory.outOfStock().length],
        ['expired', this.inventory.expired().length],
        ['low_stock', this.inventory.lowStock().length],
        ['expiring_soon', this.inventory.expiringSoon().length],
      ] as const
    ).map(([status, count]) => ({
      status,
      count,
      label: STOCK_STATUS_LABELS[status],
      tone: stockStatusTone(status),
    })),
  );

  /** Most urgent first: nothing to dispense beats running low. */
  protected readonly topItems = computed(() =>
    [
      ...this.inventory.outOfStock(),
      ...this.inventory.expired(),
      ...this.inventory.lowStock(),
      ...this.inventory.expiringSoon(),
    ]
      .slice(0, MAX_ROWS)
      .map((item) => ({ ...item, status: stockStatus(item) as StockStatus })),
  );
}
