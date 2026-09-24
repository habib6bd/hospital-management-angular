import type { BloodGroup } from '../validators/hms-validators';

export type Gender = 'male' | 'female' | 'other';
export type PatientType = 'opd' | 'ipd';

export const GENDER_LABELS: Readonly<Record<Gender, string>> = {
  male: 'Male',
  female: 'Female',
  other: 'Other',
};

export const PATIENT_TYPE_LABELS: Readonly<Record<PatientType, string>> = {
  opd: 'Outpatient',
  ipd: 'Inpatient',
};

/**
 * Admission state as a discriminated union: an admitted patient always has a
 * bed and an admission date, a discharged one always has a discharge date, and
 * neither combination can be constructed by mistake.
 */
export type AdmissionState =
  | { readonly status: 'none' }
  | {
      readonly status: 'admitted';
      readonly admissionId: number;
      readonly wardId: number;
      readonly wardName: string;
      readonly bedId: number;
      readonly bedNumber: string;
      readonly admittedAt: string;
      readonly attendingDoctor: string;
    }
  | {
      readonly status: 'discharged';
      readonly admissionId: number;
      readonly admittedAt: string;
      readonly dischargedAt: string;
      readonly summaryReportId: number | null;
    };

export interface Patient {
  readonly id: number;
  /** Hospital-issued MRN, e.g. `HMS-2026-0042`. */
  readonly mrn: string;
  readonly fullName: string;
  readonly gender: Gender;
  readonly dateOfBirth: string;
  readonly age: number;
  readonly bloodGroup: BloodGroup | null;
  readonly phone: string;
  readonly email: string | null;
  readonly nid: string | null;
  readonly address: string;
  readonly type: PatientType;
  readonly admission: AdmissionState;
  readonly emergencyContactName: string | null;
  readonly emergencyContactPhone: string | null;
  readonly allergies: readonly string[];
  readonly registeredAt: string;
}

export interface MedicalHistoryEntry {
  readonly id: number;
  readonly patientId: number;
  readonly recordedAt: string;
  readonly recordedBy: string;
  readonly category: 'diagnosis' | 'procedure' | 'allergy' | 'medication' | 'note';
  readonly title: string;
  readonly details: string;
}

export interface Ward {
  readonly id: number;
  readonly name: string;
  readonly type: 'general' | 'icu' | 'maternity' | 'paediatric' | 'isolation';
  readonly floor: number;
  readonly totalBeds: number;
  readonly occupiedBeds: number;
}

export interface Bed {
  readonly id: number;
  readonly wardId: number;
  readonly bedNumber: string;
  readonly status: 'available' | 'occupied' | 'cleaning' | 'maintenance';
  readonly patientId: number | null;
  readonly patientName: string | null;
}

/** Payload for registering or editing a patient. */
export interface PatientInput {
  readonly fullName: string;
  readonly gender: Gender;
  readonly dateOfBirth: string;
  readonly bloodGroup: string;
  readonly phone: string;
  readonly email: string;
  readonly nid: string;
  readonly address: string;
  readonly type: PatientType;
  readonly emergencyContactName: string;
  readonly emergencyContactPhone: string;
  readonly allergies: string;
}

export interface AdmissionInput {
  readonly patientId: number;
  readonly wardId: number;
  readonly bedId: number;
  readonly attendingDoctorId: number;
  readonly reason: string;
}

export interface DischargeInput {
  readonly admissionId: number;
  readonly summary: string;
  readonly followUpDate: string;
}
