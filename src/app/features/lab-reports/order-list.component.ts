import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  viewChild,
  type TemplateRef,
} from '@angular/core';
import { Router } from '@angular/router';
import { LabService } from './lab.service';
import { PermissionService } from '../../core/auth/permission.service';
import { CardComponent } from '../../shared/ui/card/card.component';
import { PageHeaderComponent } from '../../shared/ui/page-header/page-header.component';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { BadgeComponent } from '../../shared/ui/badge/badge.component';
import { DataTableComponent } from '../../shared/ui/data-table/data-table.component';
import { PaginationComponent } from '../../shared/ui/pagination/pagination.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { HmsDatePipe } from '../../shared/pipes/hms-pipes';
import {
  toOrdering,
  type CellContext,
  type ColumnDef,
  type SortState,
} from '../../shared/ui/data-table/data-table.model';
import {
  LAB_ORDER_STATUS_LABELS,
  labOrderTone,
  type LabOrder,
  type LabOrderStatus,
} from '../../shared/models/lab.model';

@Component({
  selector: 'hms-order-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
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
      heading="Lab & Diagnostics"
      description="Test orders, sample tracking and result entry."
    >
      @if (canOrder()) {
        <hms-button (pressed)="newOrder()">New order</hms-button>
      }
    </hms-page-header>

    <div class="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      @for (tile of tiles(); track tile.status) {
        <button
          type="button"
          class="rounded-card p-4 text-left ring-1 ring-inset transition-colors"
          [class]="
            query().status === tile.status
              ? 'bg-brand-50 ring-brand-500/40 dark:bg-brand-950'
              : 'bg-surface-raised ring-surface-border hover:bg-surface-sunken'
          "
          [attr.aria-pressed]="query().status === tile.status"
          (click)="toggleStatus(tile.status)"
        >
          <span class="block text-xs text-surface-fg-muted">{{ tile.label }}</span>
          <span class="mt-1 block text-2xl font-semibold" [class]="tile.valueClass">
            {{ tile.value }}
          </span>
        </button>
      }
    </div>

    <ng-template #orderCell let-order>
      <div class="min-w-0">
        <p class="truncate font-mono text-xs font-medium text-surface-fg">{{ order.orderNumber }}</p>
        <p class="truncate text-xs text-surface-fg-muted">{{ order.tests.length }} test(s)</p>
      </div>
    </ng-template>

    <ng-template #patientCell let-order>
      <div class="min-w-0">
        <p class="truncate text-sm text-surface-fg">{{ order.patientName }}</p>
        <p class="truncate font-mono text-xs text-surface-fg-muted">{{ order.patientMrn }}</p>
      </div>
    </ng-template>

    <ng-template #statusCell let-order>
      <div class="flex flex-wrap items-center gap-1.5">
        <hms-badge [tone]="tone(order)">{{ statusLabel(order) }}</hms-badge>
        @if (order.priority === 'urgent') {
          <hms-badge tone="critical" [dot]="false">Urgent</hms-badge>
        }
      </div>
    </ng-template>

    <hms-card [padded]="false">
      <div class="flex flex-wrap items-center gap-2 border-b border-surface-border p-3" role="search">
        <label class="relative min-w-0 flex-1 sm:max-w-xs">
          <span class="sr-only-focusable">Search lab orders</span>
          <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-surface-fg-muted">
            <hms-icon name="search" [size]="16" />
          </span>
          <input
            type="search"
            placeholder="Order no, patient or sample id"
            class="h-9 w-full rounded-control bg-surface pl-9 pr-3 text-sm text-surface-fg ring-1 ring-inset ring-surface-border placeholder:text-surface-fg-muted focus:ring-2 focus:ring-brand-500"
            [value]="query().search"
            (input)="onSearch($event)"
          />
        </label>

        <label class="flex items-center gap-1.5">
          <span class="sr-only-focusable">Filter by priority</span>
          <select
            class="h-9 rounded-control bg-surface px-2 text-sm text-surface-fg ring-1 ring-inset ring-surface-border focus:ring-2 focus:ring-brand-500"
            [value]="query().priority"
            (change)="onPriorityChange($event)"
          >
            <option value="">Any priority</option>
            <option value="urgent">Urgent</option>
            <option value="routine">Routine</option>
          </select>
        </label>
      </div>

      <hms-data-table
        [rows]="rows()"
        [columns]="columns()"
        [trackBy]="trackById"
        [loading]="lab.isLoading()"
        [ordering]="query().ordering"
        [selectable]="true"
        [rowLabel]="rowLabel"
        caption="Lab orders"
        emptyTitle="No orders match these filters"
        (sortChanged)="onSort($event)"
        (rowActivated)="openOrder($event)"
      />

      @if (page(); as currentPage) {
        <hms-pagination
          [page]="currentPage.page"
          [totalPages]="currentPage.totalPages"
          [total]="currentPage.total"
          [pageSize]="currentPage.pageSize"
          (pageChanged)="lab.setPage($event)"
        />
      }
    </hms-card>
  `,
})
export class OrderListComponent {
  protected readonly lab = inject(LabService);
  private readonly permissions = inject(PermissionService);
  private readonly router = inject(Router);
  private readonly datePipe = new HmsDatePipe();

  private readonly orderCell = viewChild<TemplateRef<CellContext<LabOrder>>>('orderCell');
  private readonly patientCell = viewChild<TemplateRef<CellContext<LabOrder>>>('patientCell');
  private readonly statusCell = viewChild<TemplateRef<CellContext<LabOrder>>>('statusCell');

  protected readonly query = this.lab.query;
  protected readonly page = this.lab.orders;
  protected readonly canOrder = this.permissions.hasPermission('lab.order');

  protected readonly rows = computed<readonly LabOrder[]>(() => this.page()?.items ?? []);

  protected readonly tiles = computed(() => [
    {
      status: 'ordered' as LabOrderStatus,
      label: 'Awaiting sample',
      value: this.lab.awaitingSample().length,
      valueClass: 'text-status-info-strong',
    },
    {
      status: 'sample_collected' as LabOrderStatus,
      label: 'Sample collected',
      value: this.lab.awaitingAnalysis().length,
      valueClass: 'text-status-pending-strong',
    },
    {
      status: 'in_progress' as LabOrderStatus,
      label: 'In progress',
      value: this.lab.inProgress().length,
      valueClass: 'text-status-pending-strong',
    },
    {
      status: '' as LabOrderStatus,
      label: 'Urgent outstanding',
      value: this.lab.urgentPending().length,
      valueClass: 'text-status-critical-strong',
    },
  ]);

  protected readonly columns = computed<readonly ColumnDef<LabOrder>[]>(() => [
    {
      key: 'order',
      header: 'Order',
      template: this.orderCell(),
      cell: (order) => order.orderNumber,
      sortField: 'order_number',
      width: '10rem',
    },
    {
      key: 'patient',
      header: 'Patient',
      template: this.patientCell(),
      cell: (order) => order.patientName,
      sortField: 'patient_name',
    },
    {
      key: 'tests',
      header: 'Tests',
      cell: (order) => order.tests.map((test) => test.name).join(', '),
      hideOnMobile: true,
    },
    {
      key: 'status',
      header: 'Status',
      template: this.statusCell(),
      cell: (order) => LAB_ORDER_STATUS_LABELS[order.status],
      width: '12rem',
    },
    {
      key: 'ordered',
      header: 'Ordered',
      cell: (order) => this.datePipe.transform(order.orderedAt, true),
      sortField: 'ordered_at',
      align: 'right',
      hideOnMobile: true,
    },
  ]);

  protected readonly trackById = (order: LabOrder): number => order.id;
  protected readonly rowLabel = (order: LabOrder): string =>
    `Open ${order.orderNumber} for ${order.patientName}`;

  protected tone(order: LabOrder) {
    return labOrderTone(order.status);
  }

  protected statusLabel(order: LabOrder): string {
    return LAB_ORDER_STATUS_LABELS[order.status];
  }

  protected toggleStatus(status: LabOrderStatus): void {
    if (status === ('' as LabOrderStatus)) {
      this.lab.patchQuery({ priority: this.query().priority === 'urgent' ? '' : 'urgent' });
      return;
    }
    this.lab.patchQuery({ status: this.query().status === status ? '' : status });
  }

  protected onSearch(event: Event): void {
    this.lab.patchQuery({ search: (event.target as HTMLInputElement).value });
  }

  protected onPriorityChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.lab.patchQuery({ priority: value === '' ? '' : (value as 'routine' | 'urgent') });
  }

  protected onSort(sort: SortState): void {
    this.lab.patchQuery({ ordering: toOrdering(sort) });
  }

  protected async openOrder(order: LabOrder): Promise<void> {
    await this.router.navigate(['/lab', order.id]);
  }

  protected async newOrder(): Promise<void> {
    await this.router.navigate(['/lab', 'new']);
  }
}
