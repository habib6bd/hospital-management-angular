import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { LabService } from './lab.service';
import { toApiError, type ApiError } from '../../core/http/api-error';
import { ModalComponent } from '../../shared/ui/modal/modal.component';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { BadgeComponent } from '../../shared/ui/badge/badge.component';
import {
  RESULT_FLAG_LABELS,
  flagFor,
  flagTone,
  type LabOrder,
  type LabTest,
  type ResultFlag,
} from '../../shared/models/lab.model';

interface Entry {
  readonly testId: number;
  value: string;
  notes: string;
}

/**
 * Result entry.
 *
 * Out-of-range values are flagged live as the technician types, using the same
 * `flagFor` helper that renders the finished report — so what they see while
 * entering is exactly what the patient will see.
 *
 * This uses a plain signal rather than a Signal Form: the field set is derived
 * from the order's tests at runtime, and the only rule (non-empty) is simpler
 * to express directly than as a dynamically built schema.
 */
@Component({
  selector: 'hms-result-entry',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModalComponent, ButtonComponent, BadgeComponent],
  template: `
    <hms-modal
      heading="Enter results"
      [description]="order().orderNumber + ' · ' + order().patientName"
      [busy]="saving()"
      (closed)="closed.emit()"
    >
      <p class="mb-4 rounded-control bg-status-pending-soft px-3 py-2 text-xs text-status-pending-strong">
        Saving completes the order and releases the report to the patient portal.
        Every test needs a value.
      </p>

      <div class="flex flex-col gap-4">
        @for (row of rows(); track row.test.id) {
          <div class="rounded-card p-3 ring-1 ring-inset ring-surface-border">
            <div class="flex flex-wrap items-baseline justify-between gap-2">
              <label [for]="'result-' + row.test.id" class="text-sm font-medium text-surface-fg">
                {{ row.test.name }}
              </label>
              <span class="text-xs text-surface-fg-muted">
                ref {{ row.reference }} {{ row.test.unit }}
              </span>
            </div>

            <div class="mt-2 flex items-center gap-2">
              <input
                [id]="'result-' + row.test.id"
                type="text"
                inputmode="decimal"
                class="h-10 w-32 rounded-control bg-surface px-3 text-sm text-surface-fg ring-1 ring-inset focus:ring-2 focus:ring-brand-500"
                [class]="row.flag === 'low' || row.flag === 'high' ? 'ring-status-critical/50' : 'ring-surface-border'"
                [value]="row.entry.value"
                [attr.aria-describedby]="'flag-' + row.test.id"
                [attr.aria-invalid]="row.flag === 'low' || row.flag === 'high' ? 'true' : null"
                (input)="setValue(row.test.id, $event)"
              />
              <span class="text-xs text-surface-fg-muted">{{ row.test.unit }}</span>

              <span [id]="'flag-' + row.test.id">
                @if (row.entry.value.trim() !== '' && row.flag !== 'non_numeric') {
                  <hms-badge [tone]="tone(row.flag)">{{ label(row.flag) }}</hms-badge>
                }
              </span>

              @if (fieldError(row.test.id) !== null) {
                <span class="text-xs text-status-critical-strong" role="alert">
                  {{ fieldError(row.test.id) }}
                </span>
              }
            </div>

            <input
              type="text"
              placeholder="Notes (optional)"
              class="mt-2 h-9 w-full rounded-control bg-surface px-3 text-xs text-surface-fg ring-1 ring-inset ring-surface-border focus:ring-2 focus:ring-brand-500"
              [attr.aria-label]="'Notes for ' + row.test.name"
              [value]="row.entry.notes"
              (input)="setNotes(row.test.id, $event)"
            />
          </div>
        }
      </div>

      @if (abnormalCount() > 0) {
        <p class="mt-4 rounded-control bg-status-critical-soft px-3 py-2 text-xs text-status-critical-strong">
          {{ abnormalCount() }} result(s) fall outside the reference range.
        </p>
      }

      @if (generalError() !== null) {
        <p class="mt-3 rounded-control bg-status-critical-soft px-3 py-2 text-xs text-status-critical-strong" role="alert">
          {{ generalError() }}
        </p>
      }

      <div modal-footer class="contents">
        <hms-button variant="secondary" [disabled]="saving()" (pressed)="closed.emit()">
          Cancel
        </hms-button>
        <hms-button [loading]="saving()" [disabled]="!isComplete()" (pressed)="save()">
          Save & release
        </hms-button>
      </div>
    </hms-modal>
  `,
})
export class ResultEntryComponent {
  private readonly lab = inject(LabService);

  readonly order = input.required<LabOrder>();
  readonly closed = output<void>();
  readonly completed = output<void>();

  protected readonly saving = signal(false);
  private readonly error = signal<ApiError | null>(null);

  /** Seeded from the order's tests; any existing results pre-fill the fields. */
  private readonly entries = signal<readonly Entry[]>([]);

  constructor() {
    queueMicrotask(() => {
      this.entries.set(
        this.order().tests.map((test) => {
          const existing = this.order().results.find((result) => result.testId === test.id);
          return {
            testId: test.id,
            value: existing?.value ?? '',
            notes: existing?.notes ?? '',
          };
        }),
      );
    });
  }

  protected readonly rows = computed(() =>
    this.order().tests.map((test) => {
      const entry = this.entries().find((candidate) => candidate.testId === test.id) ?? {
        testId: test.id,
        value: '',
        notes: '',
      };
      return {
        test,
        entry,
        flag: flagFor(entry.value, test.referenceLow, test.referenceHigh),
        reference: this.referenceText(test),
      };
    }),
  );

  protected readonly abnormalCount = computed(
    () => this.rows().filter((row) => row.flag === 'low' || row.flag === 'high').length,
  );

  protected readonly isComplete = computed(() =>
    this.rows().every((row) => row.entry.value.trim() !== ''),
  );

  protected readonly generalError = computed(() => {
    const current = this.error();
    return current === null || Object.keys(current.fieldErrors).length > 0 ? null : current.message;
  });

  protected fieldError(testId: number): string | null {
    return this.error()?.fieldErrors[`results.${testId}`]?.[0] ?? null;
  }

  protected tone(flag: ResultFlag) {
    return flagTone(flag);
  }

  protected label(flag: ResultFlag): string {
    return RESULT_FLAG_LABELS[flag];
  }

  private referenceText(test: LabTest): string {
    if (test.referenceLow === null && test.referenceHigh === null) {
      return '—';
    }
    if (test.referenceLow === null) {
      return `< ${test.referenceHigh}`;
    }
    if (test.referenceHigh === null) {
      return `> ${test.referenceLow}`;
    }
    return `${test.referenceLow} – ${test.referenceHigh}`;
  }

  protected setValue(testId: number, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.entries.update((current) =>
      current.map((entry) => (entry.testId === testId ? { ...entry, value } : entry)),
    );
  }

  protected setNotes(testId: number, event: Event): void {
    const notes = (event.target as HTMLInputElement).value;
    this.entries.update((current) =>
      current.map((entry) => (entry.testId === testId ? { ...entry, notes } : entry)),
    );
  }

  protected async save(): Promise<void> {
    this.error.set(null);
    this.saving.set(true);
    try {
      await this.lab.enterResults(this.order().id, this.rows().map((row) => row.entry));
      this.completed.emit();
    } catch (caught: unknown) {
      this.error.set(toApiError(caught));
    } finally {
      this.saving.set(false);
    }
  }
}
