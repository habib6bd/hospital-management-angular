import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Headline number with a label and an optional one-line context. */
@Component({
  selector: 'hms-stat-tile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-w-0 rounded-control bg-surface-sunken px-3 py-2.5">
      <p class="text-xs leading-tight text-surface-fg-muted">{{ label() }}</p>
      <p class="mt-0.5 truncate text-lg font-semibold tabular-nums text-surface-fg">{{ value() }}</p>
      @if (hint() !== null) {
        <p class="truncate text-xs text-surface-fg-muted">{{ hint() }}</p>
      }
    </div>
  `,
})
export class StatTileComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly hint = input<string | null>(null);
}
