import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { BillingService } from './billing.service';
import { PermissionService } from '../../core/auth/permission.service';
import { ToastService } from '../../core/services/toast.service';
import { toApiError } from '../../core/http/api-error';
import { CardComponent } from '../../shared/ui/card/card.component';
import { PageHeaderComponent } from '../../shared/ui/page-header/page-header.component';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { BadgeComponent } from '../../shared/ui/badge/badge.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { PaymentDialogComponent } from './payment-dialog.component';
import { BdtPipe, HmsDatePipe } from '../../shared/pipes/hms-pipes';
import {
  CHARGE_SOURCE_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  paymentTone,
  type Invoice,
  type InvoiceLineItem,
  type Payment,
} from '../../shared/models/billing.model';

@Component({
  selector: 'hms-invoice-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CardComponent,
    PageHeaderComponent,
    ButtonComponent,
    BadgeComponent,
    SkeletonComponent,
    EmptyStateComponent,
    PaymentDialogComponent,
    BdtPipe,
    HmsDatePipe,
  ],
  template: `
    @if (billing.isDetailLoading() && invoice() === undefined) {
      <hms-card><hms-skeleton [lines]="6" [height]="16" label="Loading invoice" /></hms-card>
    } @else if (invoice(); as record) {
      <div class="no-print">
        <hms-page-header
          [heading]="record.invoiceNumber"
          [description]="record.patientName + ' · ' + record.patientMrn"
        >
          <hms-button variant="secondary" (pressed)="print()">Print</hms-button>
          <hms-button variant="secondary" [loading]="downloading()" (pressed)="downloadPdf()">
            PDF
          </hms-button>
          @if (canManage() && record.amountDue > 0 && record.status !== 'cancelled') {
            <hms-button (pressed)="paying.set(true)">Record payment</hms-button>
          }
          @if (canManage() && record.amountPaid === 0 && record.status !== 'cancelled') {
            <hms-button variant="danger" [loading]="cancelling()" (pressed)="cancelInvoice()">
              Cancel
            </hms-button>
          }
        </hms-page-header>
      </div>

      <!-- Printable invoice body. -->
      <hms-card>
        <div class="flex flex-wrap items-start justify-between gap-4 border-b border-surface-border pb-4">
          <div>
            <h2 class="text-lg font-semibold text-surface-fg">Invoice</h2>
            <p class="mt-0.5 font-mono text-sm text-surface-fg-muted">{{ record.invoiceNumber }}</p>
            <p class="mt-2 text-sm text-surface-fg">{{ record.patientName }}</p>
            <p class="font-mono text-xs text-surface-fg-muted">{{ record.patientMrn }}</p>
          </div>
          <div class="text-right">
            <hms-badge [tone]="tone(record)">{{ statusLabel(record) }}</hms-badge>
            <p class="mt-2 text-xs text-surface-fg-muted">
              Issued {{ record.issuedAt | hmsDate }}
            </p>
            <p class="text-xs text-surface-fg-muted">Due {{ record.dueDate | hmsDate }}</p>
          </div>
        </div>

        <table class="mt-4 w-full text-sm">
          <caption class="sr-only-focusable">Charges on {{ record.invoiceNumber }}</caption>
          <thead>
            <tr class="border-b border-surface-border">
              <th scope="col" class="py-2 text-left text-xs font-semibold text-surface-fg-muted">
                Description
              </th>
              <th scope="col" class="hidden py-2 text-left text-xs font-semibold text-surface-fg-muted sm:table-cell">
                Category
              </th>
              <th scope="col" class="py-2 text-right text-xs font-semibold text-surface-fg-muted">
                Qty
              </th>
              <th scope="col" class="hidden py-2 text-right text-xs font-semibold text-surface-fg-muted sm:table-cell">
                Unit
              </th>
              <th scope="col" class="hidden py-2 text-right text-xs font-semibold text-surface-fg-muted sm:table-cell">
                Discount
              </th>
              <th scope="col" class="py-2 text-right text-xs font-semibold text-surface-fg-muted">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            @for (item of record.items; track item.id) {
              <tr class="border-b border-surface-border last:border-0">
                <td class="py-2.5 text-surface-fg">{{ item.description }}</td>
                <td class="hidden py-2.5 text-xs text-surface-fg-muted sm:table-cell">
                  {{ sourceLabel(item) }}
                </td>
                <td class="py-2.5 text-right text-surface-fg">{{ item.quantity }}</td>
                <td class="hidden py-2.5 text-right text-surface-fg-muted sm:table-cell">
                  {{ item.unitPrice | bdt }}
                </td>
                <td class="hidden py-2.5 text-right sm:table-cell" [class]="item.discount > 0 ? 'text-status-ready-strong' : 'text-surface-fg-muted'">
                  {{ item.discount > 0 ? ('−' + (item.discount | bdt)) : '—' }}
                </td>
                <td class="py-2.5 text-right font-medium text-surface-fg">
                  {{ item.lineTotal | bdt }}
                </td>
              </tr>
            }
          </tbody>
        </table>

        <dl class="mt-4 ml-auto max-w-xs space-y-1.5 text-sm">
          <div class="flex justify-between">
            <dt class="text-surface-fg-muted">Subtotal</dt>
            <dd class="text-surface-fg">{{ record.subtotal | bdt }}</dd>
          </div>
          @if (record.discountTotal > 0) {
            <div class="flex justify-between">
              <dt class="text-surface-fg-muted">Discount</dt>
              <dd class="text-status-ready-strong">−{{ record.discountTotal | bdt }}</dd>
            </div>
          }
          <div class="flex justify-between">
            <dt class="text-surface-fg-muted">VAT ({{ taxPercent() }}%)</dt>
            <dd class="text-surface-fg">{{ record.taxAmount | bdt }}</dd>
          </div>
          <div class="flex justify-between border-t border-surface-border pt-1.5 text-base font-semibold">
            <dt class="text-surface-fg">Total</dt>
            <dd class="text-surface-fg">{{ record.total | bdt }}</dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-surface-fg-muted">Paid</dt>
            <dd class="text-status-ready-strong">{{ record.amountPaid | bdt }}</dd>
          </div>
          <div class="flex justify-between text-base font-semibold">
            <dt class="text-surface-fg">Balance due</dt>
            <dd [class]="record.amountDue > 0 ? 'text-status-critical-strong' : 'text-status-ready-strong'">
              {{ record.amountDue | bdt }}
            </dd>
          </div>
        </dl>

        @if (record.notes !== '') {
          <p class="mt-4 border-t border-surface-border pt-3 text-xs text-surface-fg-muted">
            {{ record.notes }}
          </p>
        }
      </hms-card>

      <div class="no-print mt-4">
        <hms-card heading="Payments" [padded]="false">
          @if (record.payments.length === 0) {
            <hms-empty-state title="No payments recorded" [description]="null" />
          } @else {
            <ul role="list" class="divide-y divide-surface-border">
              @for (payment of record.payments; track payment.id) {
                <li class="flex items-center gap-3 px-5 py-3">
                  <div class="min-w-0 flex-1">
                    <p class="text-sm font-medium text-surface-fg">{{ payment.amount | bdt }}</p>
                    <p class="text-xs text-surface-fg-muted">
                      {{ methodLabel(payment) }} · {{ payment.receivedBy }}
                      @if (payment.reference !== null) {
                        · ref {{ payment.reference }}
                      }
                    </p>
                  </div>
                  <p class="text-xs text-surface-fg-muted">
                    {{ payment.receivedAt | hmsDate: true }}
                  </p>
                </li>
              }
            </ul>
          }
        </hms-card>
      </div>

      @if (paying()) {
        <hms-payment-dialog
          [invoice]="record"
          (closed)="paying.set(false)"
          (completed)="onPaymentRecorded($event)"
        />
      }
    } @else {
      <hms-card>
        <hms-empty-state title="Invoice not found" description="It may have been removed." />
      </hms-card>
    }
  `,
})
export class InvoiceDetailComponent {
  protected readonly billing = inject(BillingService);
  private readonly permissions = inject(PermissionService);
  private readonly toast = inject(ToastService);

  readonly id = input.required<string>();

  protected readonly invoice = this.billing.selectedInvoice;
  protected readonly canManage = this.permissions.hasPermission('billing.manage');
  protected readonly paying = signal(false);
  protected readonly cancelling = signal(false);
  protected readonly downloading = signal(false);

  constructor() {
    effect(() => {
      const parsed = Number(this.id());
      this.billing.select(Number.isFinite(parsed) ? parsed : null);
    });
  }

  protected readonly taxPercent = computed(() => {
    const record = this.invoice();
    return record === undefined ? 0 : Math.round(record.taxRate * 100);
  });

  protected tone(invoice: Invoice) {
    return paymentTone(invoice.status);
  }

  protected statusLabel(invoice: Invoice): string {
    return PAYMENT_STATUS_LABELS[invoice.status];
  }

  protected sourceLabel(item: InvoiceLineItem): string {
    return CHARGE_SOURCE_LABELS[item.source];
  }

  protected methodLabel(payment: Payment): string {
    return PAYMENT_METHOD_LABELS[payment.method];
  }

  protected print(): void {
    // The print stylesheet hides everything marked `no-print`.
    window.print();
  }

  protected async downloadPdf(): Promise<void> {
    const record = this.invoice();
    if (record === undefined) {
      return;
    }
    this.downloading.set(true);
    try {
      await this.billing.downloadPdf(record);
      this.toast.success('Download started', record.invoiceNumber);
    } catch (error: unknown) {
      this.toast.error('Could not download invoice', toApiError(error).message);
    } finally {
      this.downloading.set(false);
    }
  }

  protected async cancelInvoice(): Promise<void> {
    const record = this.invoice();
    if (record === undefined) {
      return;
    }
    this.cancelling.set(true);
    try {
      await this.billing.cancel(record.id);
      this.toast.success('Invoice cancelled', record.invoiceNumber);
    } catch {
      // The error interceptor has already explained why.
    } finally {
      this.cancelling.set(false);
    }
  }

  protected onPaymentRecorded(message: string): void {
    this.paying.set(false);
    this.toast.success('Payment recorded', message);
  }
}
