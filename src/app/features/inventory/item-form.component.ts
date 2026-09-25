import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormField, form, maxLength, required, schema, submit, validate } from '@angular/forms/signals';
import { InventoryService, SupplierService } from './inventory.service';
import { ToastService } from '../../core/services/toast.service';
import { toApiError, type ApiError } from '../../core/http/api-error';
import { CardComponent } from '../../shared/ui/card/card.component';
import { PageHeaderComponent } from '../../shared/ui/page-header/page-header.component';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { FormFieldComponent } from '../../shared/ui/form-field/form-field.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';
import { emptyItemInput, toItemInput } from '../../shared/models/inventory.dto';
import { ITEM_CATEGORY_LABELS, type InventoryItemInput } from '../../shared/models/inventory.model';

/**
 * Numeric bounds live in the schema rather than as native `min` attributes:
 * Signal Forms owns `min`/`max` on a `[formField]` control, so setting them in
 * the template is rejected by the compiler.
 */
function nonNegativeNumber(message: string) {
  return ({ value }: { value: () => string }) => {
    const parsed = Number(value());
    if (value() === '' || !Number.isFinite(parsed) || parsed < 0) {
      return { kind: 'number', message };
    }
    return null;
  };
}

const itemSchema = schema<InventoryItemInput>((path) => {
  required(path.code, { message: 'An item code is required.' });
  maxLength(path.code, 24);
  required(path.name, { message: 'An item name is required.' });
  maxLength(path.name, 120);
  required(path.unit, { message: 'Enter a unit, e.g. tablet or pcs.' });
  required(path.reorderLevel, { message: 'Set a reorder level.' });
  validate(path.reorderLevel, nonNegativeNumber('Reorder level must be 0 or more.'));
  required(path.unitPrice, { message: 'Enter a unit price.' });
  validate(path.unitPrice, nonNegativeNumber('Unit price must be 0 or more.'));
});

const INPUT_CLASS =
  'h-10 w-full rounded-control bg-surface px-3 text-sm text-surface-fg ring-1 ring-inset ring-surface-border focus:ring-2 focus:ring-brand-500';

@Component({
  selector: 'hms-item-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormField,
    CardComponent,
    PageHeaderComponent,
    ButtonComponent,
    FormFieldComponent,
    SkeletonComponent,
  ],
  template: `
    <hms-page-header
      [heading]="isEdit() ? 'Edit item' : 'Add inventory item'"
      description="Stock levels are changed through movements, never edited directly here."
    />

    @if (isEdit() && inventory.isDetailLoading()) {
      <hms-card><hms-skeleton [lines]="6" [height]="16" label="Loading item" /></hms-card>
    } @else {
      <form (submit)="onSubmit($event)" class="flex flex-col gap-4">
        <hms-card heading="Item details">
          <div class="grid gap-4 sm:grid-cols-2">
            <hms-form-field
              label="Item code"
              controlId="item-code"
              [field]="itemForm.code"
              [required]="true"
              hint="e.g. MED-0042"
              [serverError]="serverError('code')"
            >
              <input id="item-code" type="text" [class]="inputClass" [formField]="itemForm.code" />
            </hms-form-field>

            <hms-form-field
              label="Name"
              controlId="item-name"
              [field]="itemForm.name"
              [required]="true"
              [serverError]="serverError('name')"
            >
              <input id="item-name" type="text" [class]="inputClass" [formField]="itemForm.name" />
            </hms-form-field>

            <hms-form-field label="Category" controlId="item-category" [field]="itemForm.category">
              <select id="item-category" [class]="inputClass" [formField]="itemForm.category">
                @for (entry of categoryOptions; track entry.value) {
                  <option [value]="entry.value">{{ entry.label }}</option>
                }
              </select>
            </hms-form-field>

            <hms-form-field
              label="Unit"
              controlId="item-unit"
              [field]="itemForm.unit"
              [required]="true"
              hint="tablet, vial, pcs, unit…"
            >
              <input id="item-unit" type="text" [class]="inputClass" [formField]="itemForm.unit" />
            </hms-form-field>

            <hms-form-field
              label="Reorder level"
              controlId="item-reorder"
              [field]="itemForm.reorderLevel"
              [required]="true"
              hint="An alert is raised at or below this quantity."
              [serverError]="serverError('reorder_level')"
            >
              <input
                id="item-reorder"
                type="number"
                step="1"
                [class]="inputClass"
                [formField]="itemForm.reorderLevel"
              />
            </hms-form-field>

            <hms-form-field
              label="Unit price (BDT)"
              controlId="item-price"
              [field]="itemForm.unitPrice"
              [required]="true"
              [serverError]="serverError('unit_price')"
            >
              <input
                id="item-price"
                type="number"
                step="0.01"
                [class]="inputClass"
                [formField]="itemForm.unitPrice"
              />
            </hms-form-field>

            <hms-form-field
              class="sm:col-span-2"
              label="Supplier"
              controlId="item-supplier"
              [field]="itemForm.supplierId"
            >
              <select id="item-supplier" [class]="inputClass" [formField]="itemForm.supplierId">
                <option value="">No supplier</option>
                @for (supplier of suppliers.activeSuppliers(); track supplier.id) {
                  <option [value]="supplier.id">{{ supplier.name }}</option>
                }
              </select>
            </hms-form-field>
          </div>
        </hms-card>

        <div class="flex items-center justify-end gap-2">
          <hms-button variant="secondary" (pressed)="cancel()">Cancel</hms-button>
          <hms-button type="submit" [loading]="saving()">
            {{ isEdit() ? 'Save changes' : 'Add item' }}
          </hms-button>
        </div>
      </form>
    }
  `,
})
export class ItemFormComponent {
  protected readonly inventory = inject(InventoryService);
  protected readonly suppliers = inject(SupplierService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly id = input<string | undefined>(undefined);

  protected readonly inputClass = INPUT_CLASS;
  protected readonly saving = signal(false);
  private readonly submitError = signal<ApiError | null>(null);

  protected readonly categoryOptions = Object.entries(ITEM_CATEGORY_LABELS).map(
    ([value, label]) => ({ value, label }),
  );

  protected readonly itemId = computed<number | null>(() => {
    const raw = this.id();
    if (raw === undefined || raw === 'new') {
      return null;
    }
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  });

  protected readonly isEdit = computed(() => this.itemId() !== null);

  private readonly model = signal<InventoryItemInput>(emptyItemInput());
  protected readonly itemForm = form(this.model, itemSchema);

  constructor() {
    effect(() => {
      this.inventory.select(this.itemId());
    });

    effect(() => {
      const item = this.inventory.selectedItem();
      if (item !== undefined && item.id === this.itemId()) {
        this.model.set(toItemInput(item));
      }
    });
  }

  protected serverError(field: string): string | null {
    return this.submitError()?.fieldErrors[field]?.[0] ?? null;
  }

  protected async cancel(): Promise<void> {
    await this.router.navigate(['/app/inventory']);
  }

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.submitError.set(null);

    await submit(this.itemForm, async () => {
      this.saving.set(true);
      try {
        const id = this.itemId();
        const saved =
          id === null
            ? await this.inventory.create(this.model())
            : await this.inventory.update(id, this.model());

        this.toast.success(id === null ? 'Item added' : 'Item updated', `${saved.name} · ${saved.code}`);
        await this.router.navigate(['/app/inventory', saved.id]);
        return null;
      } catch (error: unknown) {
        const apiError = toApiError(error);
        this.submitError.set(apiError);
        return { kind: 'server', message: apiError.message };
      } finally {
        this.saving.set(false);
      }
    });
  }
}
