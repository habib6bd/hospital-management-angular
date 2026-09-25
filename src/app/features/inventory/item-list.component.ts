import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  viewChild,
  type TemplateRef,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { InventoryService, SupplierService, type StockFilter } from './inventory.service';
import { PermissionService } from '../../core/auth/permission.service';
import { CardComponent } from '../../shared/ui/card/card.component';
import { PageHeaderComponent } from '../../shared/ui/page-header/page-header.component';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { BadgeComponent } from '../../shared/ui/badge/badge.component';
import { DataTableComponent } from '../../shared/ui/data-table/data-table.component';
import { PaginationComponent } from '../../shared/ui/pagination/pagination.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { BdtPipe } from '../../shared/pipes/hms-pipes';
import {
  toOrdering,
  type CellContext,
  type ColumnDef,
  type SortState,
} from '../../shared/ui/data-table/data-table.model';
import {
  ITEM_CATEGORY_LABELS,
  STOCK_STATUS_LABELS,
  stockStatus,
  stockStatusTone,
  type InventoryItem,
  type ItemCategory,
} from '../../shared/models/inventory.model';

@Component({
  selector: 'hms-item-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    CardComponent,
    PageHeaderComponent,
    ButtonComponent,
    BadgeComponent,
    DataTableComponent,
    PaginationComponent,
    IconComponent,
  ],
  template: `
    <hms-page-header
      heading="Inventory & Pharmacy"
      description="Medicines, consumables and equipment with batch and expiry tracking."
    >
      <hms-button variant="secondary" routerLink="/app/inventory/suppliers">Suppliers</hms-button>
      @if (canManage()) {
        <hms-button (pressed)="addItem()">Add item</hms-button>
      }
    </hms-page-header>

    <!-- Alert tiles double as one-click filters into the list below. -->
    <div class="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      @for (tile of alertTiles(); track tile.filter) {
        <button
          type="button"
          class="rounded-card p-4 text-left ring-1 ring-inset transition-colors"
          [class]="tile.active ? tile.activeClass : tile.class"
          [attr.aria-pressed]="tile.active"
          (click)="toggleStockFilter(tile.filter)"
        >
          <span class="block text-xs text-surface-fg-muted">{{ tile.label }}</span>
          <span class="mt-1 block text-2xl font-semibold" [class]="tile.valueClass">
            {{ tile.value }}
          </span>
        </button>
      }
    </div>

    <ng-template #nameCell let-item>
      <div class="min-w-0">
        <p class="truncate font-medium text-surface-fg">{{ item.name }}</p>
        <p class="truncate font-mono text-xs text-surface-fg-muted">{{ item.code }}</p>
      </div>
    </ng-template>

    <ng-template #stockCell let-item>
      <div class="text-right">
        <p class="font-medium" [class]="quantityClass(item)">
          {{ item.quantityInStock }} <span class="text-xs font-normal">{{ item.unit }}</span>
        </p>
        <p class="text-xs text-surface-fg-muted">reorder at {{ item.reorderLevel }}</p>
      </div>
    </ng-template>

    <ng-template #statusCell let-item>
      <hms-badge [tone]="tone(item)">{{ statusLabel(item) }}</hms-badge>
    </ng-template>

    <ng-template #expiryCell let-item>
      @if (item.nearestExpiry === null) {
        <span class="text-xs text-surface-fg-muted">—</span>
      } @else {
        <span class="text-xs" [class]="expiryClass(item)">{{ expiryText(item) }}</span>
      }
    </ng-template>

    <hms-card [padded]="false">
      <div class="flex flex-wrap items-center gap-2 border-b border-surface-border p-3" role="search">
        <label class="relative min-w-0 flex-1 sm:max-w-xs">
          <span class="sr-only-focusable">Search inventory</span>
          <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-surface-fg-muted">
            <hms-icon name="search" [size]="16" />
          </span>
          <input
            type="search"
            placeholder="Name, code or supplier"
            class="h-9 w-full rounded-control bg-surface pl-9 pr-3 text-sm text-surface-fg ring-1 ring-inset ring-surface-border placeholder:text-surface-fg-muted focus:ring-2 focus:ring-brand-500"
            [value]="query().search"
            (input)="onSearch($event)"
          />
        </label>

        <label class="flex items-center gap-1.5">
          <span class="sr-only-focusable">Filter by category</span>
          <select
            class="h-9 rounded-control bg-surface px-2 text-sm text-surface-fg ring-1 ring-inset ring-surface-border focus:ring-2 focus:ring-brand-500"
            [value]="query().category"
            (change)="onCategoryChange($event)"
          >
            <option value="">All categories</option>
            @for (entry of categoryOptions; track entry.value) {
              <option [value]="entry.value">{{ entry.label }}</option>
            }
          </select>
        </label>

        <label class="flex items-center gap-1.5">
          <span class="sr-only-focusable">Filter by supplier</span>
          <select
            class="h-9 rounded-control bg-surface px-2 text-sm text-surface-fg ring-1 ring-inset ring-surface-border focus:ring-2 focus:ring-brand-500"
            [value]="query().supplierId"
            (change)="onSupplierChange($event)"
          >
            <option value="">All suppliers</option>
            @for (supplier of suppliers.suppliers(); track supplier.id) {
              <option [value]="supplier.id">{{ supplier.name }}</option>
            }
          </select>
        </label>

        @if (hasFilters()) {
          <hms-button variant="ghost" size="sm" (pressed)="inventory.resetQuery()">Clear</hms-button>
        }
      </div>

      <hms-data-table
        [rows]="rows()"
        [columns]="columns()"
        [trackBy]="trackById"
        [loading]="inventory.isLoading()"
        [ordering]="query().ordering"
        [selectable]="true"
        [rowLabel]="rowLabel"
        caption="Inventory items"
        emptyTitle="No items match these filters"
        (sortChanged)="onSort($event)"
        (rowActivated)="openItem($event)"
      />

      @if (page(); as currentPage) {
        <hms-pagination
          [page]="currentPage.page"
          [totalPages]="currentPage.totalPages"
          [total]="currentPage.total"
          [pageSize]="currentPage.pageSize"
          (pageChanged)="inventory.setPage($event)"
        />
      }
    </hms-card>
  `,
})
export class ItemListComponent {
  protected readonly inventory = inject(InventoryService);
  protected readonly suppliers = inject(SupplierService);
  private readonly permissions = inject(PermissionService);
  private readonly router = inject(Router);
  private readonly bdt = new BdtPipe();

  private readonly nameCell = viewChild<TemplateRef<CellContext<InventoryItem>>>('nameCell');
  private readonly stockCell = viewChild<TemplateRef<CellContext<InventoryItem>>>('stockCell');
  private readonly statusCell = viewChild<TemplateRef<CellContext<InventoryItem>>>('statusCell');
  private readonly expiryCell = viewChild<TemplateRef<CellContext<InventoryItem>>>('expiryCell');

  protected readonly query = this.inventory.query;
  protected readonly page = this.inventory.items;
  protected readonly canManage = this.permissions.hasPermission('inventory.manage');

  protected readonly categoryOptions = Object.entries(ITEM_CATEGORY_LABELS).map(
    ([value, label]) => ({ value, label }),
  );

  protected readonly rows = computed<readonly InventoryItem[]>(() => this.page()?.items ?? []);

  protected readonly hasFilters = computed(() => {
    const current = this.query();
    return (
      current.search !== '' ||
      current.category !== '' ||
      current.supplierId !== '' ||
      current.stock !== ''
    );
  });

  protected readonly alertTiles = computed(() => {
    const active = this.query().stock;
    return [
      {
        filter: 'out' as StockFilter,
        label: 'Out of stock',
        value: this.inventory.outOfStock().length,
        valueClass: 'text-status-critical-strong',
        class: 'bg-surface-raised ring-surface-border hover:bg-surface-sunken',
        activeClass: 'bg-status-critical-soft ring-status-critical/40',
        active: active === 'out',
      },
      {
        filter: 'low' as StockFilter,
        label: 'Below reorder level',
        value: this.inventory.lowStock().length,
        valueClass: 'text-status-pending-strong',
        class: 'bg-surface-raised ring-surface-border hover:bg-surface-sunken',
        activeClass: 'bg-status-pending-soft ring-status-pending/40',
        active: active === 'low',
      },
      {
        filter: 'expiring' as StockFilter,
        label: 'Expiring within 90 days',
        value: this.inventory.expiringSoon().length + this.inventory.expired().length,
        valueClass: 'text-status-pending-strong',
        class: 'bg-surface-raised ring-surface-border hover:bg-surface-sunken',
        activeClass: 'bg-status-pending-soft ring-status-pending/40',
        active: active === 'expiring',
      },
      {
        filter: '' as StockFilter,
        label: 'Stock value',
        value: this.bdt.transform(this.inventory.stockValue()),
        valueClass: 'text-surface-fg',
        class: 'bg-surface-raised ring-surface-border',
        activeClass: 'bg-surface-raised ring-surface-border',
        active: false,
      },
    ];
  });

  protected readonly columns = computed<readonly ColumnDef<InventoryItem>[]>(() => [
    {
      key: 'name',
      header: 'Item',
      template: this.nameCell(),
      cell: (item) => item.name,
      sortField: 'name',
    },
    {
      key: 'category',
      header: 'Category',
      cell: (item) => ITEM_CATEGORY_LABELS[item.category],
      sortField: 'category',
      hideOnMobile: true,
      width: '8rem',
    },
    {
      key: 'stock',
      header: 'In stock',
      template: this.stockCell(),
      cell: (item) => `${item.quantityInStock} ${item.unit}`,
      sortField: 'quantity_in_stock',
      align: 'right',
      width: '9rem',
    },
    {
      key: 'status',
      header: 'Status',
      template: this.statusCell(),
      cell: (item) => STOCK_STATUS_LABELS[stockStatus(item)],
      width: '9rem',
    },
    {
      key: 'expiry',
      header: 'Nearest expiry',
      template: this.expiryCell(),
      cell: (item) => item.nearestExpiry ?? '—',
      sortField: 'nearest_expiry',
      hideOnMobile: true,
    },
    {
      key: 'price',
      header: 'Unit price',
      cell: (item) => this.bdt.transform(item.unitPrice),
      sortField: 'unit_price',
      align: 'right',
      hideOnMobile: true,
    },
  ]);

  protected readonly trackById = (item: InventoryItem): number => item.id;
  protected readonly rowLabel = (item: InventoryItem): string => `Open ${item.name}`;

  protected tone(item: InventoryItem) {
    return stockStatusTone(stockStatus(item));
  }

  protected statusLabel(item: InventoryItem): string {
    return STOCK_STATUS_LABELS[stockStatus(item)];
  }

  protected quantityClass(item: InventoryItem): string {
    const status = stockStatus(item);
    if (status === 'out_of_stock') {
      return 'text-status-critical-strong';
    }
    return status === 'low_stock' ? 'text-status-pending-strong' : 'text-surface-fg';
  }

  protected expiryText(item: InventoryItem): string {
    const days = this.inventory.daysToExpiry(item);
    if (days === null) {
      return '—';
    }
    if (days < 0) {
      return `Expired ${Math.abs(days)}d ago`;
    }
    return days === 0 ? 'Expires today' : `${days}d left`;
  }

  protected expiryClass(item: InventoryItem): string {
    const days = this.inventory.daysToExpiry(item);
    if (days === null) {
      return 'text-surface-fg-muted';
    }
    if (days < 0) {
      return 'font-medium text-status-critical-strong';
    }
    return days <= 90 ? 'font-medium text-status-pending-strong' : 'text-surface-fg-muted';
  }

  protected toggleStockFilter(filter: StockFilter): void {
    if (filter === '') {
      return;
    }
    this.inventory.patchQuery({ stock: this.query().stock === filter ? '' : filter });
  }

  protected onSearch(event: Event): void {
    this.inventory.patchQuery({ search: (event.target as HTMLInputElement).value });
  }

  protected onCategoryChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.inventory.patchQuery({ category: value === '' ? '' : (value as ItemCategory) });
  }

  protected onSupplierChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.inventory.patchQuery({ supplierId: value === '' ? '' : Number(value) });
  }

  protected onSort(sort: SortState): void {
    this.inventory.patchQuery({ ordering: toOrdering(sort) });
  }

  protected async openItem(item: InventoryItem): Promise<void> {
    await this.router.navigate(['/app/inventory', item.id]);
  }

  protected async addItem(): Promise<void> {
    await this.router.navigate(['/app/inventory', 'new']);
  }
}
