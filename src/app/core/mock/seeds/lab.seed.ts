import type {
  LabOrderDto,
  LabResultDto,
  LabTestDto,
  ReportDocumentDto,
} from '../../../shared/models/lab.dto';
import type { PatientDto } from '../../../shared/models/patient.dto';
import { createRng, isoDateTime, pick, randomInt } from '../mock-utils';

export const LAB_TEST_SEED: LabTestDto[] = [
  { id: 1, code: 'CBC-HB', name: 'Haemoglobin', specimen: 'Blood (EDTA)', unit: 'g/dL', reference_low: '13.0', reference_high: '17.0', price: '250.00', turnaround_hours: 4 },
  { id: 2, code: 'CBC-WBC', name: 'White Cell Count', specimen: 'Blood (EDTA)', unit: '10³/µL', reference_low: '4.0', reference_high: '11.0', price: '250.00', turnaround_hours: 4 },
  { id: 3, code: 'CBC-PLT', name: 'Platelet Count', specimen: 'Blood (EDTA)', unit: '10³/µL', reference_low: '150', reference_high: '450', price: '250.00', turnaround_hours: 4 },
  { id: 4, code: 'GLU-F', name: 'Fasting Blood Glucose', specimen: 'Blood (Fluoride)', unit: 'mmol/L', reference_low: '3.9', reference_high: '5.5', price: '200.00', turnaround_hours: 3 },
  { id: 5, code: 'HBA1C', name: 'HbA1c', specimen: 'Blood (EDTA)', unit: '%', reference_low: '4.0', reference_high: '5.7', price: '900.00', turnaround_hours: 24 },
  { id: 6, code: 'LFT-ALT', name: 'ALT (SGPT)', specimen: 'Serum', unit: 'U/L', reference_low: '7', reference_high: '56', price: '350.00', turnaround_hours: 6 },
  { id: 7, code: 'LFT-AST', name: 'AST (SGOT)', specimen: 'Serum', unit: 'U/L', reference_low: '10', reference_high: '40', price: '350.00', turnaround_hours: 6 },
  { id: 8, code: 'KFT-CRE', name: 'Serum Creatinine', specimen: 'Serum', unit: 'mg/dL', reference_low: '0.7', reference_high: '1.3', price: '400.00', turnaround_hours: 6 },
  { id: 9, code: 'LIP-CHO', name: 'Total Cholesterol', specimen: 'Serum', unit: 'mg/dL', reference_low: null, reference_high: '200', price: '500.00', turnaround_hours: 8 },
  { id: 10, code: 'LIP-TG', name: 'Triglycerides', specimen: 'Serum', unit: 'mg/dL', reference_low: null, reference_high: '150', price: '500.00', turnaround_hours: 8 },
  { id: 11, code: 'TSH', name: 'Thyroid Stimulating Hormone', specimen: 'Serum', unit: 'mIU/L', reference_low: '0.4', reference_high: '4.0', price: '800.00', turnaround_hours: 24 },
  { id: 12, code: 'URE-RE', name: 'Urine Routine Examination', specimen: 'Urine', unit: '', reference_low: null, reference_high: null, price: '300.00', turnaround_hours: 3 },
  { id: 13, code: 'CRP', name: 'C-Reactive Protein', specimen: 'Serum', unit: 'mg/L', reference_low: null, reference_high: '5', price: '700.00', turnaround_hours: 6 },
  { id: 14, code: 'VITD', name: 'Vitamin D (25-OH)', specimen: 'Serum', unit: 'ng/mL', reference_low: '30', reference_high: '100', price: '2200.00', turnaround_hours: 48 },
];

/** Tests commonly ordered together, so seeded orders look clinically plausible. */
const PANELS: readonly (readonly number[])[] = [
  [1, 2, 3],
  [4, 5],
  [6, 7],
  [8],
  [9, 10],
  [11],
  [12],
  [1, 4, 8],
  [13],
  [14],
];

const DOCTORS: readonly { id: number; name: string }[] = [
  { id: 1, name: 'Dr. Imran Hossain' },
  { id: 2, name: 'Dr. Shahana Parvin' },
  { id: 3, name: 'Dr. Mahbub Alam' },
  { id: 5, name: 'Dr. Kazi Nurul' },
  { id: 7, name: 'Dr. Rezaul Karim' },
];

const NOTES = [
  'Routine screening.',
  'Follow-up on previous abnormal result.',
  'Patient reports fatigue and weight loss.',
  'Pre-operative workup.',
  'Suspected infection — rule out.',
  '',
];

interface LabSeedResult {
  tests: LabTestDto[];
  orders: LabOrderDto[];
  reports: ReportDocumentDto[];
}

/** Generates a value that is usually inside the reference range. */
function resultValue(test: LabTestDto, rng: () => number): string {
  const low = test.reference_low === null ? null : Number(test.reference_low);
  const high = test.reference_high === null ? null : Number(test.reference_high);

  if (low === null && high === null) {
    return pick(rng, ['Normal', 'Trace protein', 'Few epithelial cells', 'No growth']);
  }

  const lower = low ?? (high ?? 10) * 0.3;
  const upper = high ?? lower * 2;
  const span = upper - lower;

  const roll = rng();
  // ~18% of results land outside the range, so flagging is visible in the demo.
  const raw =
    roll < 0.09
      ? lower - span * (0.1 + rng() * 0.4)
      : roll < 0.18
        ? upper + span * (0.1 + rng() * 0.5)
        : lower + span * rng();

  const value = Math.max(0, raw);
  return value >= 100 ? value.toFixed(0) : value.toFixed(1);
}

export function buildLabSeed(patients: readonly PatientDto[]): LabSeedResult {
  const rng = createRng(90210777);
  const orders: LabOrderDto[] = [];
  const reports: ReportDocumentDto[] = [];

  let orderId = 1;
  let resultId = 1;
  let reportId = 1;

  for (let n = 0; n < 56; n++) {
    const patient = pick(rng, patients);
    const doctor = pick(rng, DOCTORS);
    const testIds = pick(rng, PANELS);
    const tests = testIds
      .map((id) => LAB_TEST_SEED.find((test) => test.id === id))
      .filter((test): test is LabTestDto => test !== undefined);

    // A third of orders are from the last few hours, so every stage of the
    // workflow is represented. Spreading ages evenly over 20 days would leave
    // the "awaiting sample" column permanently empty, since only very recent
    // orders can still be at that stage.
    const orderedMinutesAgo =
      rng() < 0.33 ? randomInt(rng, 5, 6 * 60) : randomInt(rng, 6 * 60, 20 * 24 * 60);
    const status = pickStatus(rng, orderedMinutesAgo);

    const hasSample = status !== 'ordered' && status !== 'cancelled';
    const isComplete = status === 'completed';

    const results: LabResultDto[] =
      isComplete
        ? tests.map((test) => ({
            id: resultId++,
            test: test.id,
            test_name: test.name,
            unit: test.unit,
            value: resultValue(test, rng),
            reference_low: test.reference_low,
            reference_high: test.reference_high,
            notes: '',
          }))
        : [];

    const completedAt = isComplete ? isoDateTime(-randomInt(rng, 10, orderedMinutesAgo)) : null;

    // A completed order always produces a report the patient can retrieve.
    let linkedReportId: number | null = null;
    if (isComplete) {
      linkedReportId = reportId;
      const downloaded = rng() < 0.4;
      reports.push({
        id: reportId++,
        patient: patient.id,
        kind: 'lab_report',
        title: `${tests.map((test) => test.name).join(', ')}`,
        status: downloaded ? 'downloaded' : 'ready',
        issued_at: completedAt,
        downloaded_at: downloaded ? isoDateTime(-randomInt(rng, 1, 5000)) : null,
        size_bytes: randomInt(rng, 90_000, 480_000),
        related_order_number: `LAB-${String(orderId).padStart(5, '0')}`,
      });
    }

    orders.push({
      id: orderId,
      order_number: `LAB-${String(orderId).padStart(5, '0')}`,
      patient: patient.id,
      patient_name: patient.full_name,
      patient_mrn: patient.mrn,
      ordered_by: doctor.id,
      ordered_by_name: doctor.name,
      status,
      priority: rng() < 0.2 ? 'urgent' : 'routine',
      tests,
      results,
      ordered_at: isoDateTime(-orderedMinutesAgo),
      sample_collected_at: hasSample
        ? isoDateTime(-randomInt(rng, 10, orderedMinutesAgo))
        : null,
      sample_id: hasSample ? `S-${String(orderId).padStart(5, '0')}` : null,
      completed_at: completedAt,
      clinical_notes: pick(rng, NOTES),
      report: linkedReportId,
    });

    orderId++;
  }

  // Non-lab documents, so the portal shows more than one kind of report.
  for (const patient of patients.slice(0, 14)) {
    if (rng() < 0.55) {
      reports.push({
        id: reportId++,
        patient: patient.id,
        kind: 'prescription',
        title: 'Consultation prescription',
        status: rng() < 0.3 ? 'downloaded' : 'ready',
        issued_at: isoDateTime(-randomInt(rng, 60, 40 * 24 * 60)),
        downloaded_at: null,
        size_bytes: randomInt(rng, 40_000, 120_000),
        related_order_number: null,
      });
    }
    if (patient.current_admission !== null && patient.current_admission.discharged_at !== null) {
      reports.push({
        id: reportId++,
        patient: patient.id,
        kind: 'discharge_summary',
        title: 'Discharge summary',
        status: 'ready',
        issued_at: patient.current_admission.discharged_at,
        downloaded_at: null,
        size_bytes: randomInt(rng, 150_000, 400_000),
        related_order_number: null,
      });
    }
  }

  return { tests: LAB_TEST_SEED, orders, reports };
}

/** Older orders are more likely to be finished; recent ones are still moving. */
function pickStatus(rng: () => number, minutesAgo: number): string {
  if (rng() < 0.04) {
    return 'cancelled';
  }
  const hoursAgo = minutesAgo / 60;
  if (hoursAgo > 48) {
    return 'completed';
  }
  if (hoursAgo > 12) {
    return rng() < 0.7 ? 'completed' : 'in_progress';
  }
  if (hoursAgo > 4) {
    return rng() < 0.5 ? 'in_progress' : 'sample_collected';
  }
  return rng() < 0.5 ? 'sample_collected' : 'ordered';
}
