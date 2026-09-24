import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Surface container. Header/footer are optional projected slots, so callers
 * compose what they need instead of passing a growing list of inputs.
 */
@Component({
  selector: 'hms-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      class="rounded-card bg-surface-raised ring-1 ring-surface-border ring-inset overflow-hidden"
      [attr.aria-labelledby]="headingId()"
    >
      @if (heading() !== null) {
        <header
          class="flex items-center justify-between gap-4 border-b border-surface-border px-5 py-4"
        >
          <div class="min-w-0">
            <h2 [id]="headingId()" class="truncate text-sm font-semibold text-surface-fg">
              {{ heading() }}
            </h2>
            @if (subheading() !== null) {
              <p class="mt-0.5 truncate text-xs text-surface-fg-muted">{{ subheading() }}</p>
            }
          </div>
          <ng-content select="[card-actions]" />
        </header>
      }

      <div [class]="padded() ? 'p-5' : ''">
        <ng-content />
      </div>

      <ng-content select="[card-footer]" />
    </section>
  `,
})
export class CardComponent {
  readonly heading = input<string | null>(null);
  readonly subheading = input<string | null>(null);
  readonly padded = input(true);
  readonly headingId = input<string | null>(null);
}
