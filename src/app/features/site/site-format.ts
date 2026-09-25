import { toBnDigits, type Lang } from '../../core/i18n/i18n.model';

/**
 * Date and time formatting for the public site. Intl handles the month and
 * weekday names in both languages; digits are converted separately because
 * `bn-BD` formatting is not consistent across browsers and the Node runtime
 * used for SSR — a mismatch would break hydration.
 */

const LOCALES: Readonly<Record<Lang, string>> = { en: 'en-GB', bn: 'bn-BD' };

/** A fixed Sunday, so `weekday` 0–6 maps straight onto a real date. */
const SUNDAY = Date.UTC(2024, 0, 7);

function digits(value: string, lang: Lang): string {
  return lang === 'bn' ? toBnDigits(value) : value;
}

export function weekdayShort(weekday: number, lang: Lang): string {
  return new Intl.DateTimeFormat(LOCALES[lang], { weekday: 'short', timeZone: 'UTC' }).format(
    SUNDAY + weekday * 86_400_000,
  );
}

export function weekdayLong(weekday: number, lang: Lang): string {
  return new Intl.DateTimeFormat(LOCALES[lang], { weekday: 'long', timeZone: 'UTC' }).format(
    SUNDAY + weekday * 86_400_000,
  );
}

/** `14:20` → `2:20 PM` / `২:২০ PM`. The AM/PM marker stays Latin in both languages, as clinic signage does. */
export function formatTime(time: string, lang: Lang): string {
  const [h = '0', m = '0'] = time.split(':');
  const hours = Number(h);
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${digits(`${hour12}:${m.padStart(2, '0')}`, lang)} ${suffix}`;
}

/** Parses `YYYY-MM-DD` as a local calendar date (no timezone shift). */
export function parseIsoDate(iso: string): Date {
  const [y = 1970, m = 1, d = 1] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** `Fri, 26 Sep 2026` in English; the Bangla equivalent in Bangla. */
export function formatDate(iso: string, lang: Lang, style: 'long' | 'short' = 'long'): string {
  const date = parseIsoDate(iso);
  const options: Intl.DateTimeFormatOptions =
    style === 'long'
      ? { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }
      : { day: 'numeric', month: 'short' };
  return digits(new Intl.DateTimeFormat(LOCALES[lang], options).format(date), lang);
}

export function monthShort(iso: string, lang: Lang): string {
  return new Intl.DateTimeFormat(LOCALES[lang], { month: 'short' }).format(parseIsoDate(iso));
}

export function dayOfMonth(iso: string, lang: Lang): string {
  return digits(String(parseIsoDate(iso).getDate()), lang);
}
