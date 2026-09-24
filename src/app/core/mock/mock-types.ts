import type { HttpHeaders } from '@angular/common/http';

/** A parsed request, normalised so handlers never touch Angular's HTTP types. */
export interface MockRequest {
  readonly method: string;
  /** Path with the `/api` prefix stripped and a guaranteed trailing slash, e.g. `/patients/12/`. */
  readonly path: string;
  readonly params: URLSearchParams;
  readonly body: unknown;
  readonly headers: HttpHeaders;
}

/** What a handler returns. `body` is always the DRF-shaped snake_case payload. */
export interface MockResponse {
  readonly status: number;
  readonly body: unknown;
}

/**
 * A handler returns `null` when the request is not its concern, letting the
 * dispatcher try the next one. This keeps each domain's routes self-contained.
 */
export type MockHandler = (request: MockRequest) => MockResponse | null;
