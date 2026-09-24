import { DOCUMENT, Injectable, PLATFORM_ID, computed, effect, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { APP_CONFIG } from '../config/app-config';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

/**
 * Owns the `dark` class on <html>. The preference is a signal; an effect
 * reflects it onto the DOM, so no component ever touches classList directly.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly config = inject(APP_CONFIG);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly preferenceSignal = signal<ThemePreference>(this.readStoredPreference());
  private readonly systemPrefersDark = signal(false);

  readonly preference = this.preferenceSignal.asReadonly();

  readonly resolved = computed<ResolvedTheme>(() => {
    const preference = this.preferenceSignal();
    if (preference === 'system') {
      return this.systemPrefersDark() ? 'dark' : 'light';
    }
    return preference;
  });

  constructor() {
    if (this.isBrowser) {
      const query = window.matchMedia('(prefers-color-scheme: dark)');
      this.systemPrefersDark.set(query.matches);
      query.addEventListener('change', (event) => this.systemPrefersDark.set(event.matches));
    }

    effect(() => {
      const theme = this.resolved();
      if (!this.isBrowser) {
        return;
      }
      this.document.documentElement.classList.toggle('dark', theme === 'dark');
    });
  }

  set(preference: ThemePreference): void {
    this.preferenceSignal.set(preference);
    if (!this.isBrowser) {
      return;
    }
    try {
      localStorage.setItem(this.config.themeStorageKey, preference);
    } catch {
      // Preference simply will not persist across reloads.
    }
  }

  toggle(): void {
    this.set(this.resolved() === 'dark' ? 'light' : 'dark');
  }

  private readStoredPreference(): ThemePreference {
    if (!this.isBrowser) {
      return 'system';
    }
    try {
      const stored = localStorage.getItem(this.config.themeStorageKey);
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        return stored;
      }
    } catch {
      // Fall through to the default.
    }
    return 'system';
  }
}
