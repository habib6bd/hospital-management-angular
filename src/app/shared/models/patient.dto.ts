import { isBloodGroup } from '../validators/hms-validators';
import type {
  AdmissionState,
  Bed,
  Gender,
  MedicalHistoryEntry,
  Patient,
  PatientInput,
  PatientType,
  Ward,
} from './patient.model';

/* ------------------------------------------------------------------ DTOs */

export interface PatientDto {
  readonly id: number;
  readonly mrn: string;
  readonly full_name: string;
  readonly gender: string;
  readonly date_of_birth: string;
  readonly blood_group: string | null;
  readonly phone: string;
  readonly email: string | null;
  readonly nid: string | null;
  readonly address: string;
  readonly patient_type: string;
  readonly emergency_contact_name: string | null;
  readonly emergency_contact_phone: string | null;
  readonly allergies: readonly string[];
  readonly registered_at: string;
  readonly current_admission: AdmissionDto | null;
}

export interface AdmissionDto {
  readonly id: number;
  readonly ward: number;
  readonly ward_name: string;
  readonly bed: number;
  readonly bed_number: string;
  readonly admitted_at: string;
  readonly discharged_at: string | null;
  readonly attending_doctor_name: string;
  readonly summary_report: number | null;
}

export interface MedicalHistoryEntryDto {
  readonly id: number;
  readonly patient: number;
  readonly recorded_at: string;
  readonly recorded_by_name: string;
  readonly category: string;
  readonly title: string;
  readonly details: string;
}

export interface WardDto {
  readonly id: number;
  readonly name: string;
  readonly ward_type: string;
  readonly floor: number;
  readonly total_beds: number;
  readonly occupied_beds: number;
}

export interface BedDto {
  readonly id: number;
  readonly ward: number;
  readonly bed_number: string;
  readonly status: string;
  readonly patient: number | null;
  readonly patient_name: string | null;
}

/* -------------------------------------------------------- DTO → domain */

function toGender(value: string): Gender {
  return value === 'male' || value === 'female' ? value : 'other';
}

function toPatientType(value: string): PatientType {
  return value === 'ipd' ? 'ipd' : 'opd';
}

function toWardType(value: string): Ward['type'] {
  switch (value) {
    case 'icu':
    case 'maternity':
    case 'paediatric':
    case 'isolation':
      return value;
    default:
      return 'general';
  }
}

function toBedStatus(value: string): Bed['status'] {
  switch (value) {
    case 'occupied':
    case 'cleaning':
    case 'maintenance':
      return value;
    default:
      return 'available';
  }
}

function toHistoryCategory(value: string): MedicalHistoryEntry['category'] {
  switch (value) {
    case 'diagnosis':
    case 'procedure':
    case 'allergy':
    case 'medication':
      return value;
    default:
      return 'note';
  }
}

/** Whole years between a date of birth and today. */
export function calculateAge(dateOfBirth: string, now = new Date()): number {
  const born = new Date(dateOfBirth);
  if (Number.isNaN(born.getTime())) {
    return 0;
  }
  let age = now.getFullYear() - born.getFullYear();
  const monthDelta = now.getMonth() - born.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < born.getDate())) {
    age -= 1;
  }
  return Math.max(0, age);
}

function toAdmissionState(dto: AdmissionDto | null): AdmissionState {
  if (dto === null) {
    return { status: 'none' };
  }
  if (dto.discharged_at !== null) {
    return {
      status: 'discharged',
      admissionId: dto.id,
      admittedAt: dto.admitted_at,
      dischargedAt: dto.discharged_at,
      summaryReportId: dto.summary_report,
    };
  }
  return {
    status: 'admitted',
    admissionId: dto.id,
    wardId: dto.ward,
    wardName: dto.ward_name,
    bedId: dto.bed,
    bedNumber: dto.bed_number,
    admittedAt: dto.admitted_at,
    attendingDoctor: dto.attending_doctor_name,
  };
}

export function toPatient(dto: PatientDto): Patient {
  return {
    id: dto.id,
    mrn: dto.mrn,
    fullName: dto.full_name,
    gender: toGender(dto.gender),
    dateOfBirth: dto.date_of_birth,
    age: calculateAge(dto.date_of_birth),
    bloodGroup: isBloodGroup(dto.blood_group) ? dto.blood_group : null,
    phone: dto.phone,
    email: dto.email,
    nid: dto.nid,
    address: dto.address,
    type: toPatientType(dto.patient_type),
    admission: toAdmissionState(dto.current_admission),
    emergencyContactName: dto.emergency_contact_name,
    emergencyContactPhone: dto.emergency_contact_phone,
    allergies: dto.allergies,
    registeredAt: dto.registered_at,
  };
}

export function toMedicalHistoryEntry(dto: MedicalHistoryEntryDto): MedicalHistoryEntry {
  return {
    id: dto.id,
    patientId: dto.patient,
    recordedAt: dto.recorded_at,
    recordedBy: dto.recorded_by_name,
    category: toHistoryCategory(dto.category),
    title: dto.title,
    details: dto.details,
  };
}

export function toWard(dto: WardDto): Ward {
  return {
    id: dto.id,
    name: dto.name,
    type: toWardType(dto.ward_type),
    floor: dto.floor,
    totalBeds: dto.total_beds,
    occupiedBeds: dto.occupied_beds,
  };
}

export function toBed(dto: BedDto): Bed {
  return {
    id: dto.id,
    wardId: dto.ward,
    bedNumber: dto.bed_number,
    status: toBedStatus(dto.status),
    patientId: dto.patient,
    patientName: dto.patient_name,
  };
}

/* -------------------------------------------------------- domain → DTO */

/**
 * Write payload. `allergies` is a comma-separated string in the form and a list
 * on the wire, so the split happens here rather than in the component.
 */
export function toPatientWriteDto(input: PatientInput): Record<string, unknown> {
  return {
    full_name: input.fullName.trim(),
    gender: input.gender,
    date_of_birth: input.dateOfBirth,
    blood_group: input.bloodGroup === '' ? null : input.bloodGroup,
    phone: input.phone.trim(),
    email: input.email.trim() === '' ? null : input.email.trim(),
    nid: input.nid.trim() === '' ? null : input.nid.trim(),
    address: input.address.trim(),
    patient_type: input.type,
    emergency_contact_name:
      input.emergencyContactName.trim() === '' ? null : input.emergencyContactName.trim(),
    emergency_contact_phone:
      input.emergencyContactPhone.trim() === '' ? null : input.emergencyContactPhone.trim(),
    allergies: input.allergies
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry !== ''),
  };
}

/** Domain → form model, for editing an existing patient. */
export function toPatientInput(patient: Patient): PatientInput {
  return {
    fullName: patient.fullName,
    gender: patient.gender,
    dateOfBirth: patient.dateOfBirth,
    bloodGroup: patient.bloodGroup ?? '',
    phone: patient.phone,
    email: patient.email ?? '',
    nid: patient.nid ?? '',
    address: patient.address,
    type: patient.type,
    emergencyContactName: patient.emergencyContactName ?? '',
    emergencyContactPhone: patient.emergencyContactPhone ?? '',
    allergies: patient.allergies.join(', '),
  };
}

export function emptyPatientInput(): PatientInput {
  return {
    fullName: '',
    gender: 'male',
    dateOfBirth: '',
    bloodGroup: '',
    phone: '',
    email: '',
    nid: '',
    address: '',
    type: 'opd',
    emergencyContactName: '',
    emergencyContactPhone: '',
    allergies: '',
  };
}
