import type { PaginatedDto } from '../http/paginated';
import type { MockRequest, MockResponse } from './mock-types';

/** Matches `/patients/:id/` style templates against a concrete path. */
export function match(
  request: MockRequest,
  method: string,
  template: string,
): Record<string, string> | null {
  if (request.method !== method) {
    return null;
  }

  const templateParts = template.split('/').filter((part) => part !== '');
  const pathParts = request.path.split('/').filter((part) => part !== '');

  if (templateParts.length !== pathParts.length) {
    return null;
  }

  const params: Record<string, string> = {};
  for (let i = 0; i < templateParts.length; i++) {
    const templatePart = templateParts[i]!;
    const pathPart = pathParts[i]!;
    if (templatePart.startsWith(':')) {
      params[templatePart.slice(1)] = decodeURIComponent(pathPart);
    } else if (templatePart !== pathPart) {
      return null;
    }
  }
  return params;
}

export function ok(body: unknown): MockResponse {
  return { status: 200, body };
}

export function created(body: unknown): MockResponse {
  return { status: 201, body };
}

export function noContent(): MockResponse {
  return { status: 204, body: null };
}

/** `{ "detail": "..." }` — DRF's shape for non-field errors. */
export function detailError(status: number, detail: string): MockResponse {
  return { status, body: { detail } };
}

/** `{ "field": ["msg"] }` — DRF's serializer validation shape. */
export function validationError(fields: Record<string, readonly string[]>): MockResponse {
  return { status: 400, body: fields };
}

export function notFound(what = 'Not found.'): MockResponse {
  return detailError(404, what);
}

/** Builds DRF's `PageNumberPagination` envelope over an already-filtered list. */
export function paginate<T>(
  items: readonly T[],
  request: MockRequest,
  defaultPageSize: number,
): PaginatedDto<T> {
  const page = Math.max(1, Number.parseInt(request.params.get('page') ?? '1', 10) || 1);
  const pageSize = Math.max(
    1,
    Number.parseInt(request.params.get('page_size') ?? String(defaultPageSize), 10) ||
      defaultPageSize,
  );

  const start = (page - 1) * pageSize;
  const slice = items.slice(start, start + pageSize);
  const hasNext = start + pageSize < items.length;

  const buildUrl = (target: number): string => {
    const params = new URLSearchParams(request.params);
    params.set('page', String(target));
    return `/api${request.path}?${params.toString()}`;
  };

  return {
    count: items.length,
    next: hasNext ? buildUrl(page + 1) : null,
    previous: page > 1 ? buildUrl(page - 1) : null,
    results: slice,
  };
}

/** Case-insensitive contains across the given fields — mimics DRF's SearchFilter. */
export function searchFilter<T>(
  items: readonly T[],
  term: string | null,
  fields: readonly (keyof T)[],
): readonly T[] {
  if (term === null || term.trim() === '') {
    return items;
  }
  const needle = term.trim().toLowerCase();
  return items.filter((item) =>
    fields.some((field) => String(item[field] ?? '').toLowerCase().includes(needle)),
  );
}

/** Mimics DRF's `OrderingFilter`, including the `-field` descending prefix. */
export function orderBy<T>(items: readonly T[], ordering: string | null): readonly T[] {
  if (ordering === null || ordering === '') {
    return items;
  }
  const descending = ordering.startsWith('-');
  const field = (descending ? ordering.slice(1) : ordering) as keyof T;

  return [...items].sort((a, b) => {
    const left = a[field];
    const right = b[field];
    if (left === right) {
      return 0;
    }
    if (left === null || left === undefined) {
      return 1;
    }
    if (right === null || right === undefined) {
      return -1;
    }
    const result =
      typeof left === 'number' && typeof right === 'number'
        ? left - right
        : String(left).localeCompare(String(right));
    return descending ? -result : result;
  });
}

export function randomLatency(range: readonly [number, number]): number {
  const [min, max] = range;
  return min + Math.random() * (max - min);
}

/** Deterministic pseudo-random generator so seed data is stable across reloads. */
export function createRng(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0xffffffff;
  };
}

export function pick<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length) % items.length]!;
}

export function randomInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/**
 * ISO date (no time) offset from today — keeps seed data relevant whenever it runs.
 *
 * Built from local components rather than `toISOString()`, which would shift the
 * date back a day for any timezone east of UTC.
 */
export function isoDate(offsetDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isoDateTime(offsetMinutes: number): string {
  return new Date(Date.now() + offsetMinutes * 60_000).toISOString();
}
