import type {
  Appointment,
  AppointmentInput,
  AppointmentStatus,
  Doctor,
  DoctorSchedule,
  TimeSlot,
} from './appointment.model';

export interface DoctorDto {
  readonly id: number;
  readonly full_name: string;
  readonly specialty: string;
  readonly department: string;
  /** DRF `DecimalField` serialises as a string; parsed here, never in a component. */
  readonly consultation_fee: string;
  readonly room_number: string;
}

export interface AppointmentDto {
  readonly id: number;
  readonly patient: number;
  readonly patient_name: string;
  readonly patient_mrn: string;
  readonly doctor: number;
  readonly doctor_name: string;
  readonly specialty: string;
  readonly date: string;
  readonly start_time: string;
  readonly end_time: string;
  readonly status: string;
  readonly token_number: number | null;
  readonly reason: string;
  readonly checked_in_at: string | null;
  readonly created_at: string;
}

export interface DoctorScheduleDto {
  readonly id: number;
  readonly doctor: number;
  readonly doctor_name: string;
  readonly weekday: number;
  readonly start_time: string;
  readonly end_time: string;
  readonly slot_minutes: number;
  readonly is_active: boolean;
}

export interface TimeSlotDto {
  readonly start_time: string;
  readonly end_time: string;
  readonly is_available: boolean;
  readonly taken_by: string | null;
}

const KNOWN_STATUSES: readonly AppointmentStatus[] = [
  'booked',
  'checked_in',
  'in_consultation',
  'completed',
  'cancelled',
  'no_show',
];

function toStatus(value: string): AppointmentStatus {
  return KNOWN_STATUSES.includes(value as AppointmentStatus)
    ? (value as AppointmentStatus)
    : 'booked';
}

export function toDoctor(dto: DoctorDto): Doctor {
  return {
    id: dto.id,
    fullName: dto.full_name,
    specialty: dto.specialty,
    department: dto.department,
    consultationFee: Number.parseFloat(dto.consultation_fee),
    roomNumber: dto.room_number,
  };
}

export function toAppointment(dto: AppointmentDto): Appointment {
  return {
    id: dto.id,
    patientId: dto.patient,
    patientName: dto.patient_name,
    patientMrn: dto.patient_mrn,
    doctorId: dto.doctor,
    doctorName: dto.doctor_name,
    specialty: dto.specialty,
    date: dto.date,
    startTime: dto.start_time,
    endTime: dto.end_time,
    status: toStatus(dto.status),
    tokenNumber: dto.token_number,
    reason: dto.reason,
    checkedInAt: dto.checked_in_at,
    createdAt: dto.created_at,
  };
}

export function toDoctorSchedule(dto: DoctorScheduleDto): DoctorSchedule {
  return {
    id: dto.id,
    doctorId: dto.doctor,
    doctorName: dto.doctor_name,
    weekday: dto.weekday,
    startTime: dto.start_time,
    endTime: dto.end_time,
    slotMinutes: dto.slot_minutes,
    isActive: dto.is_active,
  };
}

export function toTimeSlot(dto: TimeSlotDto): TimeSlot {
  return {
    startTime: dto.start_time,
    endTime: dto.end_time,
    isAvailable: dto.is_available,
    takenBy: dto.taken_by,
  };
}

export function toAppointmentWriteDto(input: AppointmentInput): Record<string, unknown> {
  return {
    patient: input.patientId,
    doctor: input.doctorId,
    date: input.date,
    start_time: input.startTime,
    reason: input.reason.trim(),
  };
}
