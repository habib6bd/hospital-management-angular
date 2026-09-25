import type {
  AppointmentDto,
  DoctorDto,
  DoctorScheduleDto,
} from '../../../shared/models/appointment.dto';
import type { PatientDto } from '../../../shared/models/patient.dto';
import { createRng, isoDate, isoDateTime, pick, randomInt } from '../mock-utils';

export const DOCTOR_SEED: DoctorDto[] = [
  { id: 1, full_name: 'Dr. Imran Hossain', specialty: 'Cardiology', department: 'Medicine', consultation_fee: '1200.00', room_number: 'C-201' },
  { id: 2, full_name: 'Dr. Shahana Parvin', specialty: 'Obstetrics', department: 'Maternity', consultation_fee: '1000.00', room_number: 'M-104' },
  { id: 3, full_name: 'Dr. Mahbub Alam', specialty: 'Orthopaedics', department: 'Surgery', consultation_fee: '1500.00', room_number: 'S-310' },
  { id: 4, full_name: 'Dr. Tahmina Rashid', specialty: 'Paediatrics', department: 'Paediatrics', consultation_fee: '900.00', room_number: 'P-112' },
  { id: 5, full_name: 'Dr. Kazi Nurul', specialty: 'General Medicine', department: 'Medicine', consultation_fee: '800.00', room_number: 'C-105' },
  { id: 6, full_name: 'Dr. Sadia Islam', specialty: 'Dermatology', department: 'Medicine', consultation_fee: '1100.00', room_number: 'C-208' },
  { id: 7, full_name: 'Dr. Rezaul Karim', specialty: 'Neurology', department: 'Medicine', consultation_fee: '1800.00', room_number: 'C-312' },
  { id: 8, full_name: 'Dr. Farzana Haque', specialty: 'ENT', department: 'Surgery', consultation_fee: '1000.00', room_number: 'S-205' },
  { id: 9, full_name: 'Dr. Nasrin Sultana', specialty: 'Obstetrics', department: 'Maternity', consultation_fee: '1200.00', room_number: 'M-108' },
  { id: 10, full_name: 'Dr. Ashraful Haque', specialty: 'Cardiology', department: 'Medicine', consultation_fee: '1500.00', room_number: 'C-204' },
  { id: 11, full_name: 'Dr. Mizanur Rahman', specialty: 'Paediatrics', department: 'Paediatrics', consultation_fee: '1000.00', room_number: 'P-115' },
  { id: 12, full_name: 'Dr. Rumana Afroz', specialty: 'General Medicine', department: 'Medicine', consultation_fee: '700.00', room_number: 'C-110' },
  { id: 13, full_name: 'Dr. Shafiqul Islam', specialty: 'Orthopaedics', department: 'Surgery', consultation_fee: '1200.00', room_number: 'S-312' },
  { id: 14, full_name: 'Dr. Laila Arjumand', specialty: 'Dermatology', department: 'Medicine', consultation_fee: '1000.00', room_number: 'C-210' },
  { id: 15, full_name: 'Dr. Jahangir Kabir', specialty: 'Neurology', department: 'Medicine', consultation_fee: '1600.00', room_number: 'C-315' },
  { id: 16, full_name: 'Dr. Mehnaz Chowdhury', specialty: 'ENT', department: 'Surgery', consultation_fee: '900.00', room_number: 'S-207' },
];

const REASONS = [
  'Follow-up consultation',
  'Chest pain evaluation',
  'Routine check-up',
  'Persistent fever',
  'Post-operative review',
  'Blood pressure review',
  'Skin rash',
  'Antenatal visit',
  'Joint pain',
  'Headache and dizziness',
];

/**
 * Schedules run Sunday–Thursday (the Bangladeshi working week), with each
 * doctor sitting either a morning or an afternoon clinic.
 */
function buildSchedules(): DoctorScheduleDto[] {
  const schedules: DoctorScheduleDto[] = [];
  let id = 1;

  for (const doctor of DOCTOR_SEED) {
    const morning = doctor.id % 2 === 1;
    for (const weekday of [0, 1, 2, 3, 4]) {
      // Each doctor takes one day off mid-week.
      if (weekday === (doctor.id % 5)) {
        continue;
      }
      schedules.push({
        id: id++,
        doctor: doctor.id,
        doctor_name: doctor.full_name,
        weekday,
        start_time: morning ? '09:00' : '15:00',
        end_time: morning ? '13:00' : '19:00',
        slot_minutes: 20,
        is_active: true,
      });
    }
  }
  return schedules;
}

export function addMinutes(time: string, minutes: number): string {
  const [hours = '0', mins = '0'] = time.split(':');
  const total = Number(hours) * 60 + Number(mins) + minutes;
  const wrapped = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`;
}

interface AppointmentSeedResult {
  doctors: DoctorDto[];
  schedules: DoctorScheduleDto[];
  appointments: AppointmentDto[];
}

export function buildAppointmentSeed(patients: readonly PatientDto[]): AppointmentSeedResult {
  const rng = createRng(77120263);
  const schedules = buildSchedules();
  const appointments: AppointmentDto[] = [];
  let id = 1;

  // Seven days back and seven forward, so history, today and upcoming all exist.
  for (let dayOffset = -7; dayOffset <= 7; dayOffset++) {
    const date = isoDate(dayOffset);
    const weekday = new Date(date).getDay();
    const daySchedules = schedules.filter((schedule) => schedule.weekday === weekday);

    // Token numbers restart each day, per doctor, as they do in a real OPD.
    const tokenByDoctor = new Map<number, number>();

    for (const schedule of daySchedules) {
      const slotCount = Math.floor(
        (toMinutes(schedule.end_time) - toMinutes(schedule.start_time)) / schedule.slot_minutes,
      );
      // Clinics run at roughly half to three-quarters capacity.
      const booked = randomInt(rng, Math.floor(slotCount * 0.35), Math.floor(slotCount * 0.7));
      const takenSlots = new Set<number>();

      for (let n = 0; n < booked; n++) {
        const slotIndex = randomInt(rng, 0, slotCount - 1);
        if (takenSlots.has(slotIndex)) {
          continue;
        }
        takenSlots.add(slotIndex);

        const patient = pick(rng, patients);
        const startTime = addMinutes(schedule.start_time, slotIndex * schedule.slot_minutes);
        const token = (tokenByDoctor.get(schedule.doctor) ?? 0) + 1;
        tokenByDoctor.set(schedule.doctor, token);

        appointments.push({
          id: id++,
          patient: patient.id,
          patient_name: patient.full_name,
          patient_mrn: patient.mrn,
          doctor: schedule.doctor,
          doctor_name: schedule.doctor_name,
          specialty:
            DOCTOR_SEED.find((doctor) => doctor.id === schedule.doctor)?.specialty ?? 'General',
          date,
          start_time: startTime,
          end_time: addMinutes(startTime, schedule.slot_minutes),
          status: statusFor(dayOffset, rng),
          token_number: token,
          reason: pick(rng, REASONS),
          checked_in_at: null,
          created_at: isoDateTime(-randomInt(rng, 1, 30) * 24 * 60),
        });
      }
    }
  }

  return { doctors: DOCTOR_SEED, schedules, appointments };
}

/** Past days are resolved; today is mid-flight; future days are just booked. */
function statusFor(dayOffset: number, rng: () => number): string {
  if (dayOffset < 0) {
    const roll = rng();
    if (roll < 0.82) {
      return 'completed';
    }
    return roll < 0.92 ? 'no_show' : 'cancelled';
  }
  if (dayOffset === 0) {
    const roll = rng();
    if (roll < 0.3) {
      return 'completed';
    }
    if (roll < 0.4) {
      return 'in_consultation';
    }
    return roll < 0.7 ? 'checked_in' : 'booked';
  }
  return rng() < 0.95 ? 'booked' : 'cancelled';
}

export function toMinutes(time: string): number {
  const [hours = '0', mins = '0'] = time.split(':');
  return Number(hours) * 60 + Number(mins);
}
