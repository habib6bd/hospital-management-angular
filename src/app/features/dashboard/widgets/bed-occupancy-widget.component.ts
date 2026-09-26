import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { WardService } from '../../patients/patient.service';
import { CardComponent } from '../../../shared/ui/card/card.component';
import { BadgeComponent } from '../../../shared/ui/badge/badge.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state/empty-state.component';
import { StatTileComponent } from './stat-tile.component';
import { WIDGET_LINK_CLASS } from './widget-link';
import { percent } from '../dashboard-data';

/** At or above this a ward is flagged: admissions will soon need a transfer. */
const NEAR_CAPACITY = 0.9;

@Component({
  selector: 'hms-bed-occupancy-widget',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, CardComponent, BadgeComponent, SkeletonComponent, EmptyStateComponent, StatTileComponent],
  template: `
    <hms-card heading="Bed occupancy" subheading="Live, across all wards">
      <a card-actions routerLink="/app/patients/beds" [class]="linkClass">Ward & beds</a>

      @if (wards.isLoading() && rows().length === 0) {
        <hms-skeleton [lines]="5" [height]="16" label="Loading wards" />
      } @else if (rows().length === 0) {
        <hms-empty-state title="No wards configured" />
      } @else {
        <div class="grid grid-cols-2 gap-2">
          <hms-stat-tile label="Occupancy" [value]="overall()" />
          <hms-stat-tile
            label="Free beds"
            [value]="'' + (wards.totalBeds() - wards.occupiedBeds())"
            [hint]="'of ' + wards.totalBeds()"
          />
        </div>

        <ul role="list" class="mt-4 space-y-3">
          @for (row of rows(); track row.id) {
            <li>
              <div class="flex items-center justify-between gap-2 text-sm">
                <span class="truncate font-medium text-surface-fg">{{ row.name }}</span>
                <span class="flex shrink-0 items-center gap-2 text-xs tabular-nums text-surface-fg-muted">
                  @if (row.nearCapacity) {
                    <hms-badge tone="pending">Near capacity</hms-badge>
                  }
                  {{ row.occupied }}/{{ row.total }}
                </span>
              </div>
              <div
                class="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-sunken"
                role="meter"
                aria-valuemin="0"
                [attr.aria-valuemax]="row.total"
                [attr.aria-valuenow]="row.occupied"
                [attr.aria-label]="row.name + ' occupancy'"
              >
                <div class="h-full rounded-full bg-brand-500 dark:bg-brand-400" [style.width.%]="row.ratio * 100"></div>
              </div>
            </li>
          }
        </ul>
      }
    </hms-card>
  `,
})
export class BedOccupancyWidgetComponent {
  protected readonly wards = inject(WardService);
  protected readonly linkClass = WIDGET_LINK_CLASS;
  protected readonly overall = computed(() => percent(this.wards.occupancyRate()));

  protected readonly rows = computed(() =>
    this.wards.wards().map((ward) => {
      const ratio = ward.totalBeds === 0 ? 0 : ward.occupiedBeds / ward.totalBeds;
      return {
        id: ward.id,
        name: ward.name,
        occupied: ward.occupiedBeds,
        total: ward.totalBeds,
        ratio,
        nearCapacity: ratio >= NEAR_CAPACITY,
      };
    }),
  );
}
