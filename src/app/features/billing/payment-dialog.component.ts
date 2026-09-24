import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormField, form, required, schema, submit, validate } from '@angular/forms/signals';
import { BillingService } from './billing.service';
import { toApiError, type ApiError } from '../../core/http/api-error';
import { ModalComponent } from '../../shared/ui/modal/modal.component';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { FormFieldComponent } from '../../shared/ui/form-field/form-field.component';
import { BdtPipe } from '../../shared/pipes/hms-pipes';
import {
  PAYMENT_METHOD_LABELS,
  type Invoice,
  type PaymentMethod,
} from '../../shared/models/billing.model';

interface PaymentModel {
  amount: string;
  method: PaymentMethod;
  reference: string;
}

const paymentSchema = schema<PaymentModel>((path) => {
  required(path.amount, { message: 'Enter an amount.' });
  validate(path.amount, ({ value }) => {
    const parsed = Number(value());
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return { kind: 'amount', message: 'Amount must be greater than 0.' };
    }
    return null;
  });
});

const INPUT_CLASS =
  'h-10 w-full rounded-control bg-surface px-3 text-sm text-surface-fg ring-1 ring-inset ring-surface-border focus:ring-2 focus:ring-brand-500';

@Component({
  selector: 'hms-payment-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormField, ModalComponent, ButtonComponent, FormFieldComponent, BdtPipe],
  template: `
    <hms-modal
      heading="Record payment"
      [description]="invoice().invoiceNumber + ' · ' + invoice().patientName"
      [busy]="saving()"
      (closed)="closed.emit()"
    >
      <div class="mb-4 rounded-control bg-surface-sunken px-3 py-2">
        <div class="flex justify-between text-sm">
          <span class="text-surface-fg-muted">Invoice total</span>
          <span class="text-surface-fg">{{ invoice().total | bdt }}</span>
        </div>
        <div class="flex justify-between text-sm">
          <span class="text-surface-fg-muted">Already paid</span>
          <span class="text-surface-fg">{{ invoice().amountPaid | bdt }}</span>
        </div>
        <div class="mt-1 flex justify-between border-t border-surface-border pt-1 text-sm font-semibold">
          <span class="text-surface-fg">Balance due</span>
          <span class="text-status-critical-strong">{{ invoice().amountDue | bdt }}</span>
        </div>
      </div>

      <div class="flex flex-col gap-4">
        <hms-form-field
          label="Amount"
          controlId="payment-amount"
          [field]="paymentForm.amount"
          [required]="true"
          [hint]="'Cannot exceed the outstanding balance.'"
          [serverError]="serverError('amount')"
        >
          <div class="flex gap-2">
            <input
              id="payment-amount"
              type="number"
              step="0.01"
              [class]="inputClass"
              [formField]="paymentForm.amount"
            />
            <!-- Settling in full is the common case; make it one click. -->
            <hms-button variant="secondary" size="md" (pressed)="payInFull()">Full</hms-button>
          </div>
        </hms-form-field>

        <hms-form-field label="Method" controlId="payment-method" [field]="paymentForm.method">
          <select id="payment-method" [class]="inputClass" [formField]="paymentForm.method">
            @for (entry of methodOptions; track entry.value) {
              <option [value]="entry.value">{{ entry.label }}</option>
            }
          </select>
        </hms-form-field>

        <hms-form-field
          label="Reference"
          controlId="payment-reference"
          [field]="paymentForm.reference"
          hint="Transaction id or receipt number, if any."
        >
          <input id="payment-reference" type="text" [class]="inputClass" [formField]="paymentForm.reference" />
        </hms-form-field>

        @if (generalError() !== null) {
          <p class="rounded-control bg-status-critical-soft px-3 py-2 text-xs text-status-critical-strong" role="alert">
            {{ generalError() }}
          </p>
        }
      </div>

      <div modal-footer class="contents">
        <hms-button variant="secondary" [disabled]="saving()" (pressed)="closed.emit()">
          Cancel
        </hms-button>
        <hms-button [loading]="saving()" (pressed)="onConfirm()">Record payment</hms-button>
      </div>
    </hms-modal>
  `,
})
export class PaymentDialogComponent {
  private readonly billing = inject(BillingService);

  readonly invoice = input.required<Invoice>();
  readonly closed = output<void>();
  readonly completed = output<string>();

  protected readonly inputClass = INPUT_CLASS;
  protected readonly saving = signal(false);
  private readonly error = signal<ApiError | null>(null);

  protected readonly methodOptions = Object.entries(PAYMENT_METHOD_LABELS).map(
    ([value, label]) => ({ value, label }),
  );

  private readonly model = signal<PaymentModel>({ amount: '', method: 'cash', reference: '' });
  protected readonly paymentForm = form(this.model, paymentSchema);

  protected readonly generalError = computed(() => {
    const current = this.error();
    return current === null || Object.keys(current.fieldErrors).length > 0 ? null : current.message;
  });

  protected serverError(field: string): string | null {
    return this.error()?.fieldErrors[field]?.[0] ?? null;
  }

  protected payInFull(): void {
    this.model.update((current) => ({ ...current, amount: this.invoice().amountDue.toFixed(2) }));
  }

  protected async onConfirm(): Promise<void> {
    this.error.set(null);

    await submit(this.paymentForm, async () => {
      this.saving.set(true);
      try {
        const current = this.model();
        const updated = await this.billing.recordPayment(this.invoice().id, current);
        this.completed.emit(
          updated.amountDue > 0
            ? `${updated.invoiceNumber} — ৳${updated.amountDue.toFixed(2)} still outstanding.`
            : `${updated.invoiceNumber} settled in full.`,
        );
        return null;
      } catch (caught: unknown) {
        const apiError = toApiError(caught);
        this.error.set(apiError);
        return { kind: 'server', message: apiError.message };
      } finally {
        this.saving.set(false);
      }
    });
  }
}
