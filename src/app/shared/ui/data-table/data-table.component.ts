import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { SkeletonComponent } from '../skeleton/skeleton.component';
import { EmptyStateComponent } from '../empty-state/empty-state.component';
import { fromOrdering, type ColumnDef, type SortDirection, type SortState } from './data-table.model';

/**
 * Generic, sortable data table.
 *
 * Sorting is *controlled*: the table emits the requested sort and the parent
 * feeds `ordering` back in from its query signal. That keeps sorting server-side
 * (DRF's `ordering` param) instead of sorting one page of results locally, which
 * would silently sort the wrong set.
 */
@Component({
  selector: 'hms-data-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, SkeletonComponent, EmptyStateComponent],
  template: `
    @if (loading() && rows().length === 0) {
      <div class="p-5">
        <hms-skeleton [lines]="6" [height]="16" [label]="'Loading ' + caption()" />
      </div>
    } @else if (rows().length === 0) {
      <hms-empty-state [title]="emptyTitle()" [description]="emptyDescription()" />
    } @else {
      <div class="hms-scrollbar overflow-x-auto" [class.opacity-60]="loading()">
        <table class="w-full border-collapse text-sm">
          <caption class="sr-only-focusable">{{ caption() }}</caption>
          <thead>
            <tr class="border-b border-surface-border bg-surface-sunken/60">
              @for (column of columns(); track column.key) {
                <th
                  scope="col"
                  class="px-4 py-2.5 text-xs font-semibold text-surface-fg-muted"
                  [class]="headerClass(column)"
                  [style.width]="column.width"
                  [attr.aria-sort]="ariaSort(column)"
                >
                  @if (column.sortField !== undefined) {
                    <button
                      type="button"
                      class="inline-flex items-center gap-1 transition-colors hover:text-surface-fg"
                      (click)="requestSort(column.sortField)"
                    >
                      {{ column.header }}
                      <span class="text-[10px]" aria-hidden="true">
                        {{ sortIndicator(column.sortField) }}
                      </span>
                    </button>
                  } @else {
                    {{ column.header }}
                  }
                </th>
              }
            </tr>
          </thead>

          <tbody>
            @for (row of rows(); track trackBy()(row); let index = $index) {
              <tr
                class="border-b border-surface-border last:border-0 transition-colors hover:bg-surface-sunken/50"
                [class.cursor-pointer]="selectable()"
                [attr.tabindex]="selectable() ? 0 : null"
                [attr.role]="selectable() ? 'button' : null"
                [attr.aria-label]="selectable() ? rowLabel()(row) : null"
                (click)="onRowActivate(row)"
                (keydown.enter)="onRowActivate(row)"
                (keydown.space)="onRowActivate(row)"
              >
                @for (column of columns(); track column.key) {
                  <td class="px-4 py-3 text-surface-fg" [class]="cellClass(column)">
                    @if (column.template) {
                      <ng-container
                        [ngTemplateOutlet]="column.template"
                        [ngTemplateOutletContext]="{ $implicit: row, index: index }"
                      />
                    } @else {
                      {{ column.cell ? column.cell(row) : '' }}
                    }
                  </td>
                }
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
})
export class DataTableComponent<T> {
  readonly rows = input.required<readonly T[]>();
  readonly columns = input.required<readonly ColumnDef<T>[]>();
  /** Stable identity for `@for` tracking — required for correct DOM reuse. */
  readonly trackBy = input.required<(row: T) => unknown>();

  readonly caption = input('results');
  readonly loading = input(false);
  readonly selectable = input(false);
  readonly emptyTitle = input('No records found');
  readonly emptyDescription = input<string | null>('Try adjusting your filters or search terms.');
  readonly rowLabel = input<(row: T) => string>(() => 'Open record');

  /** Current sort, as DRF's `ordering` string. */
  readonly ordering = input('');

  readonly sortChanged = output<SortState>();
  readonly rowActivated = output<T>();

  private readonly sort = computed<SortState | null>(() => fromOrdering(this.ordering()));

  protected requestSort(field: string): void {
    const current = this.sort();
    const direction: SortDirection =
      current !== null && current.field === field && current.direction === 'asc' ? 'desc' : 'asc';
    this.sortChanged.emit({ field, direction });
  }

  protected onRowActivate(row: T): void {
    if (this.selectable()) {
      this.rowActivated.emit(row);
    }
  }

  protected ariaSort(column: ColumnDef<T>): 'ascending' | 'descending' | 'none' | null {
    if (column.sortField === undefined) {
      return null;
    }
    const current = this.sort();
    if (current === null || current.field !== column.sortField) {
      return 'none';
    }
    return current.direction === 'asc' ? 'ascending' : 'descending';
  }

  protected sortIndicator(field: string): string {
    const current = this.sort();
    if (current === null || current.field !== field) {
      return '↕';
    }
    return current.direction === 'asc' ? '↑' : '↓';
  }

  protected headerClass(column: ColumnDef<T>): string {
    return `${this.alignClass(column)} ${column.hideOnMobile === true ? 'hidden sm:table-cell' : ''}`;
  }

  protected cellClass(column: ColumnDef<T>): string {
    return `${this.alignClass(column)} ${column.hideOnMobile === true ? 'hidden sm:table-cell' : ''}`;
  }

  private alignClass(column: ColumnDef<T>): string {
    switch (column.align) {
      case 'right':
        return 'text-right';
      case 'center':
        return 'text-center';
      default:
        return 'text-left';
    }
  }
}
