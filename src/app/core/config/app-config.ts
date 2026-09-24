import { InjectionToken, makeEnvironmentProviders, type EnvironmentProviders } from '@angular/core';

/**
 * App-wide runtime configuration. Kept as an injection token (not a module-level
 * constant) so tests and future environments can override it without touching
 * the services that consume it.
 */
export interface AppConfig {
  /** Base URL for the Django/DRF backend. Relative so SSR and the dev proxy both work. */
  readonly apiBaseUrl: string;
  /** When true, the mock interceptor answers /api/** in-memory instead of hitting Django. */
  readonly useMockApi: boolean;
  /** localStorage key holding the SimpleJWT token pair. */
  readonly tokenStorageKey: string;
  /** localStorage key holding the user's colour-scheme preference. */
  readonly themeStorageKey: string;
  /** Artificial latency range (ms) applied by the mock API. */
  readonly mockLatencyMs: readonly [number, number];
  /** Default page size, matching DRF's PAGE_SIZE setting. */
  readonly pageSize: number;
}

export const APP_CONFIG = new InjectionToken<AppConfig>('APP_CONFIG');

const DEFAULT_CONFIG: AppConfig = {
  apiBaseUrl: '/api',
  useMockApi: true,
  tokenStorageKey: 'hms.auth.tokens',
  themeStorageKey: 'hms.theme',
  mockLatencyMs: [150, 400],
  pageSize: 20,
};

export function provideAppConfig(overrides: Partial<AppConfig> = {}): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: APP_CONFIG, useValue: { ...DEFAULT_CONFIG, ...overrides } satisfies AppConfig },
  ]);
}
