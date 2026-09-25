import { DOCUMENT, Injectable, PLATFORM_ID, REQUEST, computed, effect, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { EN, type TranslationKey } from './dictionaries/en';
import { BN } from './dictionaries/bn';
import { isLang, toBnDigits, type Lang, type Localized } from './i18n.model';

const COOKIE_NAME = 'hms_lang';

const DICTIONARIES: Readonly<Record<Lang, Readonly<Record<TranslationKey, string>>>> = {
  en: EN,
  bn: BN,
};

/**
 * Runtime EN/BN switch for the public site.
 *
 * The choice lives in a cookie rather than only localStorage so that the server
 * renders the page in the visitor's language — otherwise a Bangla reader would
 * see English flash in before hydration.
 */
@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly document = inject(DOCUMENT);
  private readonly request = inject(REQUEST, { optional: true });
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly langSignal = signal<Lang>(this.readInitialLang());

  readonly lang = this.langSignal.asReadonly();
  readonly isBangla = computed(() => this.langSignal() === 'bn');

  constructor() {
    effect(() => {
      // Runs on the server too, so the rendered <html lang> is already right.
      this.document.documentElement.lang = this.langSignal();
    });
  }

  set(lang: Lang): void {
    this.langSignal.set(lang);
    if (!this.isBrowser) {
      return;
    }
    this.document.cookie = `${COOKIE_NAME}=${lang}; path=/; max-age=31536000; SameSite=Lax`;
  }

  toggle(): void {
    this.set(this.langSignal() === 'en' ? 'bn' : 'en');
  }

  /** Looks up a UI string; `{name}` placeholders are filled from `params`. */
  t(key: TranslationKey, params?: Readonly<Record<string, string | number>>): string {
    const template = DICTIONARIES[this.langSignal()][key];
    if (params === undefined) {
      return template;
    }
    return template.replace(/\{(\w+)\}/g, (whole, name: string) => {
      const value = params[name];
      return value === undefined ? whole : this.num(value);
    });
  }

  /** Picks the current language out of API content. */
  pick(value: Localized | null | undefined): string {
    if (value === null || value === undefined) {
      return '';
    }
    return value[this.langSignal()] || value.en;
  }

  /** Numbers, fees and times in the current script. */
  num(value: string | number): string {
    const text = String(value);
    return this.langSignal() === 'bn' ? toBnDigits(text) : text;
  }

  private readInitialLang(): Lang {
    const cookies = this.isBrowser
      ? this.document.cookie
      : (this.request?.headers.get('cookie') ?? '');
    const match = new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=(\\w+)`).exec(cookies);
    const value = match?.[1];
    return isLang(value) ? value : 'en';
  }
}
