export const LANGS = ['en', 'bn'] as const;

export type Lang = (typeof LANGS)[number];

export function isLang(value: unknown): value is Lang {
  return typeof value === 'string' && (LANGS as readonly string[]).includes(value);
}

/** Content that exists in both site languages, as served by the public API. */
export interface Localized {
  readonly en: string;
  readonly bn: string;
}

const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

/** Swaps ASCII digits for Bangla numerals; everything else is left alone. */
export function toBnDigits(value: string): string {
  return value.replace(/\d/g, (digit) => BN_DIGITS[Number(digit)]!);
}
