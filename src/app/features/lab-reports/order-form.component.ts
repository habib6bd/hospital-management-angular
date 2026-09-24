import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { LabService } from './lab.service';
import { PatientService } from '../patients/patient.service';
import { ToastService } from '../../core/services/toast.service';
import { toApiError, type ApiError } from '../../core/http/api-error';
import { CardComponent } from '../../shared/ui/card/card.component';
import { PageHeaderComponent } from '../../shared/ui/page-header/page-header.component';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';
import { BdtPipe } from '../../shared/pipes/hms-pipes';

@Component({
  selector: 'hms-order-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardComponent, PageHeaderComponent, ButtonComponent, SkeletonComponent, BdtPipe],
  template: `
    <hms-page-header heading="New lab order" description="Select a patient and the tests to run." />

    <form (submit)="onSubmit($event)" class="flex flex-col gap-4">
      <hms-card heading="Patient">
        <label class="block">
          <span class="text-xs font-medium text-surface-fg">Search patient</span>
          <input
            type="search"
            placeholder="Name or MRN"
            class="mt-1.5 h-10 w-full rounded-control bg-surface px-3 text-sm text-surface-fg ring-1 ring-inset ring-surface-border focus:ring-2 focus:ring-brand-500"
            (input)="onPatientSearch($event)"
          />
        </label>

        <label class="mt-3 block">
          <span class="text-xs font-medium text-surface-fg">
            Patient <span class="text-status-critical" aria-hidden="true">*</span>
          </span>
          <select
            class="mt-1.5 h-10 w-full rounded-control bg-surface px-3 text-sm text-surface-fg ring-1 ring-inset ring-surface-border focus:ring-2 focus:ring-brand-500"
            [value]="patientId()"
            (change)="onPatientChange($event)"
          >
            <option value="">Select a patient</option>
            @for (patient of patientOptions(); track patient.id) {
              <option [value]="patient.id">{{ patient.fullName }} — {{ patient.mrn }}</option>
            }
          </select>
        </label>
        @if (serverError('patient') !== null) {
          <p class="mt-1.5 text-xs text-status-critical-strong" role="alert">
            {{ serverError('patient') }}
          </p>
        }

        <fieldset class="mt-4">
          <legend class="text-xs font-medium text-surface-fg">Priority</legend>
          <div class="mt-1.5 flex gap-4">
            @for (option of priorityOptions; track option.value) {
              <label class="flex items-center gap-2 text-sm text-surface-fg">
                <input
                  type="radio"
                  name="priority"
                  class="size-4 accent-brand-600"
                  [value]="option.value"
                  [checked]="priority() === option.value"
                  (change)="priority.set(option.value)"
                />
                {{ option.label }}
              </label>
            }
          </div>
        </fieldset>

        <label class="mt-4 block">
          <span class="text-xs font-medium text-surface-fg">Clinical notes</span>
          <textarea
            rows="2"
            class="mt-1.5 w-full rounded-control bg-surface px-3 py-2 text-sm text-surface-fg ring-1 ring-inset ring-surface-border focus:ring-2 focus:ring-brand-500"
            [value]="notes()"
            (input)="onNotesInput($event)"
          ></textarea>
        </label>
      </hms-card>

      <hms-card
        heading="Tests"
        [subheading]="selectedIds().size + ' selected · ' + (totalPrice() | bdt)"
        [padded]="false"
      >
        @if (lab.isTestsLoading()) {
          <div class="p-5"><hms-skeleton [lines]="5" [height]="16" label="Loading tests" /></div>
        } @else {
          <fieldset class="divide-y divide-surface-border">
            <legend class="sr-only-focusable">Available tests</legend>
            @for (test of lab.tests(); track test.id) {
              <label class="flex cursor-pointer items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-sunken">
                <input
                  type="checkbox"
                  class="size-4 shrink-0 rounded accent-brand-600"
                  [checked]="selectedIds().has(test.id)"
                  (change)="toggleTest(test.id)"
                />
                <span class="min-w-0 flex-1">
                  <span class="block text-sm text-surface-fg">{{ test.name }}</span>
                  <span class="block text-xs text-surface-fg-muted">
                    {{ test.code }} · {{ test.specimen }} · ~{{ test.turnaroundHours }}h
                  </span>
                </span>
                <span class="text-sm text-surface-fg">{{ test.price | bdt }}</span>
              </label>
            }
          </fieldset>
        }

        @if (serverError('tests') !== null) {
          <p class="px-5 pb-3 text-xs text-status-critical-strong" role="alert">
            {{ serverError('tests') }}
          </p>
        }
      </hms-card>

      <div class="flex items-center justify-end gap-2">
        <hms-button variant="secondary" (pressed)="cancel()">Cancel</hms-button>
        <hms-button type="submit" [loading]="saving()" [disabled]="!canSubmit()">
          Create order
        </hms-button>
      </div>
    </form>
  `,
})
export class OrderFormComponent {
  protected readonly lab = inject(LabService);
  private readonly patients = inject(PatientService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly patientId = signal('');
  protected readonly priority = signal<'routine' | 'urgent'>('routine');
  protected readonly notes = signal('');
  protected readonly selectedIds = signal<ReadonlySet<number>>(new Set());
  protected readonly saving = signal(false);
  private readonly submitError = signal<ApiError | null>(null);

  protected readonly priorityOptions: readonly { value: 'routine' | 'urgent'; label: string }[] = [
    { value: 'routine', label: 'Routine' },
    { value: 'urgent', label: 'Urgent' },
  ];

  protected readonly patientOptions = computed(() => this.patients.patients()?.items ?? []);

  protected readonly totalPrice = computed(() =>
    this.lab
      .tests()
      .filter((test) => this.selectedIds().has(test.id))
      .reduce((sum, test) => sum + test.price, 0),
  );

  protected readonly canSubmit = computed(
    () => this.patientId() !== '' && this.selectedIds().size > 0,
  );

  protected serverError(field: string): string | null {
    return this.submitError()?.fieldErrors[field]?.[0] ?? null;
  }

  protected onPatientSearch(event: Event): void {
    this.patients.patchQuery({ search: (event.target as HTMLInputElement).value });
  }

  protected onPatientChange(event: Event): void {
    this.patientId.set((event.target as HTMLSelectElement).value);
  }

  protected onNotesInput(event: Event): void {
    this.notes.set((event.target as HTMLTextAreaElement).value);
  }

  protected toggleTest(testId: number): void {
    this.selectedIds.update((current) => {
      const next = new Set(current);
      if (next.has(testId)) {
        next.delete(testId);
      } else {
        next.add(testId);
      }
      return next;
    });
  }

  protected async cancel(): Promise<void> {
    await this.router.navigate(['/lab']);
  }

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.canSubmit()) {
      return;
    }

    this.submitError.set(null);
    this.saving.set(true);
    try {
      const order = await this.lab.order({
        patientId: Number(this.patientId()),
        testIds: [...this.selectedIds()],
        priority: this.priority(),
        clinicalNotes: this.notes(),
      });
      this.toast.success('Order created', `${order.orderNumber} · ${order.patientName}`);
      await this.router.navigate(['/lab', order.id]);
    } catch (error: unknown) {
      this.submitError.set(toApiError(error));
    } finally {
      this.saving.set(false);
    }
  }
}
