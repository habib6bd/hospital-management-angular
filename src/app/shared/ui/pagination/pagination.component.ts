import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

@Component({
  selector: 'hms-pagination',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (totalPages() > 1) {
      <nav
        class="flex flex-wrap items-center justify-between gap-3 border-t border-surface-border px-4 py-3"
        aria-label="Pagination"
      >
        <p class="text-xs text-surface-fg-muted" aria-live="polite">
          Showing {{ rangeStart() }}–{{ rangeEnd() }} of {{ total() }}
        </p>

        <div class="flex items-center gap-1">
          <button
            type="button"
            class="rounded-control px-3 py-1.5 text-xs font-medium text-surface-fg-muted transition-colors hover:bg-surface-sunken hover:text-surface-fg disabled:cursor-not-allowed disabled:opacity-40"
            [disabled]="page() <= 1"
            (click)="pageChanged.emit(page() - 1)"
          >
            Previous
          </button>

          @for (item of pageItems(); track $index) {
            @if (item === null) {
              <span class="px-2 text-xs text-surface-fg-muted" aria-hidden="true">…</span>
            } @else {
              <button
                type="button"
                class="min-w-8 rounded-control px-2.5 py-1.5 text-xs font-medium transition-colors"
                [class]="
                  item === page()
                    ? 'bg-brand-600 text-white'
                    : 'text-surface-fg-muted hover:bg-surface-sunken hover:text-surface-fg'
                "
                [attr.aria-current]="item === page() ? 'page' : null"
                [attr.aria-label]="'Page ' + item"
                (click)="pageChanged.emit(item)"
              >
                {{ item }}
              </button>
            }
          }

          <button
            type="button"
            class="rounded-control px-3 py-1.5 text-xs font-medium text-surface-fg-muted transition-colors hover:bg-surface-sunken hover:text-surface-fg disabled:cursor-not-allowed disabled:opacity-40"
            [disabled]="page() >= totalPages()"
            (click)="pageChanged.emit(page() + 1)"
          >
            Next
          </button>
        </div>
      </nav>
    }
  `,
})
export class PaginationComponent {
  readonly page = input.required<number>();
  readonly totalPages = input.required<number>();
  readonly total = input.required<number>();
  readonly pageSize = input.required<number>();

  readonly pageChanged = output<number>();

  protected readonly rangeStart = computed(() =>
    this.total() === 0 ? 0 : (this.page() - 1) * this.pageSize() + 1,
  );

  protected readonly rangeEnd = computed(() =>
    Math.min(this.total(), this.page() * this.pageSize()),
  );

  /** Window of page numbers around the current page; `null` renders an ellipsis. */
  protected readonly pageItems = computed<readonly (number | null)[]>(() => {
    const total = this.totalPages();
    const current = this.page();

    if (total <= 7) {
      return Array.from({ length: total }, (_, index) => index + 1);
    }

    const items: (number | null)[] = [1];
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);

    if (start > 2) {
      items.push(null);
    }
    for (let page = start; page <= end; page++) {
      items.push(page);
    }
    if (end < total - 1) {
      items.push(null);
    }
    items.push(total);
    return items;
  });
}
