import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { BillingService } from '../billing/billing.service';
import { ToastService } from '../../core/services/toast.service';
import { toApiError } from '../../core/http/api-error';
import { CardComponent } from '../../shared/ui/card/card.component';
import { PageHeaderComponent } from '../../shared/ui/page-header/page-header.component';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { BadgeComponent } from '../../shared/ui/badge/badge.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { BdtPipe, HmsDatePipe } from '../../shared/pipes/hms-pipes';
import {
  PAYMENT_STATUS_LABELS,
  paymentTone,
  type Invoice,
} from '../../shared/models/billing.model';

/**
 * The patient's own bills. It reuses `BillingService`: the invoice list endpoint
 * already restricts a patient token to that patient's own rows server-side, so
 * no separate portal endpoint is needed and the two views cannot drift apart.
 */
@Component({
  selector: 'hms-portal-billing',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CardComponent,
    PageHeaderComponent,
    ButtonComponent,
    BadgeComponent,
    SkeletonComponent,
    EmptyStateComponent,
    BdtPipe,
    HmsDatePipe,
  ],
  template: `
    <hms-page-header heading="My bills" description="Invoices issued to you and what remains to pay." />

    @if (billing.isLoading() && rows().length === 0) {
      <hms-card><hms-skeleton [lines]="5" [height]="20" label="Loading your bills" /></hms-card>
    } @else {
      @if (totalDue() > 0) {
        <div class="mb-4 rounded-card bg-status-critical-soft p-4 ring-1 ring-inset ring-status-critical/30">
          <p class="text-xs text-surface-fg-muted">Total outstanding</p>
          <p class="mt-1 text-2xl font-semibold text-status-critical-strong">
            {{ totalDue() | bdt }}
          </p>
          <p class="mt-1 text-xs text-surface-fg-muted">
            Payments are taken at the hospital billing counter.
          </p>
        </div>
      }

      <hms-card [padded]="false">
        @if (rows().length === 0) {
          <hms-empty-state title="No bills yet" description="Invoices appear here once issued." />
        } @else {
          <ul role="list" class="divide-y divide-surface-border">
            @for (invoice of rows(); track invoice.id) {
              <li class="flex flex-wrap items-start gap-4 px-5 py-4">
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <p class="font-mono text-sm font-medium text-surface-fg">
                      {{ invoice.invoiceNumber }}
                    </p>
                    <hms-badge [tone]="tone(invoice)">{{ statusLabel(invoice) }}</hms-badge>
                  </div>
                  <p class="mt-0.5 text-xs text-surface-fg-muted">
                    Issued {{ invoice.issuedAt | hmsDate }} · due {{ invoice.dueDate | hmsDate }} ·
                    {{ invoice.items.length }} item(s)
                  </p>
                </div>

                <div class="text-right">
                  <p class="text-sm font-semibold text-surface-fg">{{ invoice.total | bdt }}</p>
                  @if (invoice.amountDue > 0) {
                    <p class="text-xs text-status-critical-strong">
                      {{ invoice.amountDue | bdt }} due
                    </p>
                  } @else {
                    <p class="text-xs text-status-ready-strong">Settled</p>
                  }
                </div>

                <hms-button
                  variant="secondary"
                  size="sm"
                  [loading]="downloadingId() === invoice.id"
                  [disabled]="downloadingId() !== null"
                  (pressed)="download(invoice)"
                >
                  PDF
                </hms-button>
              </li>
            }
          </ul>
        }
      </hms-card>
    }
  `,
})
export class PortalBillingComponent {
  protected readonly billing = inject(BillingService);
  private readonly toast = inject(ToastService);

  protected readonly downloadingId = signal<number | null>(null);

  protected readonly rows = computed<readonly Invoice[]>(
    () => this.billing.invoices()?.items ?? [],
  );

  protected readonly totalDue = computed(() =>
    this.rows().reduce((sum, invoice) => sum + invoice.amountDue, 0),
  );

  protected tone(invoice: Invoice) {
    return paymentTone(invoice.status);
  }

  protected statusLabel(invoice: Invoice): string {
    return PAYMENT_STATUS_LABELS[invoice.status];
  }

  protected async download(invoice: Invoice): Promise<void> {
    this.downloadingId.set(invoice.id);
    try {
      await this.billing.downloadPdf(invoice);
      this.toast.success('Download started', invoice.invoiceNumber);
    } catch (error: unknown) {
      this.toast.error('Could not download invoice', toApiError(error).message);
    } finally {
      this.downloadingId.set(null);
    }
  }
}
