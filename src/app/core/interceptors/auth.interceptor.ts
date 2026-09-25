import { inject } from '@angular/core';
import {
  HttpErrorResponse,
  type HttpEvent,
  type HttpInterceptorFn,
  type HttpRequest,
} from '@angular/common/http';
import { catchError, from, switchMap, throwError, type Observable } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { SKIP_AUTH } from '../http/http-context';

function withBearer(request: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return request.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

/**
 * Attaches the SimpleJWT access token, and on a 401 performs one refresh (see
 * `AuthService.refreshSession`, which is single-flight) before replaying the
 * original request. A second 401 after refresh ends the session.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  if (request.context.get(SKIP_AUTH)) {
    return next(request);
  }

  const auth = inject(AuthService);
  const token = auth.accessToken();
  const outgoing = token === null ? request : withBearer(request, token);

  return next(outgoing).pipe(
    catchError((error: unknown): Observable<HttpEvent<unknown>> => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401 || token === null) {
        return throwError(() => error);
      }

      return from(auth.refreshSession()).pipe(
        switchMap((tokens) => {
          if (tokens === null) {
            // Refresh token is dead — the service has already cleared the session.
            void auth.logout('/login');
            return throwError(() => error);
          }
          return next(withBearer(request, tokens.access));
        }),
      );
    }),
  );
};
