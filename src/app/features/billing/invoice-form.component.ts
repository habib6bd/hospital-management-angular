import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { BillingService } from './billing.service';
import { PatientService } from '../patients/patient.service';
import { ToastService } from '../../core/services/toast.service';
import { toApiError, type ApiError } from '../../core/http/api-error';
import { CardComponent } from '../../shared/ui/card/card.component';
import { PageHeaderComponent } from '../../shared/ui/page-header/page-header.component';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { BdtPipe } from '../../shared/pipes/hms-pipes';
import {
  CHARGE_SOURCE_LABELS,
  computeTotals,
  type ChargeSource,
  type InvoiceLineInput,
} from '../../shared/models/billing.model';

const DEFAULT_TAX_RATE = 0.05;

function emptyLine(): InvoiceLineInput {
  return { source: 'consultation', description: '', quantity: '1', unitPrice: '', discount: '' };
}

const INPUT_CLASS =
  'h-9 w-full rounded-control bg-surface px-2 text-sm text-surface-fg ring-1 ring-inset ring-surface-border focus:ring-2 focus:ring-brand-500';

/**
 * Line items are a plain signal array rather than a Signal Form: rows are added
 * and removed at runtime and the only rules are per-field numeric checks, which
 * read more clearly here than as a dynamically rebuilt schema.
 *
 * Totals use `computeTotals` — the same function the invoice detail view and
 * the DTO mapper use — so the preview here matches the saved invoice exactly.
 */
@Component({
  selector: 'hms-invoice-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardComponent, PageHeaderComponent, ButtonComponent, BdtPipe],
  template: `
    <hms-page-header heading="New invoice" description="Build a bill from consultation, admission, pharmacy and lab charges." />

    <form (submit)="onSubmit($event)" class="flex flex-col gap-4">
      <hms-card heading="Patient">
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="block">
            <span class="text-xs font-medium text-surface-fg">Search patient</span>
            <input
              type="search"
              placeholder="Name or MRN"
              class="mt-1.5 h-10 w-full rounded-control bg-surface px-3 text-sm text-surface-fg ring-1 ring-inset ring-surface-border focus:ring-2 focus:ring-brand-500"
              (input)="onPatientSearch($event)"
            />
          </label>

          <label class="block">
            <span class="text-xs font-medium text-surface-fg">
              Patient <span class="text-status-critical" aria-hidden="true">*</span>
            </span>
            <select
              class="mt-1.5 h-10 w-full rounded-control bg-surface px-3 text-sm text-surface-fg ring-1 ring-inset ring-surface-border focus:ring-2 focus:ring-brand-500"
              [value]="patientId()"
              (change)="patientId.set($any($event.target).value)"
            >
              <option value="">Select a patient</option>
              @for (patient of patientOptions(); track patient.id) {
                <option [value]="patient.id">{{ patient.fullName }} — {{ patient.mrn }}</option>
              }
            </select>
          </label>

          <label class="block">
            <span class="text-xs font-medium text-surface-fg">Due date</span>
            <input
              type="date"
              class="mt-1.5 h-10 w-full rounded-control bg-surface px-3 text-sm text-surface-fg ring-1 ring-inset ring-surface-border focus:ring-2 focus:ring-brand-500"
              [value]="dueDate()"
              (input)="dueDate.set($any($event.target).value)"
            />
          </label>

          <label class="block">
            <span class="text-xs font-medium text-surface-fg">VAT rate (%)</span>
            <input
              type="number"
              step="0.5"
              class="mt-1.5 h-10 w-full rounded-control bg-surface px-3 text-sm text-surface-fg ring-1 ring-inset ring-surface-border focus:ring-2 focus:ring-brand-500"
              [value]="taxPercent()"
              (input)="onTaxInput($event)"
            />
          </label>
        </div>

        @if (serverError('patient') !== null) {
          <p class="mt-2 text-xs text-status-critical-strong" role="alert">
            {{ serverError('patient') }}
          </p>
        }
      </hms-card>

      <hms-card heading="Charges" [padded]="false">
        <span card-actions>
          <hms-button variant="secondary" size="sm" (pressed)="addLine()">Add line</hms-button>
        </span>

        <div class="hms-scrollbar overflow-x-auto">
          <table class="w-full min-w-[46rem] text-sm">
            <caption class="sr-only-focusable">Invoice line items</caption>
            <thead>
              <tr class="border-b border-surface-border bg-surface-sunken/60 text-left">
                <th scope="col" class="px-3 py-2 text-xs font-semibold text-surface-fg-muted">Category</th>
                <th scope="col" class="px-3 py-2 text-xs font-semibold text-surface-fg-muted">Description</th>
                <th scope="col" class="px-3 py-2 text-right text-xs font-semibold text-surface-fg-muted">Qty</th>
                <th scope="col" class="px-3 py-2 text-right text-xs font-semibold text-surface-fg-muted">Unit price</th>
                <th scope="col" class="px-3 py-2 text-right text-xs font-semibold text-surface-fg-muted">Discount</th>
                <th scope="col" class="px-3 py-2 text-right text-xs font-semibold text-surface-fg-muted">Amount</th>
                <th scope="col" class="px-3 py-2"><span class="sr-only-focusable">Remove</span></th>
              </tr>
            </thead>
            <tbody>
              @for (row of rows(); track row.index) {
                <tr class="border-b border-surface-border last:border-0">
                  <td class="px-3 py-2">
                    <select
                      [class]="inputClass"
                      [attr.aria-label]="'Category for line ' + (row.index + 1)"
                      [value]="row.line.source"
                      (change)="updateLine(row.index, 'source', $any($event.target).value)"
                    >
                      @for (entry of sourceOptions; track entry.value) {
                        <option [value]="entry.value">{{ entry.label }}</option>
                      }
                    </select>
                  </td>
                  <td class="px-3 py-2">
                    <input
                      type="text"
                      [class]="inputClass"
                      [attr.aria-label]="'Description for line ' + (row.index + 1)"
                      [attr.aria-invalid]="lineError(row.index, 'description') !== null ? 'true' : null"
                      [value]="row.line.description"
                      (input)="updateLine(row.index, 'description', $any($event.target).value)"
                    />
                    @if (lineError(row.index, 'description'); as message) {
                      <p class="mt-1 text-xs text-status-critical-strong" role="alert">{{ message }}</p>
                    }
                  </td>
                  <td class="px-3 py-2">
                    <input
                      type="number"
                      step="1"
                      class="h-9 w-20 rounded-control bg-surface px-2 text-right text-sm text-surface-fg ring-1 ring-inset ring-surface-border focus:ring-2 focus:ring-brand-500"
                      [attr.aria-label]="'Quantity for line ' + (row.index + 1)"
                      [value]="row.line.quantity"
                      (input)="updateLine(row.index, 'quantity', $any($event.target).value)"
                    />
                  </td>
                  <td class="px-3 py-2">
                    <input
                      type="number"
                      step="0.01"
                      class="h-9 w-28 rounded-control bg-surface px-2 text-right text-sm text-surface-fg ring-1 ring-inset ring-surface-border focus:ring-2 focus:ring-brand-500"
                      [attr.aria-label]="'Unit price for line ' + (row.index + 1)"
                      [value]="row.line.unitPrice"
                      (input)="updateLine(row.index, 'unitPrice', $any($event.target).value)"
                    />
                  </td>
                  <td class="px-3 py-2">
                    <input
                      type="number"
                      step="0.01"
                      class="h-9 w-24 rounded-control bg-surface px-2 text-right text-sm text-surface-fg ring-1 ring-inset ring-surface-border focus:ring-2 focus:ring-brand-500"
                      [attr.aria-label]="'Discount for line ' + (row.index + 1)"
                      [value]="row.line.discount"
                      (input)="updateLine(row.index, 'discount', $any($event.target).value)"
                    />
                    @if (lineError(row.index, 'discount'); as message) {
                      <p class="mt-1 text-xs text-status-critical-strong" role="alert">{{ message }}</p>
                    }
                  </td>
                  <td class="px-3 py-2 text-right font-medium text-surface-fg">
                    {{ row.amount | bdt }}
                  </td>
                  <td class="px-3 py-2 text-right">
                    <button
                      type="button"
                      class="rounded p-1 text-surface-fg-muted transition-colors hover:bg-surface-sunken hover:text-status-critical-strong disabled:opacity-40"
                      [disabled]="rows().length === 1"
                      [attr.aria-label]="'Remove line ' + (row.index + 1)"
                      (click)="removeLine(row.index)"
                    >
                      <svg class="size-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                      </svg>
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <dl class="ml-auto max-w-xs space-y-1.5 border-t border-surface-border p-5 text-sm">
          <div class="flex justify-between">
            <dt class="text-surface-fg-muted">Subtotal</dt>
            <dd class="text-surface-fg">{{ totals().subtotal | bdt }}</dd>
          </div>
          @if (totals().discountTotal > 0) {
            <div class="flex justify-between">
              <dt class="text-surface-fg-muted">Discount</dt>
              <dd class="text-status-ready-strong">−{{ totals().discountTotal | bdt }}</dd>
            </div>
          }
          <div class="flex justify-between">
            <dt class="text-surface-fg-muted">VAT ({{ taxPercent() }}%)</dt>
            <dd class="text-surface-fg">{{ totals().taxAmount | bdt }}</dd>
          </div>
          <div class="flex justify-between border-t border-surface-border pt-1.5 text-base font-semibold">
            <dt class="text-surface-fg">Total</dt>
            <dd class="text-surface-fg">{{ totals().total | bdt }}</dd>
          </div>
        </dl>
      </hms-card>

      <div class="flex items-center justify-end gap-2">
        <hms-button variant="secondary" (pressed)="cancel()">Cancel</hms-button>
        <hms-button type="submit" [loading]="saving()" [disabled]="!canSubmit()">
          Create invoice
        </hms-button>
      </div>
    </form>
  `,
})
export class InvoiceFormComponent {
  private readonly billing = inject(BillingService);
  private readonly patients = inject(PatientService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly inputClass = INPUT_CLASS;
  protected readonly patientId = signal('');
  protected readonly dueDate = signal('');
  protected readonly taxPercent = signal(DEFAULT_TAX_RATE * 100);
  protected readonly lines = signal<readonly InvoiceLineInput[]>([emptyLine()]);
  protected readonly saving = signal(false);
  private readonly submitError = signal<ApiError | null>(null);

  protected readonly sourceOptions = Object.entries(CHARGE_SOURCE_LABELS).map(
    ([value, label]) => ({ value, label }),
  );

  protected readonly patientOptions = computed(() => this.patients.patients()?.items ?? []);

  private readonly parsedLines = computed(() =>
    this.lines().map((line) => ({
      quantity: Math.max(0, Math.trunc(Number(line.quantity) || 0)),
      unitPrice: Math.max(0, Number(line.unitPrice) || 0),
      discount: Math.max(0, Number(line.discount) || 0),
    })),
  );

  protected readonly rows = computed(() =>
    this.lines().map((line, index) => {
      const parsed = this.parsedLines()[index]!;
      return {
        index,
        line,
        amount: Math.max(0, parsed.quantity * parsed.unitPrice - parsed.discount),
      };
    }),
  );

  protected readonly totals = computed(() =>
    computeTotals(this.parsedLines(), this.taxPercent() / 100),
  );

  protected readonly canSubmit = computed(
    () =>
      this.patientId() !== '' &&
      this.lines().length > 0 &&
      this.lines().every((line) => line.description.trim() !== '' && Number(line.unitPrice) >= 0) &&
      this.totals().total > 0,
  );

  protected serverError(field: string): string | null {
    return this.submitError()?.fieldErrors[field]?.[0] ?? null;
  }

  /** DRF returns nested errors as `items.0.description`. */
  protected lineError(index: number, field: string): string | null {
    return this.submitError()?.fieldErrors[`items.${index}.${field}`]?.[0] ?? null;
  }

  protected onPatientSearch(event: Event): void {
    this.patients.patchQuery({ search: (event.target as HTMLInputElement).value });
  }

  protected onTaxInput(event: Event): void {
    const parsed = Number((event.target as HTMLInputElement).value);
    this.taxPercent.set(Number.isFinite(parsed) && parsed >= 0 ? parsed : 0);
  }

  protected addLine(): void {
    this.lines.update((current) => [...current, emptyLine()]);
  }

  protected removeLine(index: number): void {
    this.lines.update((current) => current.filter((_, i) => i !== index));
  }

  protected updateLine(index: number, field: keyof InvoiceLineInput, value: string): void {
    this.lines.update((current) =>
      current.map((line, i) =>
        i === index ? { ...line, [field]: field === 'source' ? (value as ChargeSource) : value } : line,
      ),
    );
  }

  protected async cancel(): Promise<void> {
    await this.router.navigate(['/billing']);
  }

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.canSubmit()) {
      return;
    }

    this.submitError.set(null);
    this.saving.set(true);
    try {
      const invoice = await this.billing.create({
        patientId: Number(this.patientId()),
        items: this.lines(),
        taxRate: this.taxPercent() / 100,
        dueDate: this.dueDate(),
        notes: '',
      });
      this.toast.success('Invoice created', `${invoice.invoiceNumber} · ${invoice.patientName}`);
      await this.router.navigate(['/billing', invoice.id]);
    } catch (error: unknown) {
      this.submitError.set(toApiError(error));
    } finally {
      this.saving.set(false);
    }
  }
}
