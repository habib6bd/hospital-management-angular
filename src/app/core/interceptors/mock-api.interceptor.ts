import { inject } from '@angular/core';
import {
  HttpErrorResponse,
  HttpResponse,
  type HttpEvent,
  type HttpInterceptorFn,
} from '@angular/common/http';
import { Observable, switchMap, throwError, timer } from 'rxjs';
import { APP_CONFIG } from '../config/app-config';
import { MOCK_HANDLERS } from '../mock/handlers';
import { detailError, randomLatency } from '../mock/mock-utils';
import type { MockRequest, MockResponse } from '../mock/mock-types';

/**
 * Stands in for the Django backend until it exists. It is the innermost
 * interceptor, so requests reach it having already passed through auth and
 * error handling — meaning the real interceptor chain is exercised end to end.
 *
 * Removing `provideMockApi()` (or setting `useMockApi: false`) is the only
 * change needed to point the app at the real server.
 */
export const mockApiInterceptor: HttpInterceptorFn = (request, next) => {
  const config = inject(APP_CONFIG);

  if (!config.useMockApi) {
    return next(request);
  }

  const url = new URL(request.urlWithParams, 'http://localhost');
  if (!url.pathname.startsWith(config.apiBaseUrl)) {
    // Not an API call (assets, templates) — let it through untouched.
    return next(request);
  }

  const mockRequest: MockRequest = {
    method: request.method.toUpperCase(),
    path: normalisePath(url.pathname.slice(config.apiBaseUrl.length)),
    params: url.searchParams,
    body: request.body,
    headers: request.headers,
  };

  let result: MockResponse | null = null;
  try {
    for (const handler of MOCK_HANDLERS) {
      result = handler(mockRequest);
      if (result !== null) {
        break;
      }
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Mock handler failed.';
    result = detailError(500, message);
  }

  if (result === null) {
    result = detailError(404, `No mock handler for ${mockRequest.method} ${mockRequest.path}`);
  }

  const latency = randomLatency(config.mockLatencyMs);
  const settled: MockResponse = result;

  // `delay` does not defer errors, so the latency is applied with a timer that
  // the response is switched in after — errors and successes are both delayed.
  return timer(latency).pipe(
    switchMap((): Observable<HttpEvent<unknown>> =>
      settled.status >= 400
      ? throwError(
          () =>
            new HttpErrorResponse({
              status: settled.status,
              statusText: statusText(settled.status),
              url: request.url,
              error: settled.body,
            }),
        )
      : new Observable<HttpEvent<unknown>>((subscriber) => {
          subscriber.next(
            new HttpResponse({
              status: settled.status,
              statusText: statusText(settled.status),
              url: request.url,
              body: settled.body,
            }),
          );
          subscriber.complete();
        }),
    ),
  );
};

/** DRF routes end in a slash; normalise so handler templates can rely on it. */
function normalisePath(path: string): string {
  const withLeading = path.startsWith('/') ? path : `/${path}`;
  return withLeading.endsWith('/') ? withLeading : `${withLeading}/`;
}

function statusText(status: number): string {
  switch (status) {
    case 200:
      return 'OK';
    case 201:
      return 'Created';
    case 204:
      return 'No Content';
    case 400:
      return 'Bad Request';
    case 401:
      return 'Unauthorized';
    case 403:
      return 'Forbidden';
    case 404:
      return 'Not Found';
    case 409:
      return 'Conflict';
    default:
      return status >= 500 ? 'Server Error' : 'Error';
  }
}
