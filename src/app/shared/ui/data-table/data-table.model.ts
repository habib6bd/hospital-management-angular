import type { TemplateRef } from '@angular/core';

export type SortDirection = 'asc' | 'desc';

export interface SortState {
  readonly field: string;
  readonly direction: SortDirection;
}

/** Context handed to a cell template. */
export interface CellContext<T> {
  readonly $implicit: T;
  readonly index: number;
}

/**
 * Column definition. `cell` returns plain text for the common case; a column
 * that needs markup (a badge, a link) supplies a `template` instead, keeping
 * the table itself free of feature-specific rendering.
 */
export interface ColumnDef<T> {
  readonly key: string;
  readonly header: string;
  /** Text accessor. Ignored when `template` is given. */
  readonly cell?: ((row: T) => string) | undefined;
  // `| undefined` explicitly, so a `viewChild()` signal can be spread in
  // directly under `exactOptionalPropertyTypes`.
  readonly template?: TemplateRef<CellContext<T>> | undefined;
  /** Backend ordering field. Omit to make the column unsortable. */
  readonly sortField?: string | undefined;
  readonly align?: 'left' | 'right' | 'center' | undefined;
  /** Hidden below the `sm` breakpoint, so narrow screens show only essentials. */
  readonly hideOnMobile?: boolean | undefined;
  readonly width?: string | undefined;
}

/** Turns a `SortState` into DRF's `ordering` param (`-field` for descending). */
export function toOrdering(sort: SortState | null): string {
  if (sort === null) {
    return '';
  }
  return sort.direction === 'desc' ? `-${sort.field}` : sort.field;
}

/** Parses DRF's `ordering` param back into a `SortState`. */
export function fromOrdering(ordering: string): SortState | null {
  if (ordering === '') {
    return null;
  }
  return ordering.startsWith('-')
    ? { field: ordering.slice(1), direction: 'desc' }
    : { field: ordering, direction: 'asc' };
}
