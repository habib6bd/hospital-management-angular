import {
  pattern,
  validate,
  type PathKind,
  type SchemaPath,
  type SchemaPathRules,
} from '@angular/forms/signals';
import { BD_PHONE_PATTERN } from './phone';

export { BD_PHONE_PATTERN, normalisePhone } from './phone';

/**
 * Reusable Signal Forms validators. Each applies logic to a schema path, so a
 * feature schema reads as:
 *
 *   schema<PatientForm>((path) => {
 *     required(path.fullName);
 *     bdPhone(path.phone);
 *     notInFuture(path.dateOfBirth, 'Date of birth');
 *   });
 *
 * Keeping the rules here — rather than inline per form — means a format change
 * (a new NID length, say) happens in exactly one place.
 */

/** A string field path that supports validation rules. */
type StringPath<TPathKind extends PathKind> = SchemaPath<
  string,
  SchemaPathRules.Supported,
  TPathKind
>;

/** Bangladesh NID: 10, 13 or 17 digits. */
export const NID_PATTERN = /^(\d{10}|\d{13}|\d{17})$/;


export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;
export type BloodGroup = (typeof BLOOD_GROUPS)[number];

export function isBloodGroup(value: unknown): value is BloodGroup {
  return typeof value === 'string' && (BLOOD_GROUPS as readonly string[]).includes(value);
}

export function nid<TPathKind extends PathKind = PathKind.Root>(
  path: StringPath<TPathKind>,
): void {
  pattern(path, NID_PATTERN, { message: 'Enter a valid NID (10, 13 or 17 digits).' });
}

export function bdPhone<TPathKind extends PathKind = PathKind.Root>(
  path: StringPath<TPathKind>,
): void {
  pattern(path, BD_PHONE_PATTERN, {
    message: 'Enter a valid Bangladeshi mobile number, e.g. 01712345678.',
  });
}

export function bloodGroup<TPathKind extends PathKind = PathKind.Root>(
  path: StringPath<TPathKind>,
): void {
  validate(path, ({ value }) => {
    const current = value();
    if (current === '' || isBloodGroup(current)) {
      return null;
    }
    return { kind: 'bloodGroup', message: 'Select a valid blood group.' };
  });
}

/** Rejects future dates — for a date of birth or a sample collection time. */
export function notInFuture<TPathKind extends PathKind = PathKind.Root>(
  path: StringPath<TPathKind>,
  label = 'Date',
): void {
  validate(path, ({ value }) => {
    const current = value();
    if (current === '') {
      return null;
    }
    const parsed = Date.parse(current);
    if (Number.isNaN(parsed)) {
      return { kind: 'invalidDate', message: `${label} is not a valid date.` };
    }
    if (parsed > Date.now()) {
      return { kind: 'futureDate', message: `${label} cannot be in the future.` };
    }
    return null;
  });
}

/** Requires a future date — for appointment slots and batch expiry. */
export function inFuture<TPathKind extends PathKind = PathKind.Root>(
  path: StringPath<TPathKind>,
  label = 'Date',
): void {
  validate(path, ({ value }) => {
    const current = value();
    if (current === '') {
      return null;
    }
    const parsed = Date.parse(current);
    if (Number.isNaN(parsed)) {
      return { kind: 'invalidDate', message: `${label} is not a valid date.` };
    }
    if (parsed <= Date.now()) {
      return { kind: 'pastDate', message: `${label} must be in the future.` };
    }
    return null;
  });
}

