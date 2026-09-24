/**
 * DRF's default `PageNumberPagination` envelope, exactly as it arrives on the wire.
 */
export interface PaginatedDto<TDto> {
  readonly count: number;
  readonly next: string | null;
  readonly previous: string | null;
  readonly results: readonly TDto[];
}

/** The internal, camelCase equivalent handed to components. */
export interface Page<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly hasNext: boolean;
  readonly hasPrevious: boolean;
  readonly totalPages: number;
}

/** Maps a DRF page of DTOs into a page of domain models. */
export function mapPage<TDto, T>(
  dto: PaginatedDto<TDto>,
  map: (item: TDto) => T,
  page: number,
  pageSize: number,
): Page<T> {
  return {
    items: dto.results.map(map),
    total: dto.count,
    page,
    pageSize,
    hasNext: dto.next !== null,
    hasPrevious: dto.previous !== null,
    totalPages: Math.max(1, Math.ceil(dto.count / Math.max(1, pageSize))),
  };
}

export function emptyPage<T>(pageSize: number): Page<T> {
  return {
    items: [],
    total: 0,
    page: 1,
    pageSize,
    hasNext: false,
    hasPrevious: false,
    totalPages: 1,
  };
}

/** Base shape for list query params; features extend it with their own filters. */
export interface ListQuery {
  readonly page: number;
  readonly pageSize: number;
  readonly search?: string;
  readonly ordering?: string;
}

/** Serialises a query object into DRF-conventional params, dropping empties. */
export function toQueryParams(query: Readonly<Record<string, unknown>>): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') {
      continue;
    }
    // DRF reads `page_size`, not `pageSize`.
    const name = key === 'pageSize' ? 'page_size' : key;
    params[name] = String(value);
  }
  return params;
}
