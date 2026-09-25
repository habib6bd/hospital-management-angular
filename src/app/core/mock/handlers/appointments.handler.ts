import { db, nextId } from '../db';
import {
  created,
  detailError,
  isoDate,
  isoDateTime,
  match,
  notFound,
  ok,
  orderBy,
  paginate,
  searchFilter,
  validationError,
} from '../mock-utils';
import { addMinutes, toMinutes } from '../seeds/appointments.seed';
import { currentUser } from './auth.handler';
import type { MockHandler, MockRequest } from '../mock-types';
import type { AppointmentDto, TimeSlotDto } from '../../../shared/models/appointment.dto';

const DEFAULT_PAGE_SIZE = 20;

/** Statuses that still hold a slot; a cancelled booking frees it again. */
const SLOT_HOLDING_STATUSES = new Set(['booked', 'checked_in', 'in_consultation', 'completed']);

function body(request: MockRequest): Record<string, unknown> {
  return (request.body ?? {}) as Record<string, unknown>;
}

export function computeSlots(doctorId: number, date: string): TimeSlotDto[] {
  const weekday = new Date(date).getDay();
  const schedules = db.doctorSchedules.filter(
    (schedule) => schedule.doctor === doctorId && schedule.weekday === weekday && schedule.is_active,
  );
  if (schedules.length === 0) {
    return [];
  }

  const taken = new Map<string, string>();
  for (const appointment of db.appointments) {
    if (
      appointment.doctor === doctorId &&
      appointment.date === date &&
      SLOT_HOLDING_STATUSES.has(appointment.status)
    ) {
      taken.set(appointment.start_time, appointment.patient_name);
    }
  }

  const slots: TimeSlotDto[] = [];
  const now = new Date();
  const isToday = date === isoDate(0);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  for (const schedule of schedules) {
    for (
      let minute = toMinutes(schedule.start_time);
      minute + schedule.slot_minutes <= toMinutes(schedule.end_time);
      minute += schedule.slot_minutes
    ) {
      const startTime = addMinutes('00:00', minute);
      const takenBy = taken.get(startTime) ?? null;
      // A slot that has already passed today cannot be booked either.
      const inPast = isToday && minute <= nowMinutes;

      slots.push({
        start_time: startTime,
        end_time: addMinutes(startTime, schedule.slot_minutes),
        is_available: takenBy === null && !inPast,
        taken_by: takenBy,
      });
    }
  }

  return slots.sort((a, b) => a.start_time.localeCompare(b.start_time));
}

export function nextTokenNumber(doctorId: number, date: string): number {
  const sameClinic = db.appointments.filter(
    (appointment) => appointment.doctor === doctorId && appointment.date === date,
  );
  return sameClinic.reduce((max, row) => Math.max(max, row.token_number ?? 0), 0) + 1;
}

function replaceAppointment(id: number, changes: Partial<AppointmentDto>): AppointmentDto | null {
  const index = db.appointments.findIndex((row) => row.id === id);
  if (index < 0) {
    return null;
  }
  const updated = { ...db.appointments[index]!, ...changes };
  db.appointments[index] = updated;
  return updated;
}

export const appointmentsHandler: MockHandler = (request) => {
  if (
    !request.path.startsWith('/appointments/') &&
    !request.path.startsWith('/doctors/') &&
    !request.path.startsWith('/schedules/')
  ) {
    return null;
  }

  if (currentUser(request) === null) {
    return detailError(401, 'Authentication credentials were not provided.');
  }

  /* ----------------------------------------------------------- doctors */

  if (match(request, 'GET', '/doctors/') !== null) {
    let rows = searchFilter(db.doctors, request.params.get('search'), [
      'full_name',
      'specialty',
      'department',
    ]);
    const department = request.params.get('department');
    if (department !== null && department !== '') {
      rows = rows.filter((row) => row.department === department);
    }
    return ok({ count: rows.length, next: null, previous: null, results: rows });
  }

  const doctorSlots = match(request, 'GET', '/doctors/:id/slots/');
  if (doctorSlots !== null) {
    const date = request.params.get('date');
    if (date === null || date === '') {
      return validationError({ date: ['This query parameter is required.'] });
    }
    return ok({ results: computeSlots(Number(doctorSlots['id']), date) });
  }

  /* --------------------------------------------------------- schedules */

  if (match(request, 'GET', '/schedules/') !== null) {
    const doctor = request.params.get('doctor');
    const rows =
      doctor === null || doctor === ''
        ? db.doctorSchedules
        : db.doctorSchedules.filter((row) => row.doctor === Number(doctor));
    return ok({ count: rows.length, next: null, previous: null, results: rows });
  }

  const toggleSchedule = match(request, 'PATCH', '/schedules/:id/');
  if (toggleSchedule !== null) {
    const id = Number(toggleSchedule['id']);
    const index = db.doctorSchedules.findIndex((row) => row.id === id);
    if (index < 0) {
      return notFound('Schedule not found.');
    }
    const payload = body(request);
    const updated = {
      ...db.doctorSchedules[index]!,
      ...(typeof payload['is_active'] === 'boolean' ? { is_active: payload['is_active'] } : {}),
      ...(typeof payload['start_time'] === 'string' ? { start_time: payload['start_time'] } : {}),
      ...(typeof payload['end_time'] === 'string' ? { end_time: payload['end_time'] } : {}),
      ...(typeof payload['slot_minutes'] === 'number'
        ? { slot_minutes: payload['slot_minutes'] }
        : {}),
    };
    db.doctorSchedules[index] = updated;
    return ok(updated);
  }

  /* ------------------------------------------------------ appointments */

  if (match(request, 'GET', '/appointments/') !== null) {
    let rows: readonly AppointmentDto[] = db.appointments;

    const date = request.params.get('date');
    if (date !== null && date !== '') {
      rows = rows.filter((row) => row.date === date);
    }

    const dateFrom = request.params.get('date_after');
    if (dateFrom !== null && dateFrom !== '') {
      rows = rows.filter((row) => row.date >= dateFrom);
    }

    const dateTo = request.params.get('date_before');
    if (dateTo !== null && dateTo !== '') {
      rows = rows.filter((row) => row.date <= dateTo);
    }

    const doctor = request.params.get('doctor');
    if (doctor !== null && doctor !== '') {
      rows = rows.filter((row) => row.doctor === Number(doctor));
    }

    const patient = request.params.get('patient');
    if (patient !== null && patient !== '') {
      rows = rows.filter((row) => row.patient === Number(patient));
    }

    // `status__in=booked,checked_in` — DRF's `BaseInFilter` convention.
    const statusIn = request.params.get('status__in');
    if (statusIn !== null && statusIn !== '') {
      const allowed = new Set(statusIn.split(','));
      rows = rows.filter((row) => allowed.has(row.status));
    }

    const status = request.params.get('status');
    if (status !== null && status !== '') {
      rows = rows.filter((row) => row.status === status);
    }

    rows = searchFilter(rows, request.params.get('search'), [
      'patient_name',
      'patient_mrn',
      'doctor_name',
      'reason',
    ]);
    rows = orderBy(rows, request.params.get('ordering') ?? 'start_time');

    return ok(paginate(rows, request, DEFAULT_PAGE_SIZE));
  }

  if (match(request, 'POST', '/appointments/') !== null) {
    const payload = body(request);
    const patientId = Number(payload['patient']);
    const doctorId = Number(payload['doctor']);
    const date = typeof payload['date'] === 'string' ? payload['date'] : '';
    const startTime = typeof payload['start_time'] === 'string' ? payload['start_time'] : '';

    const errors: Record<string, string[]> = {};
    const patient = db.patients.find((row) => row.id === patientId);
    const doctor = db.doctors.find((row) => row.id === doctorId);

    if (patient === undefined) {
      errors['patient'] = ['Select a valid patient.'];
    }
    if (doctor === undefined) {
      errors['doctor'] = ['Select a valid doctor.'];
    }
    if (date === '') {
      errors['date'] = ['This field is required.'];
    }
    if (startTime === '') {
      errors['start_time'] = ['This field is required.'];
    }
    if (Object.keys(errors).length > 0) {
      return validationError(errors);
    }

    const slot = computeSlots(doctorId, date).find((entry) => entry.start_time === startTime);
    if (slot === undefined) {
      return validationError({ start_time: ['That time is outside the doctor’s clinic hours.'] });
    }
    if (!slot.is_available) {
      // The classic double-booking race: two receptionists, one slot.
      return validationError({ start_time: ['That slot has just been taken.'] });
    }

    const appointment: AppointmentDto = {
      id: nextId('appointments', db.appointments),
      patient: patientId,
      patient_name: patient!.full_name,
      patient_mrn: patient!.mrn,
      doctor: doctorId,
      doctor_name: doctor!.full_name,
      specialty: doctor!.specialty,
      date,
      start_time: startTime,
      end_time: slot.end_time,
      status: 'booked',
      token_number: nextTokenNumber(doctorId, date),
      reason: typeof payload['reason'] === 'string' ? payload['reason'] : '',
      checked_in_at: null,
      created_at: isoDateTime(0),
    };

    db.appointments = [appointment, ...db.appointments];
    return created(appointment);
  }

  const detail = match(request, 'GET', '/appointments/:id/');
  if (detail !== null) {
    const row = db.appointments.find((appointment) => appointment.id === Number(detail['id']));
    return row === undefined ? notFound('Appointment not found.') : ok(row);
  }

  const transition = match(request, 'POST', '/appointments/:id/:action/');
  if (transition !== null) {
    const id = Number(transition['id']);
    const action = transition['action'] ?? '';
    const appointment = db.appointments.find((row) => row.id === id);
    if (appointment === undefined) {
      return notFound('Appointment not found.');
    }

    const target = TRANSITIONS[action];
    if (target === undefined) {
      return notFound('Unknown action.');
    }
    // The state machine lives server-side; the UI only offers legal moves.
    if (!target.from.includes(appointment.status)) {
      return detailError(
        409,
        `Cannot ${action.replace('-', ' ')} an appointment that is ${appointment.status.replace('_', ' ')}.`,
      );
    }

    const updated = replaceAppointment(id, {
      status: target.to,
      ...(target.to === 'checked_in' ? { checked_in_at: isoDateTime(0) } : {}),
    });
    return ok(updated);
  }

  return null;
};

const TRANSITIONS: Readonly<Record<string, { from: readonly string[]; to: string }>> = {
  'check-in': { from: ['booked'], to: 'checked_in' },
  start: { from: ['checked_in'], to: 'in_consultation' },
  complete: { from: ['in_consultation', 'checked_in'], to: 'completed' },
  cancel: { from: ['booked', 'checked_in'], to: 'cancelled' },
  'no-show': { from: ['booked', 'checked_in'], to: 'no_show' },
};
