import { HttpErrorResponse } from '@angular/common/http';
import { fieldError, isApiError, toApiError } from './api-error';

function httpError(status: number, body: unknown): HttpErrorResponse {
  return new HttpErrorResponse({ status, statusText: 'Error', error: body, url: '/api/test/' });
}

describe('toApiError', () => {
  it('reads DRF’s { detail } shape', () => {
    const error = toApiError(httpError(403, { detail: 'You do not have permission.' }));
    expect(error.status).toBe(403);
    expect(error.message).toBe('You do not have permission.');
    expect(error.fieldErrors).toEqual({});
  });

  it('reads DRF’s per-field shape and surfaces the first message', () => {
    const error = toApiError(
      httpError(400, {
        phone: ['Enter a valid Bangladeshi mobile number.'],
        nid: ['A patient with this NID already exists.'],
      }),
    );

    expect(error.status).toBe(400);
    expect(error.fieldErrors['phone']).toEqual(['Enter a valid Bangladeshi mobile number.']);
    expect(fieldError(error, 'nid')).toBe('A patient with this NID already exists.');
    expect(fieldError(error, 'address')).toBeNull();
  });

  it('prefers non_field_errors for the summary message', () => {
    const error = toApiError(
      httpError(400, { non_field_errors: ['Slot already taken.'], start_time: ['Unavailable.'] }),
    );
    expect(error.message).toBe('Slot already taken.');
  });

  it('coerces a bare string field value into a list', () => {
    const error = toApiError(httpError(400, { quantity: 'Must be positive.' }));
    expect(error.fieldErrors['quantity']).toEqual(['Must be positive.']);
  });

  it('falls back to a status message when the body is unhelpful', () => {
    expect(toApiError(httpError(500, null)).message).toBe('Something went wrong on the server.');
    expect(toApiError(httpError(0, null)).message).toContain('Cannot reach the server');
    // An HTML error page must not be shown to the user verbatim.
    expect(toApiError(httpError(502, '<html>Bad Gateway</html>')).message).toContain(
      'server is unavailable',
    );
  });

  /**
   * The error interceptor normalises before rethrowing, so components almost
   * always call this with an ApiError. Re-parsing it must not lose field errors.
   */
  it('returns an already-normalised ApiError unchanged', () => {
    const original = toApiError(httpError(400, { code: ['An item with this code already exists.'] }));
    const reparsed = toApiError(original);

    expect(reparsed).toBe(original);
    expect(fieldError(reparsed, 'code')).toBe('An item with this code already exists.');
  });

  it('identifies its own output', () => {
    expect(isApiError(toApiError(httpError(400, {})))).toBe(true);
    expect(isApiError({ status: 400 })).toBe(false);
    expect(isApiError(null)).toBe(false);
    expect(isApiError('boom')).toBe(false);
  });

  it('handles a plain Error without throwing', () => {
    const error = toApiError(new Error('network down'));
    expect(error.message).toBe('network down');
    expect(error.fieldErrors).toEqual({});
  });
});
