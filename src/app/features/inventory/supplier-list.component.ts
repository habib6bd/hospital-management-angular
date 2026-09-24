import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { InventoryService, SupplierService } from './inventory.service';
import { CardComponent } from '../../shared/ui/card/card.component';
import { PageHeaderComponent } from '../../shared/ui/page-header/page-header.component';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { BadgeComponent } from '../../shared/ui/badge/badge.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'hms-supplier-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    CardComponent,
    PageHeaderComponent,
    ButtonComponent,
    BadgeComponent,
    SkeletonComponent,
    EmptyStateComponent,
  ],
  template: `
    <hms-page-header heading="Suppliers" description="Vendors supplying medicines and equipment.">
      <hms-button variant="secondary" routerLink="/inventory">Back to inventory</hms-button>
    </hms-page-header>

    <hms-card [padded]="false">
      @if (suppliers.isLoading()) {
        <div class="p-5"><hms-skeleton [lines]="5" [height]="16" label="Loading suppliers" /></div>
      } @else if (suppliers.suppliers().length === 0) {
        <hms-empty-state title="No suppliers yet" [description]="null" />
      } @else {
        <ul role="list" class="divide-y divide-surface-border">
          @for (supplier of suppliers.suppliers(); track supplier.id) {
            <li class="flex flex-wrap items-start gap-4 px-5 py-4">
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <p class="truncate text-sm font-medium text-surface-fg">{{ supplier.name }}</p>
                  <hms-badge [tone]="supplier.isActive ? 'ready' : 'neutral'">
                    {{ supplier.isActive ? 'Active' : 'Inactive' }}
                  </hms-badge>
                </div>
                <p class="mt-0.5 text-xs text-surface-fg-muted">
                  {{ supplier.contactPerson }} · {{ supplier.phone }}
                  @if (supplier.email !== null) {
                    · {{ supplier.email }}
                  }
                </p>
                <p class="mt-0.5 text-xs text-surface-fg-muted">{{ supplier.address }}</p>
              </div>

              <div class="text-right">
                <p class="text-xs text-surface-fg-muted">Items supplied</p>
                <p class="text-sm font-semibold text-surface-fg">{{ itemCount(supplier.id) }}</p>
              </div>

              <hms-button variant="ghost" size="sm" (pressed)="viewItems(supplier.id)">
                View items
              </hms-button>
            </li>
          }
        </ul>
      }
    </hms-card>
  `,
})
export class SupplierListComponent {
  protected readonly suppliers = inject(SupplierService);
  private readonly inventory = inject(InventoryService);
  private readonly router = inject(Router);

  /**
   * Counts come from the alerts feed, which is the only unpaginated item list
   * available — so this is a lower bound rather than a true total. A dedicated
   * `item_count` annotation on the supplier serialiser would make it exact.
   */
  private readonly countsBySupplier = computed<ReadonlyMap<number, number>>(() => {
    const counts = new Map<number, number>();
    for (const item of this.inventory.items()?.items ?? []) {
      if (item.supplierId !== null) {
        counts.set(item.supplierId, (counts.get(item.supplierId) ?? 0) + 1);
      }
    }
    return counts;
  });

  protected itemCount(supplierId: number): number {
    return this.countsBySupplier().get(supplierId) ?? 0;
  }

  protected async viewItems(supplierId: number): Promise<void> {
    this.inventory.patchQuery({ supplierId });
    await this.router.navigate(['/inventory']);
  }
}
