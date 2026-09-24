import { HttpErrorResponse } from '@angular/common/http';

/**
 * Normalised error shape used everywhere in the app. Raw DRF payloads never
 * escape this module — components and services deal only with `ApiError`.
 */
export interface ApiError {
  readonly status: number;
  /** Human-readable summary, safe to show in a toast. */
  readonly message: string;
  /** Per-field messages from a DRF serializer, keyed by field name. */
  readonly fieldErrors: Readonly<Record<string, readonly string[]>>;
  /** True for network/offline failures where `status` is 0. */
  readonly isNetworkError: boolean;
}

const STATUS_MESSAGES: Readonly<Record<number, string>> = {
  0: 'Cannot reach the server. Check your connection.',
  400: 'The submitted data was not valid.',
  401: 'Your session has expired. Please sign in again.',
  403: 'You do not have permission to perform this action.',
  404: 'The requested record was not found.',
  409: 'This action conflicts with the current state of the record.',
  422: 'The submitted data was not valid.',
  429: 'Too many requests. Please slow down.',
  500: 'Something went wrong on the server.',
  502: 'The server is unavailable. Please try again shortly.',
  503: 'The server is unavailable. Please try again shortly.',
};

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

/**
 * True for a value this module already produced.
 *
 * The error interceptor normalises before rethrowing, so by the time a
 * component catches, the value is usually an `ApiError` already. Without this
 * check `toApiError` would treat its own output as an unknown object and
 * discard `fieldErrors`, leaving every form unable to show per-field messages.
 */
export function isApiError(value: unknown): value is ApiError {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Partial<ApiError>;
  return (
    typeof candidate.status === 'number' &&
    typeof candidate.message === 'string' &&
    typeof candidate.fieldErrors === 'object' &&
    candidate.fieldErrors !== null &&
    typeof candidate.isNetworkError === 'boolean'
  );
}

/**
 * Parses the three shapes DRF actually emits:
 *   { "detail": "..." }
 *   { "field": ["msg", ...], "other_field": ["msg"] }
 *   { "non_field_errors": ["msg"] }
 *
 * Passing an already-normalised `ApiError` back in returns it unchanged.
 */
export function toApiError(error: unknown): ApiError {
  if (isApiError(error)) {
    return error;
  }

  if (!(error instanceof HttpErrorResponse)) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { status: 0, message, fieldErrors: {}, isNetworkError: false };
  }

  const status = error.status;
  const fallback = STATUS_MESSAGES[status] ?? 'An unexpected error occurred.';
  const body: unknown = error.error;

  if (typeof body === 'string' && body.trim() !== '' && !body.trimStart().startsWith('<')) {
    return { status, message: body, fieldErrors: {}, isNetworkError: status === 0 };
  }

  if (body === null || typeof body !== 'object') {
    return { status, message: fallback, fieldErrors: {}, isNetworkError: status === 0 };
  }

  const record = body as Record<string, unknown>;

  if (typeof record['detail'] === 'string') {
    return { status, message: record['detail'], fieldErrors: {}, isNetworkError: status === 0 };
  }

  const fieldErrors: Record<string, readonly string[]> = {};
  for (const [key, value] of Object.entries(record)) {
    if (isStringArray(value)) {
      fieldErrors[key] = value;
    } else if (typeof value === 'string') {
      fieldErrors[key] = [value];
    }
  }

  const nonField = fieldErrors['non_field_errors'];
  const firstField = Object.values(fieldErrors)[0];
  const message = nonField?.[0] ?? firstField?.[0] ?? fallback;

  return { status, message, fieldErrors, isNetworkError: status === 0 };
}

/** Convenience for binding DRF field errors back onto a Signal Form. */
export function fieldError(error: ApiError | null, field: string): string | null {
  return error?.fieldErrors[field]?.[0] ?? null;
}
