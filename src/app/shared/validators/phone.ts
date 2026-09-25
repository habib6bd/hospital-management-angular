/**
 * Phone rules with no Angular dependency, so code outside forms (the mock
 * backend, services) can use them without pulling `@angular/forms` into the
 * initial bundle. `hms-validators.ts` re-exports these.
 */

/** Bangladesh mobile: optional +88 prefix, then 01[3-9] and eight more digits. */
export const BD_PHONE_PATTERN = /^(?:\+?88)?01[3-9]\d{8}$/;

/** Normalises a phone number to the form the backend stores (no +88 prefix). */
export function normalisePhone(value: string): string {
  return value.replace(/^\+?88/, '').replace(/[\s-]/g, '');
}
