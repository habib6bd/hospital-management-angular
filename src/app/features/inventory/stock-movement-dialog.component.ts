import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormField, form, required, schema, submit, validate } from '@angular/forms/signals';
import { InventoryService } from './inventory.service';
import { toApiError, type ApiError } from '../../core/http/api-error';
import { ModalComponent } from '../../shared/ui/modal/modal.component';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { FormFieldComponent } from '../../shared/ui/form-field/form-field.component';
import { inFuture } from '../../shared/validators/hms-validators';
import {
  MOVEMENT_LABELS,
  type InventoryItem,
  type MovementType,
} from '../../shared/models/inventory.model';

interface MovementModel {
  type: MovementType;
  quantity: string;
  batchNumber: string;
  expiryDate: string;
  reason: string;
}

// The quantity bound is enforced here, not with a native `min` attribute:
// Signal Forms owns `min`/`max` on a `[formField]` control.
const movementSchema = schema<MovementModel>((path) => {
  required(path.quantity, { message: 'Enter a quantity.' });
  validate(path.quantity, ({ value }) => {
    const parsed = Number(value());
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return { kind: 'quantity', message: 'Quantity must be greater than 0.' };
    }
    if (!Number.isInteger(parsed)) {
      return { kind: 'quantity', message: 'Quantity must be a whole number.' };
    }
    return null;
  });
  inFuture(path.expiryDate, 'Expiry date');
});

const INPUT_CLASS =
  'h-10 w-full rounded-control bg-surface px-3 text-sm text-surface-fg ring-1 ring-inset ring-surface-border focus:ring-2 focus:ring-brand-500';

@Component({
  selector: 'hms-stock-movement-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormField, ModalComponent, ButtonComponent, FormFieldComponent],
  template: `
    <hms-modal
      heading="Record stock movement"
      [description]="item().name + ' · ' + item().quantityInStock + ' ' + item().unit + ' on hand'"
      [busy]="saving()"
      (closed)="closed.emit()"
    >
      <div class="flex flex-col gap-4">
        <hms-form-field
          label="Movement type"
          controlId="movement-type"
          [field]="movementForm.type"
          [required]="true"
        >
          <select id="movement-type" [class]="inputClass" [formField]="movementForm.type">
            @for (entry of typeOptions; track entry.value) {
              <option [value]="entry.value">{{ entry.label }}</option>
            }
          </select>
        </hms-form-field>

        <hms-form-field
          label="Quantity"
          controlId="movement-quantity"
          [field]="movementForm.quantity"
          [required]="true"
          [hint]="quantityHint()"
          [serverError]="serverError('quantity')"
        >
          <input
            id="movement-quantity"
            type="number"
            step="1"
            [class]="inputClass"
            [formField]="movementForm.quantity"
          />
        </hms-form-field>

        <!-- Batch and expiry only make sense when stock is coming in. -->
        @if (isInbound()) {
          <hms-form-field
            label="Batch number"
            controlId="movement-batch"
            [field]="movementForm.batchNumber"
            hint="Leave blank to generate one automatically."
          >
            <input id="movement-batch" type="text" [class]="inputClass" [formField]="movementForm.batchNumber" />
          </hms-form-field>

          <hms-form-field
            label="Expiry date"
            controlId="movement-expiry"
            [field]="movementForm.expiryDate"
            hint="Leave blank for items that do not expire."
          >
            <input id="movement-expiry" type="date" [class]="inputClass" [formField]="movementForm.expiryDate" />
          </hms-form-field>
        } @else {
          <p class="rounded-control bg-surface-sunken px-3 py-2 text-xs text-surface-fg-muted">
            Stock is taken from the batch expiring soonest.
          </p>
        }

        <hms-form-field label="Reason" controlId="movement-reason" [field]="movementForm.reason">
          <input id="movement-reason" type="text" [class]="inputClass" [formField]="movementForm.reason" />
        </hms-form-field>

        @if (generalError() !== null) {
          <p class="rounded-control bg-status-critical-soft px-3 py-2 text-xs text-status-critical-strong" role="alert">
            {{ generalError() }}
          </p>
        }
      </div>

      <div modal-footer class="contents">
        <hms-button variant="secondary" [disabled]="saving()" (pressed)="closed.emit()">Cancel</hms-button>
        <hms-button [loading]="saving()" (pressed)="onConfirm()">Record</hms-button>
      </div>
    </hms-modal>
  `,
})
export class StockMovementDialogComponent {
  private readonly inventory = inject(InventoryService);

  readonly item = input.required<InventoryItem>();
  readonly closed = output<void>();
  readonly completed = output<string>();

  protected readonly inputClass = INPUT_CLASS;
  protected readonly saving = signal(false);
  private readonly error = signal<ApiError | null>(null);

  protected readonly typeOptions = Object.entries(MOVEMENT_LABELS).map(([value, label]) => ({
    value,
    label,
  }));

  private readonly model = signal<MovementModel>({
    type: 'stock_in',
    quantity: '',
    batchNumber: '',
    expiryDate: '',
    reason: '',
  });

  protected readonly movementForm = form(this.model, movementSchema);

  protected readonly isInbound = computed(() => this.model().type === 'stock_in');

  protected readonly quantityHint = computed(() =>
    this.isInbound()
      ? `Adds to the ${this.item().quantityInStock} ${this.item().unit} on hand.`
      : `At most ${this.item().quantityInStock} ${this.item().unit} available.`,
  );

  protected readonly generalError = computed(() => {
    const current = this.error();
    return current === null || Object.keys(current.fieldErrors).length > 0 ? null : current.message;
  });

  protected serverError(field: string): string | null {
    return this.error()?.fieldErrors[field]?.[0] ?? null;
  }

  protected async onConfirm(): Promise<void> {
    this.error.set(null);

    await submit(this.movementForm, async () => {
      this.saving.set(true);
      try {
        const current = this.model();
        const movement = await this.inventory.recordMovement({
          itemId: this.item().id,
          type: current.type,
          quantity: current.quantity,
          batchNumber: current.batchNumber,
          expiryDate: current.expiryDate,
          reason: current.reason,
        });

        this.completed.emit(
          `${MOVEMENT_LABELS[movement.type]} of ${movement.quantity} ${this.item().unit} — balance now ${movement.balanceAfter}.`,
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
