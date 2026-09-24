import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { APP_CONFIG } from '../config/app-config';
import type { AuthTokens } from './auth.model';

/**
 * The only place that touches `localStorage` for auth. Every access is guarded
 * for SSR and wrapped for private-mode/quota failures, so callers never have to
 * think about the platform.
 */
@Injectable({ providedIn: 'root' })
export class TokenStorageService {
  private readonly config = inject(APP_CONFIG);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  read(): AuthTokens | null {
    if (!this.isBrowser) {
      return null;
    }
    try {
      const raw = localStorage.getItem(this.config.tokenStorageKey);
      if (raw === null) {
        return null;
      }
      const parsed: unknown = JSON.parse(raw);
      if (parsed === null || typeof parsed !== 'object') {
        return null;
      }
      const record = parsed as Record<string, unknown>;
      if (typeof record['access'] !== 'string' || typeof record['refresh'] !== 'string') {
        return null;
      }
      return { access: record['access'], refresh: record['refresh'] };
    } catch {
      return null;
    }
  }

  write(tokens: AuthTokens): void {
    if (!this.isBrowser) {
      return;
    }
    try {
      localStorage.setItem(this.config.tokenStorageKey, JSON.stringify(tokens));
    } catch {
      // Storage unavailable (private mode / quota). The in-memory signal still
      // holds the tokens for this tab, so the session keeps working.
    }
  }

  clear(): void {
    if (!this.isBrowser) {
      return;
    }
    try {
      localStorage.removeItem(this.config.tokenStorageKey);
    } catch {
      // Nothing to recover from — the in-memory state is already cleared.
    }
  }
}
