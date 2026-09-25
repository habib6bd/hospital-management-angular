import { db, nextId } from '../db';
import {
  created,
  isoDate,
  isoDateTime,
  match,
  notFound,
  ok,
  paginate,
  validationError,
} from '../mock-utils';
import {
  DEPARTMENT_SEED,
  DOCTOR_PROFILES,
  LANGUAGES_SPOKEN,
  PACKAGE_SEED,
  SERVICE_SEED,
  SPECIALTY_TO_DEPARTMENT,
  TESTIMONIAL_SEED,
  specialtyLabel,
} from '../seeds/public.seed';
import { computeSlots, nextTokenNumber } from './appointments.handler';
import { BD_PHONE_PATTERN, normalisePhone } from '../../../shared/validators/phone';
import type { MockHandler, MockRequest } from '../mock-types';
import type { AppointmentDto, DoctorDto } from '../../../shared/models/appointment.dto';
import type {
  BookingConfirmationDto,
  DepartmentDto,
  PublicDoctorDto,
  PublicSlotDto,
} from '../../../shared/models/public.dto';

/**
 * `/api/public/**` — everything the public website reads and writes. No
 * endpoint here requires a session, so it must run before the staff handlers,
 * which answer any unauthenticated request with a 401.
 *
 * Nothing here exposes patient data: slots say only whether they are free, and
 * a booking lookup needs both the reference and the phone number it was made with.
 */

const DOCTOR_PAGE_SIZE = 12;
/** How far ahead the public site lets a visitor book. */
const BOOKING_WINDOW_DAYS = 14;

function body(request: MockRequest): Record<string, unknown> {
  return (request.body ?? {}) as Record<string, unknown>;
}

function text(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  return typeof value === 'string' ? value.trim() : '';
}

function departmentSlugOf(doctor: DoctorDto): string {
  return SPECIALTY_TO_DEPARTMENT[doctor.specialty] ?? 'medicine';
}

function toPublicDoctor(doctor: DoctorDto): PublicDoctorDto {
  const profile = DOCTOR_PROFILES[doctor.id];
  const slug = departmentSlugOf(doctor);
  const department = DEPARTMENT_SEED.find((row) => row.slug === slug);
  const chamber = db.doctorSchedules
    .filter((schedule) => schedule.doctor === doctor.id && schedule.is_active)
    .sort((a, b) => a.weekday - b.weekday)
    .map((schedule) => ({
      weekday: schedule.weekday,
      start_time: schedule.start_time,
      end_time: schedule.end_time,
    }));

  return {
    id: doctor.id,
    name: { en: doctor.full_name, bn: profile?.name_bn ?? doctor.full_name },
    specialty: specialtyLabel(doctor.specialty),
    department_slug: slug,
    department_name: department?.name ?? { en: doctor.department, bn: doctor.department },
    designation: profile?.designation ?? { en: 'Consultant', bn: 'কনসালট্যান্ট' },
    qualifications: profile?.qualifications ?? 'MBBS',
    experience_years: profile?.experience_years ?? 5,
    consultation_fee: doctor.consultation_fee,
    room_number: doctor.room_number,
    gender: profile?.gender ?? 'male',
    languages: LANGUAGES_SPOKEN,
    bio: profile?.bio ?? { en: '', bn: '' },
    // Demo portraits exist only for the seeded profiles; others show initials.
    photo_url: profile === undefined ? null : `/images/doctors/dr-${doctor.id}.webp`,
    chamber,
  };
}

function toDepartmentDto(row: (typeof DEPARTMENT_SEED)[number]): DepartmentDto {
  return {
    ...row,
    doctor_count: db.doctors.filter((doctor) => departmentSlugOf(doctor) === row.slug).length,
  };
}

/** `CW-YYMMDD-0042`: short enough to read over the phone, unique per appointment. */
function bookingReference(date: string, appointmentId: number): string {
  return `CW-${date.slice(2).replaceAll('-', '')}-${String(appointmentId).padStart(4, '0')}`;
}

function toConfirmation(appointment: AppointmentDto, reference: string, phone: string): BookingConfirmationDto {
  const doctor = db.doctors.find((row) => row.id === appointment.doctor);
  const profile = DOCTOR_PROFILES[appointment.doctor];
  return {
    reference,
    serial_no: appointment.token_number ?? 0,
    doctor: appointment.doctor,
    doctor_name: { en: appointment.doctor_name, bn: profile?.name_bn ?? appointment.doctor_name },
    specialty: specialtyLabel(appointment.specialty),
    date: appointment.date,
    start_time: appointment.start_time,
    end_time: appointment.end_time,
    room_number: doctor?.room_number ?? '',
    consultation_fee: doctor?.consultation_fee ?? '0.00',
    patient_name: appointment.patient_name,
    phone,
  };
}

function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 86_400_000);
}

export const publicHandler: MockHandler = (request) => {
  if (!request.path.startsWith('/public/')) {
    return null;
  }

  /* ------------------------------------------------------ departments */

  if (match(request, 'GET', '/public/departments/') !== null) {
    const rows = DEPARTMENT_SEED.map(toDepartmentDto);
    return ok({ count: rows.length, next: null, previous: null, results: rows });
  }

  const department = match(request, 'GET', '/public/departments/:slug/');
  if (department !== null) {
    const row = DEPARTMENT_SEED.find((entry) => entry.slug === department['slug']);
    return row === undefined ? notFound('Department not found.') : ok(toDepartmentDto(row));
  }

  /* ---------------------------------------------------------- doctors */

  if (match(request, 'GET', '/public/doctors/') !== null) {
    let rows = db.doctors.map(toPublicDoctor);

    const slug = request.params.get('department');
    if (slug !== null && slug !== '') {
      rows = rows.filter((row) => row.department_slug === slug);
    }

    const day = request.params.get('day');
    if (day !== null && day !== '') {
      rows = rows.filter((row) => row.chamber.some((time) => time.weekday === Number(day)));
    }

    const gender = request.params.get('gender');
    if (gender !== null && gender !== '') {
      rows = rows.filter((row) => row.gender === gender);
    }

    const search = request.params.get('search')?.trim().toLowerCase() ?? '';
    if (search !== '') {
      // Matches both scripts, so a visitor can type in Bangla or English.
      rows = rows.filter((row) =>
        [row.name.en, row.name.bn, row.specialty.en, row.specialty.bn, row.department_name.en, row.department_name.bn]
          .some((value) => value.toLowerCase().includes(search)),
      );
    }

    // Seniority first — the order a visitor expects on a hospital's doctor list.
    rows = [...rows].sort((a, b) => b.experience_years - a.experience_years);
    return ok(paginate(rows, request, DOCTOR_PAGE_SIZE));
  }

  const doctorSlots = match(request, 'GET', '/public/doctors/:id/slots/');
  if (doctorSlots !== null) {
    const date = request.params.get('date') ?? '';
    if (date === '') {
      return validationError({ date: ['This query parameter is required.'] });
    }
    // Who holds a slot is private; the public site only learns that it is taken.
    const results: PublicSlotDto[] = computeSlots(Number(doctorSlots['id']), date).map((slot) => ({
      start_time: slot.start_time,
      end_time: slot.end_time,
      is_available: slot.is_available,
    }));
    return ok({ results });
  }

  const doctor = match(request, 'GET', '/public/doctors/:id/');
  if (doctor !== null) {
    const row = db.doctors.find((entry) => entry.id === Number(doctor['id']));
    return row === undefined ? notFound('Doctor not found.') : ok(toPublicDoctor(row));
  }

  /* --------------------------------------------- services & content */

  if (match(request, 'GET', '/public/services/') !== null) {
    return ok({ count: SERVICE_SEED.length, next: null, previous: null, results: SERVICE_SEED });
  }

  const service = match(request, 'GET', '/public/services/:slug/');
  if (service !== null) {
    const row = SERVICE_SEED.find((entry) => entry.slug === service['slug']);
    return row === undefined ? notFound('Service not found.') : ok(row);
  }

  if (match(request, 'GET', '/public/packages/') !== null) {
    return ok({ count: PACKAGE_SEED.length, next: null, previous: null, results: PACKAGE_SEED });
  }

  if (match(request, 'GET', '/public/testimonials/') !== null) {
    return ok({
      count: TESTIMONIAL_SEED.length,
      next: null,
      previous: null,
      results: TESTIMONIAL_SEED,
    });
  }

  /* ---------------------------------------------------- guest booking */

  if (match(request, 'POST', '/public/appointments/') !== null) {
    const payload = body(request);
    const doctorId = Number(payload['doctor']);
    const date = text(payload, 'date');
    const startTime = text(payload, 'start_time');
    const name = text(payload, 'name');
    const phone = normalisePhone(text(payload, 'phone'));
    const age = Number(payload['age']);
    const gender = text(payload, 'gender');

    const errors: Record<string, string[]> = {};
    const doctorRow = db.doctors.find((row) => row.id === doctorId);
    if (doctorRow === undefined) {
      errors['doctor'] = ['Select a valid doctor.'];
    }
    const offset = date === '' ? -1 : daysBetween(isoDate(0), date);
    if (offset < 0 || offset > BOOKING_WINDOW_DAYS) {
      errors['date'] = [`Choose a date within the next ${BOOKING_WINDOW_DAYS} days.`];
    }
    if (startTime === '') {
      errors['start_time'] = ['Choose a time slot.'];
    }
    if (name.length < 2) {
      errors['name'] = ['Enter the patient’s full name.'];
    }
    if (!BD_PHONE_PATTERN.test(phone)) {
      errors['phone'] = ['Enter a valid Bangladeshi mobile number, e.g. 01712345678.'];
    }
    if (!Number.isInteger(age) || age < 0 || age > 120) {
      errors['age'] = ['Enter an age between 0 and 120.'];
    }
    if (gender !== 'male' && gender !== 'female') {
      errors['gender'] = ['Select a gender.'];
    }
    if (Object.keys(errors).length > 0) {
      return validationError(errors);
    }

    const slot = computeSlots(doctorId, date).find((entry) => entry.start_time === startTime);
    if (slot === undefined) {
      return validationError({ start_time: ['That time is outside the doctor’s chamber hours.'] });
    }
    if (!slot.is_available) {
      // Someone else booked it between the visitor loading slots and submitting.
      return validationError({ start_time: ['That slot has just been taken. Please pick another.'] });
    }

    const appointment: AppointmentDto = {
      id: nextId('appointments', db.appointments),
      // Guests have no patient record yet; reception registers them at check-in.
      patient: 0,
      patient_name: name,
      patient_mrn: 'GUEST',
      doctor: doctorId,
      doctor_name: doctorRow!.full_name,
      specialty: doctorRow!.specialty,
      date,
      start_time: startTime,
      end_time: slot.end_time,
      status: 'booked',
      token_number: nextTokenNumber(doctorId, date),
      reason: text(payload, 'reason') || 'Online booking',
      checked_in_at: null,
      created_at: isoDateTime(0),
    };
    const reference = bookingReference(date, appointment.id);

    db.appointments = [appointment, ...db.appointments];
    db.guestBookings.push({ reference, appointment: appointment.id, phone, age, gender });

    return created(toConfirmation(appointment, reference, phone));
  }

  if (match(request, 'GET', '/public/appointments/lookup/') !== null) {
    const reference = (request.params.get('reference') ?? '').trim().toUpperCase();
    const phone = normalisePhone(request.params.get('phone') ?? '');
    const booking = db.guestBookings.find(
      (row) => row.reference === reference && row.phone === phone,
    );
    const appointment =
      booking === undefined
        ? undefined
        : db.appointments.find((row) => row.id === booking.appointment);
    // One message for both "wrong reference" and "wrong phone", so the
    // endpoint cannot be used to discover which references exist.
    return appointment === undefined || booking === undefined
      ? notFound('No booking matches that reference and phone number.')
      : ok(toConfirmation(appointment, booking.reference, booking.phone));
  }

  /* ---------------------------------------------------------- contact */

  if (match(request, 'POST', '/public/contact/') !== null) {
    const payload = body(request);
    const errors: Record<string, string[]> = {};
    const name = text(payload, 'name');
    const phone = normalisePhone(text(payload, 'phone'));
    const message = text(payload, 'message');
    if (name === '') {
      errors['name'] = ['This field is required.'];
    }
    if (!BD_PHONE_PATTERN.test(phone)) {
      errors['phone'] = ['Enter a valid Bangladeshi mobile number, e.g. 01712345678.'];
    }
    if (message.length < 10) {
      errors['message'] = ['Please write at least 10 characters.'];
    }
    if (Object.keys(errors).length > 0) {
      return validationError(errors);
    }
    const row = {
      id: nextId('contactMessages', db.contactMessages),
      name,
      phone,
      email: text(payload, 'email'),
      subject: text(payload, 'subject'),
      message,
      created_at: isoDateTime(0),
    };
    db.contactMessages.push(row);
    return created({ id: row.id });
  }

  return notFound(`No public endpoint for ${request.method} ${request.path}`);
};
