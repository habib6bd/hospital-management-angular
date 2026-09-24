import { HttpContext, HttpContextToken } from '@angular/common/http';

/** Skip bearer-token attachment and 401 refresh handling (used by auth endpoints themselves). */
export const SKIP_AUTH = new HttpContextToken<boolean>(() => false);

/** Suppress the automatic error toast — the caller renders the error itself (e.g. inline on a form). */
export const SKIP_ERROR_TOAST = new HttpContextToken<boolean>(() => false);

/** Exclude the request from the global loading indicator (polling, background refreshes). */
export const SKIP_LOADING = new HttpContextToken<boolean>(() => false);

export function authContext(
  options: { skipAuth?: boolean; skipErrorToast?: boolean; skipLoading?: boolean } = {},
): HttpContext {
  const context = new HttpContext();
  if (options.skipAuth === true) {
    context.set(SKIP_AUTH, true);
  }
  if (options.skipErrorToast === true) {
    context.set(SKIP_ERROR_TOAST, true);
  }
  if (options.skipLoading === true) {
    context.set(SKIP_LOADING, true);
  }
  return context;
}
