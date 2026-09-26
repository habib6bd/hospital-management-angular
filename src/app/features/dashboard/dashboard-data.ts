import { addDays } from '../appointments/appointment.service';
import type { Appointment } from '../../shared/models/appointment.model';

/** The `count` ISO dates ending on `today`, oldest first. */
export function trailingDays(today: string, count: number): readonly string[] {
  return Array.from({ length: count }, (_, index) => addDays(today, index - (count - 1)));
}

/**
 * Visits per day for the inflow chart. Cancelled bookings never reached the
 * hospital, so they are not counted; no-shows are, because the slot was used.
 */
export function countVisitsByDay(
  appointments: readonly Appointment[],
  days: readonly string[],
): readonly number[] {
  const counts = new Map<string, number>(days.map((day) => [day, 0]));
  for (const appointment of appointments) {
    const current = counts.get(appointment.date);
    if (current !== undefined && appointment.status !== 'cancelled') {
      counts.set(appointment.date, current + 1);
    }
  }
  return days.map((day) => counts.get(day) ?? 0);
}

const DAY_LABEL = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric' });

/** `Mon 21` — short enough for a 7-bar axis, unambiguous within a week. */
export function dayLabel(isoDate: string): string {
  return DAY_LABEL.format(new Date(`${isoDate}T00:00:00`));
}

/** Whole-number percentage for a 0–1 ratio. */
export function percent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}
