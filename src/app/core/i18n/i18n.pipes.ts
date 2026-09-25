import { Pipe, inject, type PipeTransform } from '@angular/core';
import { I18nService } from './i18n.service';
import type { TranslationKey } from './dictionaries/en';
import type { Localized } from './i18n.model';

/*
 * These pipes are impure on purpose: they read the language signal, and an
 * impure pipe runs inside the template's reactive context, so switching
 * language re-renders every OnPush view that shows translated text. The work
 * per call is a map lookup, so running each check is cheap.
 */

/** `{{ 'nav.home' | t }}` or `{{ 'doctors.count' | t: { n: 12 } }}` */
@Pipe({ name: 't', pure: false })
export class TranslatePipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(key: TranslationKey, params?: Readonly<Record<string, string | number>>): string {
    return this.i18n.t(key, params);
  }
}

/** `{{ department.name | loc }}` for `{ en, bn }` API content. */
@Pipe({ name: 'loc', pure: false })
export class LocalizedPipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(value: Localized | null | undefined): string {
    return this.i18n.pick(value);
  }
}

/** `{{ fee | num }}` renders digits in Bangla numerals when the site is in Bangla. */
@Pipe({ name: 'num', pure: false })
export class NumeralPipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(value: string | number | null | undefined): string {
    return value === null || value === undefined ? '' : this.i18n.num(value);
  }
}

export const I18N_PIPES = [TranslatePipe, LocalizedPipe, NumeralPipe] as const;
