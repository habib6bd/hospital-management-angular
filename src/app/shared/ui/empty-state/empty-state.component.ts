import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'hms-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <div
        class="flex size-12 items-center justify-center rounded-full bg-surface-sunken"
        aria-hidden="true"
      >
        <svg class="size-6 text-surface-fg-muted" viewBox="0 0 24 24" fill="none">
          <path
            d="M4 7h16M4 12h16M4 17h10"
            stroke="currentColor"
            stroke-width="1.75"
            stroke-linecap="round"
          />
        </svg>
      </div>
      <p class="text-sm font-medium text-surface-fg">{{ title() }}</p>
      @if (description() !== null) {
        <p class="max-w-sm text-xs text-surface-fg-muted">{{ description() }}</p>
      }
      <ng-content />
    </div>
  `,
})
export class EmptyStateComponent {
  readonly title = input.required<string>();
  readonly description = input<string | null>(null);
}
