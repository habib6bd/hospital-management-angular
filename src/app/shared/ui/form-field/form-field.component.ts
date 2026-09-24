import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { ReadonlyFieldTree } from '@angular/forms/signals';

/**
 * Label + control + error wrapper for Signal Forms.
 *
 * It takes the `FieldTree` itself so it can read `touched()`, `invalid()` and
 * `errors()` directly — the caller does not wire up error display per field.
 * Errors are only shown once the field has been touched or the form submitted,
 * so a blank form does not greet the user in red.
 */
@Component({
  selector: 'hms-form-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-1.5">
      <label [for]="controlId()" class="text-xs font-medium text-surface-fg">
        {{ label() }}
        @if (required()) {
          <span class="text-status-critical" aria-hidden="true">*</span>
          <span class="sr-only-focusable">(required)</span>
        }
      </label>

      <ng-content />

      @if (hint() !== null && !showErrors()) {
        <p [id]="controlId() + '-hint'" class="text-xs text-surface-fg-muted">{{ hint() }}</p>
      }

      @if (showErrors()) {
        <p
          [id]="controlId() + '-error'"
          class="text-xs text-status-critical-strong"
          role="alert"
        >
          {{ firstError() }}
        </p>
      }
    </div>
  `,
})
export class FormFieldComponent {
  readonly label = input.required<string>();
  readonly controlId = input.required<string>();
  /** The Signal Forms field this wrapper describes. */
  readonly field = input<ReadonlyFieldTree<unknown> | null>(null);
  readonly hint = input<string | null>(null);
  readonly required = input(false);
  /** Server-side (DRF) error for this field, shown alongside client validation. */
  readonly serverError = input<string | null>(null);

  protected readonly firstError = computed<string | null>(() => {
    const server = this.serverError();
    if (server !== null) {
      return server;
    }
    const field = this.field();
    if (field === null) {
      return null;
    }
    const errors = field().errors();
    const first = errors[0];
    return first?.message ?? (first === undefined ? null : `Invalid value (${first.kind}).`);
  });

  protected readonly showErrors = computed(() => {
    if (this.serverError() !== null) {
      return true;
    }
    const field = this.field();
    if (field === null) {
      return false;
    }
    const state = field();
    return (state.touched() || state.dirty()) && state.invalid();
  });
}
