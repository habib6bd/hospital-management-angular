import type {
  AdmissionDto,
  BedDto,
  MedicalHistoryEntryDto,
  PatientDto,
  WardDto,
} from '../../../shared/models/patient.dto';
import { createRng, isoDate, isoDateTime, pick, randomInt } from '../mock-utils';

/**
 * Seed data is generated from a fixed RNG seed so the dataset is identical on
 * every reload — screenshots, tests and manual QA all see the same records.
 */

// Names are split by gender and paired with gender-appropriate surnames, so the
// demo data does not read as obviously synthetic (e.g. a male "Momena Begum").
const MALE_FIRST_NAMES = [
  'Rafiqul',
  'Shamim',
  'Jahangir',
  'Kamrul',
  'Mizanur',
  'Abdul',
  'Saiful',
  'Delwar',
  'Anwar',
  'Jamal',
  'Harun',
  'Bashir',
  'Mostafa',
  'Nurul',
];

const FEMALE_FIRST_NAMES = [
  'Nasrin',
  'Taslima',
  'Ruma',
  'Shirin',
  'Farhana',
  'Rehana',
  'Momena',
  'Shahnaz',
  'Rokeya',
  'Sultana',
  'Nargis',
  'Salma',
  'Ayesha',
  'Rabeya',
];

/** Surnames usable by anyone. */
const NEUTRAL_LAST_NAMES = [
  'Islam',
  'Ahmed',
  'Hossain',
  'Rahman',
  'Chowdhury',
  'Khan',
  'Sarkar',
  'Mia',
  'Uddin',
  'Haque',
  'Molla',
  'Talukder',
];

/** Conventionally feminine surnames in Bangladesh. */
const FEMALE_LAST_NAMES = ['Begum', 'Akter', 'Khatun'];

const AREAS = [
  'Dhanmondi, Dhaka',
  'Mirpur, Dhaka',
  'Uttara, Dhaka',
  'Gulshan, Dhaka',
  'Agrabad, Chattogram',
  'Zindabazar, Sylhet',
  'Kotwali, Khulna',
  'Boalia, Rajshahi',
];

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const ALLERGY_POOL = ['Penicillin', 'Sulfa drugs', 'Peanuts', 'Latex', 'Aspirin', 'Iodine'];

const DOCTORS = [
  'Dr. Imran Hossain',
  'Dr. Shahana Parvin',
  'Dr. Mahbub Alam',
  'Dr. Tahmina Rashid',
  'Dr. Kazi Nurul',
  'Dr. Sadia Islam',
];

export const WARD_SEED: WardDto[] = [
  {
    id: 1,
    name: 'General Ward A',
    ward_type: 'general',
    floor: 2,
    total_beds: 20,
    occupied_beds: 0,
  },
  {
    id: 2,
    name: 'General Ward B',
    ward_type: 'general',
    floor: 2,
    total_beds: 20,
    occupied_beds: 0,
  },
  { id: 3, name: 'Intensive Care', ward_type: 'icu', floor: 4, total_beds: 8, occupied_beds: 0 },
  { id: 4, name: 'Maternity', ward_type: 'maternity', floor: 3, total_beds: 12, occupied_beds: 0 },
  {
    id: 5,
    name: 'Paediatrics',
    ward_type: 'paediatric',
    floor: 3,
    total_beds: 14,
    occupied_beds: 0,
  },
  { id: 6, name: 'Isolation', ward_type: 'isolation', floor: 5, total_beds: 6, occupied_beds: 0 },
];

function buildBeds(): BedDto[] {
  const beds: BedDto[] = [];
  let id = 1;
  for (const ward of WARD_SEED) {
    const prefix = ward.name
      .split(' ')
      .map((word) => word.charAt(0))
      .join('')
      .toUpperCase();
    for (let index = 1; index <= ward.total_beds; index++) {
      beds.push({
        id: id++,
        ward: ward.id,
        bed_number: `${prefix}-${String(index).padStart(2, '0')}`,
        status: 'available',
        patient: null,
        patient_name: null,
      });
    }
  }
  return beds;
}

interface PatientSeedResult {
  patients: PatientDto[];
  beds: BedDto[];
  wards: WardDto[];
  admissions: AdmissionDto[];
  history: MedicalHistoryEntryDto[];
}

export function buildPatientSeed(count = 42): PatientSeedResult {
  const rng = createRng(20260322);
  const beds = buildBeds();
  const wards = WARD_SEED.map((ward) => ({ ...ward }));
  const patients: PatientDto[] = [];
  const admissions: AdmissionDto[] = [];
  const history: MedicalHistoryEntryDto[] = [];

  let admissionId = 1;
  let historyId = 1;

  for (let id = 1; id <= count; id++) {
    const gender = rng() > 0.52 ? 'female' : rng() > 0.02 ? 'male' : 'other';
    const firstName = pick(rng, gender === 'female' ? FEMALE_FIRST_NAMES : MALE_FIRST_NAMES);
    const lastName =
      gender === 'female' && rng() < 0.5
        ? pick(rng, FEMALE_LAST_NAMES)
        : pick(rng, NEUTRAL_LAST_NAMES);
    const ageYears = randomInt(rng, 1, 84);
    const dateOfBirth = isoDate(-(ageYears * 365 + randomInt(rng, 0, 364)));

    // Enough inpatients that the bed board and occupancy widgets have something
    // meaningful to show; of those, most are still admitted.
    const isInpatient = rng() < 0.45;
    let currentAdmission: AdmissionDto | null = null;

    if (isInpatient) {
      const stillAdmitted = rng() < 0.72;
      const admittedAt = isoDateTime(-randomInt(rng, 60, 20 * 24 * 60));

      if (stillAdmitted) {
        // Pick a free bed in a randomly chosen ward that still has capacity, so
        // occupancy spreads across the hospital instead of filling ward 1 first.
        const wardsWithSpace = wards.filter((candidate) =>
          beds.some((bed) => bed.ward === candidate.id && bed.status === 'available'),
        );
        const preferredWard = wardsWithSpace.length === 0 ? undefined : pick(rng, wardsWithSpace);
        const freeBed =
          preferredWard === undefined
            ? undefined
            : beds.find((bed) => bed.status === 'available' && bed.ward === preferredWard.id);
        if (freeBed !== undefined) {
          const ward = wards.find((candidate) => candidate.id === freeBed.ward)!;
          const patientName = `${firstName} ${lastName}`;

          const index = beds.indexOf(freeBed);
          beds[index] = {
            ...freeBed,
            status: 'occupied',
            patient: id,
            patient_name: patientName,
          };
          ward.occupied_beds += 1;

          currentAdmission = {
            id: admissionId++,
            ward: ward.id,
            ward_name: ward.name,
            bed: freeBed.id,
            bed_number: freeBed.bed_number,
            admitted_at: admittedAt,
            discharged_at: null,
            attending_doctor_name: pick(rng, DOCTORS),
            summary_report: null,
          };
        }
      } else {
        currentAdmission = {
          id: admissionId++,
          ward: 1,
          ward_name: 'General Ward A',
          bed: 1,
          bed_number: 'GWA-01',
          admitted_at: admittedAt,
          discharged_at: isoDateTime(-randomInt(rng, 10, 50) * 60),
          attending_doctor_name: pick(rng, DOCTORS),
          summary_report: null,
        };
      }
      if (currentAdmission !== null) {
        admissions.push(currentAdmission);
      }
    }

    const allergyCount = rng() < 0.25 ? randomInt(rng, 1, 2) : 0;
    const allergies = Array.from({ length: allergyCount }, () => pick(rng, ALLERGY_POOL));

    patients.push({
      id,
      mrn: `HMS-2026-${String(id).padStart(4, '0')}`,
      full_name: `${firstName} ${lastName}`,
      gender,
      date_of_birth: dateOfBirth,
      blood_group: pick(rng, BLOOD_GROUPS),
      phone: `01${randomInt(rng, 3, 9)}${String(randomInt(rng, 10000000, 99999999))}`,
      email: rng() < 0.6 ? `${firstName.toLowerCase()}${id}@example.com` : null,
      nid: rng() < 0.75 ? String(randomInt(rng, 1000000000, 1999999999)) : null,
      address: pick(rng, AREAS),
      patient_type:
        currentAdmission !== null && currentAdmission.discharged_at === null ? 'ipd' : 'opd',
      emergency_contact_name: `${pick(rng, MALE_FIRST_NAMES)} ${pick(rng, NEUTRAL_LAST_NAMES)}`,
      emergency_contact_phone: `01${randomInt(rng, 3, 9)}${String(randomInt(rng, 10000000, 99999999))}`,
      allergies: [...new Set(allergies)],
      registered_at: isoDateTime(-randomInt(rng, 1, 700) * 24 * 60),
      current_admission: currentAdmission,
    });

    // A few history entries per patient, so the detail view is never empty.
    const entryCount = randomInt(rng, 1, 4);
    for (let n = 0; n < entryCount; n++) {
      const category = pick(rng, ['diagnosis', 'procedure', 'medication', 'note', 'allergy']);
      history.push({
        id: historyId++,
        patient: id,
        recorded_at: isoDateTime(-randomInt(rng, 1, 400) * 24 * 60),
        recorded_by_name: pick(rng, DOCTORS),
        category,
        title: HISTORY_TITLES[category]![randomInt(rng, 0, HISTORY_TITLES[category]!.length - 1)]!,
        details: 'Recorded during a routine consultation. Follow-up advised as needed.',
      });
    }
  }

  return { patients, beds, wards, admissions, history };
}

const HISTORY_TITLES: Readonly<Record<string, readonly string[]>> = {
  diagnosis: [
    'Type 2 diabetes mellitus',
    'Hypertension, stage 1',
    'Iron-deficiency anaemia',
    'Acute bronchitis',
  ],
  procedure: ['Appendectomy', 'Wound debridement', 'Cataract extraction', 'Endoscopy'],
  medication: [
    'Metformin 500mg BD',
    'Amlodipine 5mg OD',
    'Salbutamol inhaler PRN',
    'Omeprazole 20mg OD',
  ],
  note: [
    'Advised low-sodium diet',
    'Smoking cessation counselling',
    'Physiotherapy referral',
    'Routine review',
  ],
  allergy: [
    'Penicillin — rash',
    'Sulfa drugs — urticaria',
    'Latex — contact dermatitis',
    'Aspirin — bronchospasm',
  ],
};

export const DOCTOR_NAMES = DOCTORS;
