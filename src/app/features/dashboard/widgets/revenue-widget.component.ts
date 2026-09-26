import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BillingService } from '../../billing/billing.service';
import { CHARGE_SOURCE_LABELS } from '../../../shared/models/billing.model';
import { BdtPipe } from '../../../shared/pipes/hms-pipes';
import { CardComponent } from '../../../shared/ui/card/card.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state/empty-state.component';
import { BarChartComponent } from '../../../shared/ui/chart/bar-chart.component';
import { StatTileComponent } from './stat-tile.component';
import { WIDGET_LINK_CLASS } from './widget-link';
import { percent } from '../dashboard-data';

const bdt = new BdtPipe();

@Component({
  selector: 'hms-revenue-widget',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, CardComponent, SkeletonComponent, EmptyStateComponent, BarChartComponent, StatTileComponent],
  template: `
    <hms-card heading="Revenue" subheading="All invoices to date">
      <a card-actions routerLink="/app/billing" [class]="linkClass">View billing</a>

      @if (summary(); as summary) {
        <div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <hms-stat-tile label="Billed" [value]="money(summary.totalBilled)" />
          <hms-stat-tile
            label="Collected"
            [value]="money(summary.totalCollected)"
            [hint]="collectionRate() + ' collection rate'"
          />
          <hms-stat-tile
            label="Outstanding"
            [value]="money(summary.totalOutstanding)"
            [hint]="summary.overdueCount + ' overdue'"
          />
        </div>

        @if (bySource().values.length === 0) {
          <hms-empty-state title="No charges yet" />
        } @else {
          <h3 class="mt-5 mb-2 text-xs font-medium text-surface-fg-muted">Billed by source</h3>
          <hms-bar-chart
            [labels]="bySource().labels"
            [values]="bySource().values"
            seriesLabel="Billed"
            ariaLabel="Amount billed by charge source"
            [horizontal]="true"
            [height]="200"
            [formatValue]="money"
          />
        }
      } @else if (billing.isSummaryLoading()) {
        <hms-skeleton [lines]="5" [height]="20" label="Loading revenue" />
      } @else {
        <hms-empty-state title="Revenue unavailable" description="Try reloading the page." />
      }
    </hms-card>
  `,
})
export class RevenueWidgetComponent {
  protected readonly billing = inject(BillingService);
  protected readonly linkClass = WIDGET_LINK_CLASS;
  protected readonly summary = this.billing.summary;
  protected readonly collectionRate = computed(() => percent(this.billing.collectionRate()));

  /** Largest source first, so the biggest bar sits at the top. */
  protected readonly bySource = computed(() => {
    const rows = [...(this.summary()?.bySource ?? [])].sort((a, b) => b.amount - a.amount);
    return {
      labels: rows.map((row) => CHARGE_SOURCE_LABELS[row.source] ?? row.source),
      values: rows.map((row) => row.amount),
    };
  });

  protected readonly money = (value: number): string => bdt.transform(value);
}
