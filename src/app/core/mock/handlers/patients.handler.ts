import { db, nextId } from '../db';
import {
  created,
  detailError,
  isoDateTime,
  match,
  noContent,
  notFound,
  ok,
  orderBy,
  paginate,
  searchFilter,
  validationError,
} from '../mock-utils';
import { currentUser } from './auth.handler';
import type { MockHandler, MockRequest } from '../mock-types';
import type { AdmissionDto, BedDto, PatientDto } from '../../../shared/models/patient.dto';

const DEFAULT_PAGE_SIZE = 20;

function body(request: MockRequest): Record<string, unknown> {
  return (request.body ?? {}) as Record<string, unknown>;
}

function str(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  return typeof value === 'string' ? value : '';
}

function num(source: Record<string, unknown>, key: string): number | null {
  const value = source[key];
  return typeof value === 'number' ? value : null;
}

function strList(source: Record<string, unknown>, key: string): readonly string[] {
  const value = source[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

/** Mirrors the serializer-level validation Django would apply. */
function validatePatient(payload: Record<string, unknown>): Record<string, string[]> | null {
  const errors: Record<string, string[]> = {};

  if (str(payload, 'full_name').trim() === '') {
    errors['full_name'] = ['This field may not be blank.'];
  }
  if (str(payload, 'date_of_birth') === '') {
    errors['date_of_birth'] = ['This field is required.'];
  } else if (Date.parse(str(payload, 'date_of_birth')) > Date.now()) {
    errors['date_of_birth'] = ['Date of birth cannot be in the future.'];
  }
  if (!/^(?:\+?88)?01[3-9]\d{8}$/.test(str(payload, 'phone'))) {
    errors['phone'] = ['Enter a valid Bangladeshi mobile number.'];
  }

  const nid = str(payload, 'nid');
  if (nid !== '' && !/^(\d{10}|\d{13}|\d{17})$/.test(nid)) {
    errors['nid'] = ['Enter a valid NID (10, 13 or 17 digits).'];
  }
  // Django enforces this with a unique constraint; mirrored so the UI can show it.
  if (nid !== '' && db.patients.some((row) => row.nid === nid)) {
    errors['nid'] = ['A patient with this NID already exists.'];
  }

  return Object.keys(errors).length === 0 ? null : errors;
}

function buildPatient(payload: Record<string, unknown>, id: number): PatientDto {
  return {
    id,
    mrn: `HMS-2026-${String(id).padStart(4, '0')}`,
    full_name: str(payload, 'full_name').trim(),
    gender: str(payload, 'gender') || 'other',
    date_of_birth: str(payload, 'date_of_birth'),
    blood_group: str(payload, 'blood_group') || null,
    phone: str(payload, 'phone'),
    email: str(payload, 'email') || null,
    nid: str(payload, 'nid') || null,
    address: str(payload, 'address'),
    patient_type: str(payload, 'patient_type') || 'opd',
    emergency_contact_name: str(payload, 'emergency_contact_name') || null,
    emergency_contact_phone: str(payload, 'emergency_contact_phone') || null,
    allergies: strList(payload, 'allergies'),
    registered_at: isoDateTime(0),
    current_admission: null,
  };
}

function replaceBed(bedId: number, changes: Partial<BedDto>): void {
  const index = db.beds.findIndex((bed) => bed.id === bedId);
  if (index >= 0) {
    db.beds[index] = { ...db.beds[index]!, ...changes };
  }
}

function adjustWardOccupancy(wardId: number, delta: number): void {
  const index = db.wards.findIndex((ward) => ward.id === wardId);
  if (index >= 0) {
    const ward = db.wards[index]!;
    db.wards[index] = {
      ...ward,
      occupied_beds: Math.max(0, Math.min(ward.total_beds, ward.occupied_beds + delta)),
    };
  }
}

function replacePatient(patientId: number, changes: Partial<PatientDto>): PatientDto | null {
  const index = db.patients.findIndex((row) => row.id === patientId);
  if (index < 0) {
    return null;
  }
  const updated = { ...db.patients[index]!, ...changes };
  db.patients[index] = updated;
  return updated;
}

export const patientsHandler: MockHandler = (request) => {
  if (!request.path.startsWith('/patients/') && !request.path.startsWith('/wards/')) {
    return null;
  }

  // Django would enforce this with a permission class; mirrored so an expired
  // token behaves the same against the mock as against the real API.
  if (currentUser(request) === null) {
    return detailError(401, 'Authentication credentials were not provided.');
  }

  /* ------------------------------------------------------------- wards */

  if (match(request, 'GET', '/wards/') !== null) {
    return ok({ count: db.wards.length, next: null, previous: null, results: db.wards });
  }

  const wardBeds = match(request, 'GET', '/wards/:id/beds/');
  if (wardBeds !== null) {
    const wardId = Number(wardBeds['id']);
    const beds = db.beds.filter((bed) => bed.ward === wardId);
    return ok({ count: beds.length, next: null, previous: null, results: beds });
  }

  /* ---------------------------------------------------------- patients */

  if (match(request, 'GET', '/patients/') !== null) {
    let rows: readonly PatientDto[] = db.patients;

    const type = request.params.get('patient_type');
    if (type !== null && type !== '') {
      rows = rows.filter((row) => row.patient_type === type);
    }

    const ward = request.params.get('ward');
    if (ward !== null && ward !== '') {
      rows = rows.filter((row) => row.current_admission?.ward === Number(ward));
    }

    const gender = request.params.get('gender');
    if (gender !== null && gender !== '') {
      rows = rows.filter((row) => row.gender === gender);
    }

    rows = searchFilter(rows, request.params.get('search'), [
      'full_name',
      'mrn',
      'phone',
      'nid',
    ]);
    rows = orderBy(rows, request.params.get('ordering') ?? '-registered_at');

    return ok(paginate(rows, request, DEFAULT_PAGE_SIZE));
  }

  if (match(request, 'POST', '/patients/') !== null) {
    const payload = body(request);
    const errors = validatePatient(payload);
    if (errors !== null) {
      return validationError(errors);
    }
    const row = buildPatient(payload, nextId('patients', db.patients));
    db.patients = [row, ...db.patients];
    return created(row);
  }

  const detail = match(request, 'GET', '/patients/:id/');
  if (detail !== null) {
    const row = db.patients.find((patient) => patient.id === Number(detail['id']));
    return row === undefined ? notFound('Patient not found.') : ok(row);
  }

  const update = match(request, 'PATCH', '/patients/:id/') ?? match(request, 'PUT', '/patients/:id/');
  if (update !== null) {
    const id = Number(update['id']);
    const existing = db.patients.find((patient) => patient.id === id);
    if (existing === undefined) {
      return notFound('Patient not found.');
    }

    const payload = body(request);
    // Skip the uniqueness check against the record's own NID.
    const errors = validatePatient({ ...payload, nid: payload['nid'] === existing.nid ? '' : payload['nid'] });
    if (errors !== null) {
      return validationError(errors);
    }

    const updated = replacePatient(id, {
      ...buildPatient(payload, id),
      mrn: existing.mrn,
      registered_at: existing.registered_at,
      current_admission: existing.current_admission,
    });
    return updated === null ? notFound('Patient not found.') : ok(updated);
  }

  const history = match(request, 'GET', '/patients/:id/history/');
  if (history !== null) {
    const patientId = Number(history['id']);
    const rows = db.medicalHistory
      .filter((entry) => entry.patient === patientId)
      .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at));
    return ok({ count: rows.length, next: null, previous: null, results: rows });
  }

  const addHistory = match(request, 'POST', '/patients/:id/history/');
  if (addHistory !== null) {
    const patientId = Number(addHistory['id']);
    if (!db.patients.some((patient) => patient.id === patientId)) {
      return notFound('Patient not found.');
    }
    const payload = body(request);
    if (str(payload, 'title').trim() === '') {
      return validationError({ title: ['This field may not be blank.'] });
    }
    const entry = {
      id: nextId('history', db.medicalHistory),
      patient: patientId,
      recorded_at: isoDateTime(0),
      recorded_by_name: currentUser(request)?.first_name ?? 'System',
      category: str(payload, 'category') || 'note',
      title: str(payload, 'title').trim(),
      details: str(payload, 'details'),
    };
    db.medicalHistory = [entry, ...db.medicalHistory];
    return created(entry);
  }

  const admissions = match(request, 'GET', '/patients/:id/admissions/');
  if (admissions !== null) {
    const patientId = Number(admissions['id']);
    const patient = db.patients.find((row) => row.id === patientId);
    const rows = patient?.current_admission === null ? [] : db.admissions.filter(
      (admission) => admission.id === patient?.current_admission?.id,
    );
    return ok({ count: rows.length, next: null, previous: null, results: rows });
  }

  /* -------------------------------------------------- admit / discharge */

  const admit = match(request, 'POST', '/patients/:id/admit/');
  if (admit !== null) {
    const patientId = Number(admit['id']);
    const patient = db.patients.find((row) => row.id === patientId);
    if (patient === undefined) {
      return notFound('Patient not found.');
    }
    if (patient.current_admission !== null && patient.current_admission.discharged_at === null) {
      return detailError(409, 'This patient is already admitted.');
    }

    const payload = body(request);
    const bedId = num(payload, 'bed');
    const bed = db.beds.find((row) => row.id === bedId);
    if (bed === undefined) {
      return validationError({ bed: ['Select a valid bed.'] });
    }
    if (bed.status !== 'available') {
      // Race between two receptionists picking the same bed.
      return validationError({ bed: ['That bed is no longer available.'] });
    }

    const ward = db.wards.find((row) => row.id === bed.ward)!;
    const admission: AdmissionDto = {
      id: nextId('admissions', db.admissions),
      ward: ward.id,
      ward_name: ward.name,
      bed: bed.id,
      bed_number: bed.bed_number,
      admitted_at: isoDateTime(0),
      discharged_at: null,
      attending_doctor_name: str(payload, 'attending_doctor_name') || 'Dr. On Duty',
      summary_report: null,
    };

    db.admissions = [admission, ...db.admissions];
    replaceBed(bed.id, { status: 'occupied', patient: patientId, patient_name: patient.full_name });
    adjustWardOccupancy(ward.id, 1);
    const updated = replacePatient(patientId, {
      patient_type: 'ipd',
      current_admission: admission,
    });

    return created(updated);
  }

  const discharge = match(request, 'POST', '/patients/:id/discharge/');
  if (discharge !== null) {
    const patientId = Number(discharge['id']);
    const patient = db.patients.find((row) => row.id === patientId);
    if (patient === undefined) {
      return notFound('Patient not found.');
    }
    const admission = patient.current_admission;
    if (admission === null || admission.discharged_at !== null) {
      return detailError(409, 'This patient is not currently admitted.');
    }

    const dischargedAt = isoDateTime(0);
    const closed: AdmissionDto = { ...admission, discharged_at: dischargedAt };

    const index = db.admissions.findIndex((row) => row.id === admission.id);
    if (index >= 0) {
      db.admissions[index] = closed;
    }
    // Bed goes to cleaning, not straight back to available — matches real flow.
    replaceBed(admission.bed, { status: 'cleaning', patient: null, patient_name: null });
    adjustWardOccupancy(admission.ward, -1);
    const updated = replacePatient(patientId, {
      patient_type: 'opd',
      current_admission: closed,
    });

    return ok(updated);
  }

  const releaseBed = match(request, 'POST', '/wards/:wardId/beds/:bedId/release/');
  if (releaseBed !== null) {
    const bedId = Number(releaseBed['bedId']);
    const bed = db.beds.find((row) => row.id === bedId);
    if (bed === undefined) {
      return notFound('Bed not found.');
    }
    replaceBed(bedId, { status: 'available', patient: null, patient_name: null });
    return noContent();
  }

  return null;
};
