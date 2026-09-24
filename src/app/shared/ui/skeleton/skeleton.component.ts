import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Loading placeholder. Used as the `@placeholder`/`@loading` block of `@defer`
 * and while a `httpResource` is in flight.
 */
@Component({
  selector: 'hms-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div role="status" [attr.aria-label]="label()" class="animate-pulse space-y-2">
      @for (row of rows(); track row) {
        <div
          class="rounded bg-surface-sunken"
          [style.height.px]="height()"
          [style.width]="widthFor(row)"
        ></div>
      }
      <span class="sr-only-focusable">{{ label() }}</span>
    </div>
  `,
})
export class SkeletonComponent {
  readonly lines = input(3);
  readonly height = input(12);
  readonly label = input('Loading…');

  protected readonly rows = computed(() =>
    Array.from({ length: Math.max(1, this.lines()) }, (_, index) => index),
  );

  /** Ragged widths read as text rather than as a block of identical bars. */
  protected widthFor(index: number): string {
    const widths = ['100%', '92%', '78%', '85%', '64%'];
    return widths[index % widths.length]!;
  }
}
