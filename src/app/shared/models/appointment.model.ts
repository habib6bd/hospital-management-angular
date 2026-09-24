export type AppointmentStatus =
  | 'booked'
  | 'checked_in'
  | 'in_consultation'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export const APPOINTMENT_STATUS_LABELS: Readonly<Record<AppointmentStatus, string>> = {
  booked: 'Booked',
  checked_in: 'Checked in',
  in_consultation: 'In consultation',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No show',
};

/** Statuses a patient can still be seen under — drives the live queue. */
export const ACTIVE_QUEUE_STATUSES: readonly AppointmentStatus[] = [
  'booked',
  'checked_in',
  'in_consultation',
];

export interface Doctor {
  readonly id: number;
  readonly fullName: string;
  readonly specialty: string;
  readonly department: string;
  readonly consultationFee: number;
  readonly roomNumber: string;
}

export interface Appointment {
  readonly id: number;
  readonly patientId: number;
  readonly patientName: string;
  readonly patientMrn: string;
  readonly doctorId: number;
  readonly doctorName: string;
  readonly specialty: string;
  /** ISO date, `YYYY-MM-DD`. */
  readonly date: string;
  /** `HH:mm`, local clinic time. */
  readonly startTime: string;
  readonly endTime: string;
  readonly status: AppointmentStatus;
  readonly tokenNumber: number | null;
  readonly reason: string;
  readonly checkedInAt: string | null;
  readonly createdAt: string;
}

/** A schedule template: which days and hours a doctor sits, and slot length. */
export interface DoctorSchedule {
  readonly id: number;
  readonly doctorId: number;
  readonly doctorName: string;
  /** 0 = Sunday, matching `Date.getDay()`. */
  readonly weekday: number;
  readonly startTime: string;
  readonly endTime: string;
  readonly slotMinutes: number;
  readonly isActive: boolean;
}

export interface TimeSlot {
  readonly startTime: string;
  readonly endTime: string;
  readonly isAvailable: boolean;
  /** Set when the slot is taken, so the UI can explain why. */
  readonly takenBy: string | null;
}

export interface AppointmentInput {
  readonly patientId: number;
  readonly doctorId: number;
  readonly date: string;
  readonly startTime: string;
  readonly reason: string;
}

export const WEEKDAY_LABELS: readonly string[] = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

/** Queue tone: waiting is amber, in-consultation green, closed neutral. */
export function appointmentTone(
  status: AppointmentStatus,
): 'ready' | 'pending' | 'critical' | 'info' | 'neutral' {
  switch (status) {
    case 'in_consultation':
      return 'ready';
    case 'checked_in':
      return 'pending';
    case 'booked':
      return 'info';
    case 'no_show':
      return 'critical';
    default:
      return 'neutral';
  }
}
