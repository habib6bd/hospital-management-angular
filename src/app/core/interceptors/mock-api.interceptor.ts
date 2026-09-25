import { inject } from '@angular/core';
import {
  HttpErrorResponse,
  HttpResponse,
  type HttpEvent,
  type HttpInterceptorFn,
} from '@angular/common/http';
import { Observable, from, switchMap, throwError, timer } from 'rxjs';
import { APP_CONFIG } from '../config/app-config';
import { detailError, randomLatency } from '../mock/mock-utils';
import type { MockHandler, MockRequest, MockResponse } from '../mock/mock-types';

let handlersPromise: Promise<readonly MockHandler[]> | null = null;

/**
 * The handlers and their seed data are the bulk of the mock backend, so they
 * load on the first API call instead of shipping in the initial bundle.
 */
function loadHandlers(): Promise<readonly MockHandler[]> {
  handlersPromise ??= import('../mock/handlers').then((module) => module.MOCK_HANDLERS);
  return handlersPromise;
}

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

  const latency = randomLatency(config.mockLatencyMs);

  return from(loadHandlers()).pipe(
    switchMap((handlers) => {
      const settled = dispatch(handlers, mockRequest);
      // `delay` does not defer errors, so the latency is applied with a timer that
      // the response is switched in after — errors and successes are both delayed.
      return timer(latency).pipe(switchMap(() => respond(settled, request.url)));
    }),
  );
};

function dispatch(handlers: readonly MockHandler[], mockRequest: MockRequest): MockResponse {
  try {
    for (const handler of handlers) {
      const result = handler(mockRequest);
      if (result !== null) {
        return result;
      }
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Mock handler failed.';
    return detailError(500, message);
  }
  return detailError(404, `No mock handler for ${mockRequest.method} ${mockRequest.path}`);
}

function respond(settled: MockResponse, url: string): Observable<HttpEvent<unknown>> {
  if (settled.status >= 400) {
    return throwError(
      () =>
        new HttpErrorResponse({
          status: settled.status,
          statusText: statusText(settled.status),
          url,
          error: settled.body,
        }),
    );
  }
  return new Observable<HttpEvent<unknown>>((subscriber) => {
    subscriber.next(
      new HttpResponse({
        status: settled.status,
        statusText: statusText(settled.status),
        url,
        body: settled.body,
      }),
    );
    subscriber.complete();
  });
}

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
