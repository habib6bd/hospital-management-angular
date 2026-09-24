import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  viewChild,
  type TemplateRef,
} from '@angular/core';
import { Router } from '@angular/router';
import { BillingService } from './billing.service';
import { PermissionService } from '../../core/auth/permission.service';
import { CardComponent } from '../../shared/ui/card/card.component';
import { PageHeaderComponent } from '../../shared/ui/page-header/page-header.component';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { BadgeComponent } from '../../shared/ui/badge/badge.component';
import { DataTableComponent } from '../../shared/ui/data-table/data-table.component';
import { PaginationComponent } from '../../shared/ui/pagination/pagination.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { BdtPipe, HmsDatePipe } from '../../shared/pipes/hms-pipes';
import {
  toOrdering,
  type CellContext,
  type ColumnDef,
  type SortState,
} from '../../shared/ui/data-table/data-table.model';
import {
  PAYMENT_STATUS_LABELS,
  paymentTone,
  type Invoice,
  type PaymentStatus,
} from '../../shared/models/billing.model';

@Component({
  selector: 'hms-invoice-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CardComponent,
    PageHeaderComponent,
    ButtonComponent,
    BadgeComponent,
    DataTableComponent,
    PaginationComponent,
    IconComponent,
    BdtPipe,
  ],
  template: `
    <hms-page-header heading="Billing" description="Invoices, payments and outstanding balances.">
      @if (canManage()) {
        <hms-button (pressed)="newInvoice()">New invoice</hms-button>
      }
    </hms-page-header>

    @if (billing.summary(); as summary) {
      <div class="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div class="rounded-card bg-surface-raised p-4 ring-1 ring-surface-border ring-inset">
          <p class="text-xs text-surface-fg-muted">Billed</p>
          <p class="mt-1 text-xl font-semibold text-surface-fg">{{ summary.totalBilled | bdt }}</p>
        </div>
        <div class="rounded-card bg-surface-raised p-4 ring-1 ring-surface-border ring-inset">
          <p class="text-xs text-surface-fg-muted">Collected</p>
          <p class="mt-1 text-xl font-semibold text-status-ready-strong">
            {{ summary.totalCollected | bdt }}
          </p>
          <p class="mt-0.5 text-xs text-surface-fg-muted">
            {{ collectionPercent() }}% of billed
          </p>
        </div>
        <div class="rounded-card bg-surface-raised p-4 ring-1 ring-surface-border ring-inset">
          <p class="text-xs text-surface-fg-muted">Outstanding</p>
          <p class="mt-1 text-xl font-semibold text-status-pending-strong">
            {{ summary.totalOutstanding | bdt }}
          </p>
        </div>
        <button
          type="button"
          class="rounded-card p-4 text-left ring-1 ring-inset transition-colors"
          [class]="
            query().overdue
              ? 'bg-status-critical-soft ring-status-critical/40'
              : 'bg-surface-raised ring-surface-border hover:bg-surface-sunken'
          "
          [attr.aria-pressed]="query().overdue"
          (click)="toggleOverdue()"
        >
          <span class="block text-xs text-surface-fg-muted">Overdue invoices</span>
          <span class="mt-1 block text-xl font-semibold text-status-critical-strong">
            {{ summary.overdueCount }}
          </span>
        </button>
      </div>
    }

    <ng-template #invoiceCell let-invoice>
      <div class="min-w-0">
        <p class="truncate font-mono text-xs font-medium text-surface-fg">
          {{ invoice.invoiceNumber }}
        </p>
        <p class="truncate text-xs text-surface-fg-muted">{{ invoice.items.length }} item(s)</p>
      </div>
    </ng-template>

    <ng-template #patientCell let-invoice>
      <div class="min-w-0">
        <p class="truncate text-sm text-surface-fg">{{ invoice.patientName }}</p>
        <p class="truncate font-mono text-xs text-surface-fg-muted">{{ invoice.patientMrn }}</p>
      </div>
    </ng-template>

    <ng-template #statusCell let-invoice>
      <div class="flex flex-wrap items-center gap-1.5">
        <hms-badge [tone]="tone(invoice)">{{ statusLabel(invoice) }}</hms-badge>
        @if (isOverdue(invoice)) {
          <hms-badge tone="critical" [dot]="false">Overdue</hms-badge>
        }
      </div>
    </ng-template>

    <ng-template #dueCell let-invoice>
      <span class="font-medium" [class]="invoice.amountDue > 0 ? 'text-status-critical-strong' : 'text-surface-fg-muted'">
        {{ invoice.amountDue | bdt }}
      </span>
    </ng-template>

    <hms-card [padded]="false">
      <div class="flex flex-wrap items-center gap-2 border-b border-surface-border p-3" role="search">
        <label class="relative min-w-0 flex-1 sm:max-w-xs">
          <span class="sr-only-focusable">Search invoices</span>
          <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-surface-fg-muted">
            <hms-icon name="search" [size]="16" />
          </span>
          <input
            type="search"
            placeholder="Invoice no, patient or MRN"
            class="h-9 w-full rounded-control bg-surface pl-9 pr-3 text-sm text-surface-fg ring-1 ring-inset ring-surface-border placeholder:text-surface-fg-muted focus:ring-2 focus:ring-brand-500"
            [value]="query().search"
            (input)="onSearch($event)"
          />
        </label>

        <label class="flex items-center gap-1.5">
          <span class="sr-only-focusable">Filter by payment status</span>
          <select
            class="h-9 rounded-control bg-surface px-2 text-sm text-surface-fg ring-1 ring-inset ring-surface-border focus:ring-2 focus:ring-brand-500"
            [value]="query().status"
            (change)="onStatusChange($event)"
          >
            <option value="">Any status</option>
            @for (entry of statusOptions; track entry.value) {
              <option [value]="entry.value">{{ entry.label }}</option>
            }
          </select>
        </label>

        @if (hasFilters()) {
          <hms-button variant="ghost" size="sm" (pressed)="billing.resetQuery()">Clear</hms-button>
        }
      </div>

      <hms-data-table
        [rows]="rows()"
        [columns]="columns()"
        [trackBy]="trackById"
        [loading]="billing.isLoading()"
        [ordering]="query().ordering"
        [selectable]="true"
        [rowLabel]="rowLabel"
        caption="Invoices"
        emptyTitle="No invoices match these filters"
        (sortChanged)="onSort($event)"
        (rowActivated)="openInvoice($event)"
      />

      @if (page(); as currentPage) {
        <hms-pagination
          [page]="currentPage.page"
          [totalPages]="currentPage.totalPages"
          [total]="currentPage.total"
          [pageSize]="currentPage.pageSize"
          (pageChanged)="billing.setPage($event)"
        />
      }
    </hms-card>
  `,
})
export class InvoiceListComponent {
  protected readonly billing = inject(BillingService);
  private readonly permissions = inject(PermissionService);
  private readonly router = inject(Router);
  private readonly bdt = new BdtPipe();
  private readonly datePipe = new HmsDatePipe();

  private readonly invoiceCell = viewChild<TemplateRef<CellContext<Invoice>>>('invoiceCell');
  private readonly patientCell = viewChild<TemplateRef<CellContext<Invoice>>>('patientCell');
  private readonly statusCell = viewChild<TemplateRef<CellContext<Invoice>>>('statusCell');
  private readonly dueCell = viewChild<TemplateRef<CellContext<Invoice>>>('dueCell');

  protected readonly query = this.billing.query;
  protected readonly page = this.billing.invoices;
  protected readonly canManage = this.permissions.hasPermission('billing.manage');

  protected readonly statusOptions = Object.entries(PAYMENT_STATUS_LABELS).map(
    ([value, label]) => ({ value, label }),
  );

  protected readonly rows = computed<readonly Invoice[]>(() => this.page()?.items ?? []);

  protected readonly collectionPercent = computed(() =>
    Math.round(this.billing.collectionRate() * 100),
  );

  protected readonly hasFilters = computed(() => {
    const current = this.query();
    return current.search !== '' || current.status !== '' || current.overdue;
  });

  protected readonly columns = computed<readonly ColumnDef<Invoice>[]>(() => [
    {
      key: 'invoice',
      header: 'Invoice',
      template: this.invoiceCell(),
      cell: (invoice) => invoice.invoiceNumber,
      sortField: 'invoice_number',
      width: '11rem',
    },
    {
      key: 'patient',
      header: 'Patient',
      template: this.patientCell(),
      cell: (invoice) => invoice.patientName,
      sortField: 'patient_name',
    },
    {
      key: 'total',
      header: 'Total',
      cell: (invoice) => this.bdt.transform(invoice.total),
      align: 'right',
      hideOnMobile: true,
    },
    {
      key: 'due',
      header: 'Due',
      template: this.dueCell(),
      cell: (invoice) => this.bdt.transform(invoice.amountDue),
      align: 'right',
    },
    {
      key: 'status',
      header: 'Status',
      template: this.statusCell(),
      cell: (invoice) => PAYMENT_STATUS_LABELS[invoice.status],
      width: '11rem',
    },
    {
      key: 'dueDate',
      header: 'Due date',
      cell: (invoice) => this.datePipe.transform(invoice.dueDate),
      sortField: 'due_date',
      align: 'right',
      hideOnMobile: true,
    },
  ]);

  protected readonly trackById = (invoice: Invoice): number => invoice.id;
  protected readonly rowLabel = (invoice: Invoice): string =>
    `Open ${invoice.invoiceNumber} for ${invoice.patientName}`;

  protected tone(invoice: Invoice) {
    return paymentTone(invoice.status);
  }

  protected statusLabel(invoice: Invoice): string {
    return PAYMENT_STATUS_LABELS[invoice.status];
  }

  /** Past the due date with money still owed. */
  protected isOverdue(invoice: Invoice): boolean {
    if (invoice.amountDue <= 0 || invoice.status === 'cancelled' || invoice.status === 'draft') {
      return false;
    }
    return invoice.dueDate < new Date().toLocaleDateString('en-CA');
  }

  protected toggleOverdue(): void {
    this.billing.patchQuery({ overdue: !this.query().overdue });
  }

  protected onSearch(event: Event): void {
    this.billing.patchQuery({ search: (event.target as HTMLInputElement).value });
  }

  protected onStatusChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.billing.patchQuery({ status: value === '' ? '' : (value as PaymentStatus) });
  }

  protected onSort(sort: SortState): void {
    this.billing.patchQuery({ ordering: toOrdering(sort) });
  }

  protected async openInvoice(invoice: Invoice): Promise<void> {
    await this.router.navigate(['/billing', invoice.id]);
  }

  protected async newInvoice(): Promise<void> {
    await this.router.navigate(['/billing', 'new']);
  }
}
