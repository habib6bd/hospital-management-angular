import { Pipe, type PipeTransform } from '@angular/core';

/**
 * Money is stored as a decimal string on the wire (Django `DecimalField`) to
 * avoid float rounding, so the pipe accepts both and formats in BDT.
 */
@Pipe({ name: 'bdt' })
export class BdtPipe implements PipeTransform {
  private static readonly formatter = new Intl.NumberFormat('en-BD', {
    style: 'currency',
    currency: 'BDT',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
  });

  transform(value: number | string | null | undefined): string {
    if (value === null || value === undefined || value === '') {
      return '—';
    }
    const amount = typeof value === 'string' ? Number.parseFloat(value) : value;
    return Number.isNaN(amount) ? '—' : BdtPipe.formatter.format(amount);
  }
}

/** Short, unambiguous date — avoids the ambiguity of numeric-only formats. */
@Pipe({ name: 'hmsDate' })
export class HmsDatePipe implements PipeTransform {
  private static readonly dateOnly = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  private static readonly withTime = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  transform(value: string | Date | null | undefined, withTime = false): string {
    if (value === null || value === undefined || value === '') {
      return '—';
    }
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '—';
    }
    return withTime ? HmsDatePipe.withTime.format(date) : HmsDatePipe.dateOnly.format(date);
  }
}

/** "3 hours ago" / "in 2 days" — for queues, audit trails and notifications. */
@Pipe({ name: 'relativeTime' })
export class RelativeTimePipe implements PipeTransform {
  private static readonly formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

  private static readonly units: readonly [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 365 * 24 * 60 * 60_000],
    ['month', 30 * 24 * 60 * 60_000],
    ['day', 24 * 60 * 60_000],
    ['hour', 60 * 60_000],
    ['minute', 60_000],
  ];

  transform(value: string | Date | null | undefined): string {
    if (value === null || value === undefined || value === '') {
      return '—';
    }
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '—';
    }

    const deltaMs = date.getTime() - Date.now();
    for (const [unit, msPerUnit] of RelativeTimePipe.units) {
      if (Math.abs(deltaMs) >= msPerUnit) {
        return RelativeTimePipe.formatter.format(Math.round(deltaMs / msPerUnit), unit);
      }
    }
    return 'just now';
  }
}

/** Formats a date of birth as an age, which is what clinicians actually read. */
@Pipe({ name: 'age' })
export class AgePipe implements PipeTransform {
  transform(dateOfBirth: string | null | undefined): string {
    if (dateOfBirth === null || dateOfBirth === undefined || dateOfBirth === '') {
      return '—';
    }
    const born = new Date(dateOfBirth);
    if (Number.isNaN(born.getTime())) {
      return '—';
    }

    const now = new Date();
    let years = now.getFullYear() - born.getFullYear();
    const monthDelta = now.getMonth() - born.getMonth();
    if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < born.getDate())) {
      years -= 1;
    }

    if (years >= 1) {
      return `${years}y`;
    }
    // Infants are recorded in months — "0y" would be useless on a ward round.
    const months = Math.max(0, years * 12 + monthDelta);
    return `${months}m`;
  }
}

/** Turns a snake_case or kebab-case enum value into a display label. */
@Pipe({ name: 'humanise' })
export class HumanisePipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (value === null || value === undefined || value === '') {
      return '—';
    }
    return value
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, (character) => character.toUpperCase());
  }
}
