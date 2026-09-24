import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Title row for a feature page: heading, optional description, action slot. */
@Component({
  selector: 'hms-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0">
        <h1 class="text-lg font-semibold text-surface-fg">{{ heading() }}</h1>
        @if (description() !== null) {
          <p class="mt-1 text-sm text-surface-fg-muted">{{ description() }}</p>
        }
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <ng-content />
      </div>
    </div>
  `,
})
export class PageHeaderComponent {
  readonly heading = input.required<string>();
  readonly description = input<string | null>(null);
}
