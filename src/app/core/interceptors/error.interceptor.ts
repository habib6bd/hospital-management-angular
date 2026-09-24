import { inject } from '@angular/core';
import type { HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { ToastService } from '../services/toast.service';
import { toApiError } from '../http/api-error';
import { SKIP_ERROR_TOAST } from '../http/http-context';

const TOAST_TITLES: Readonly<Record<number, string>> = {
  0: 'Connection problem',
  400: 'Invalid data',
  403: 'Not permitted',
  404: 'Not found',
  409: 'Conflict',
  422: 'Invalid data',
  429: 'Slow down',
};

/**
 * Centralises HTTP error handling: normalises the DRF payload and raises a
 * toast. 401 is skipped because the auth interceptor recovers from it silently
 * via token refresh; only a failed refresh surfaces, as a sign-out.
 */
export const errorInterceptor: HttpInterceptorFn = (request, next) => {
  const toast = inject(ToastService);

  return next(request).pipe(
    catchError((error: unknown) => {
      const apiError = toApiError(error);

      const suppressed = request.context.get(SKIP_ERROR_TOAST) || apiError.status === 401;
      if (!suppressed) {
        const title = TOAST_TITLES[apiError.status] ?? 'Something went wrong';
        toast.error(title, apiError.message);
      }

      // Rethrow the normalised error so callers can bind field errors to forms.
      return throwError(() => apiError);
    }),
  );
};
