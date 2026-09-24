import type { AuthUserDto } from '../auth/auth.model';
import type {
  AdmissionDto,
  BedDto,
  MedicalHistoryEntryDto,
  PatientDto,
  WardDto,
} from '../../shared/models/patient.dto';
import type {
  AppointmentDto,
  DoctorDto,
  DoctorScheduleDto,
} from '../../shared/models/appointment.dto';
import { buildPatientSeed } from './seeds/patients.seed';
import type {
  BatchDto,
  InventoryItemDto,
  StockMovementDto,
  SupplierDto,
} from '../../shared/models/inventory.dto';
import { buildAppointmentSeed } from './seeds/appointments.seed';
import type {
  LabOrderDto,
  LabTestDto,
  ReportDocumentDto,
} from '../../shared/models/lab.dto';
import { buildInventorySeed } from './seeds/inventory.seed';
import type { InvoiceDto } from '../../shared/models/billing.dto';
import { buildLabSeed } from './seeds/lab.seed';
import { buildBillingSeed } from './seeds/billing.seed';

/** Append-only audit trail of report downloads, for compliance reporting. */
export interface ReportDownloadRow {
  readonly id: number;
  readonly report: number;
  readonly patient: number;
  readonly downloaded_at: string;
}

/**
 * In-memory stand-in for the Django database. Rows are stored exactly as the
 * API serialises them (snake_case), so the mappers get the same input they will
 * get from the real backend.
 *
 * Mutable by design — handlers write to it so that create/update flows behave
 * realistically within a session. State resets on reload, which is intended.
 */

export interface MockUserRow extends AuthUserDto {
  /** Plain-text only because this is a fixture; Django stores a hash. */
  readonly password: string;
  readonly is_active: boolean;
}

const DEMO_PASSWORD = 'demo1234';

function user(
  id: number,
  username: string,
  role: string,
  firstName: string,
  lastName: string,
  extras: Partial<MockUserRow> = {},
): MockUserRow {
  return {
    id,
    username,
    email: `${username}@hms.example`,
    first_name: firstName,
    last_name: lastName,
    role,
    staff_id: role === 'patient' ? null : `EMP-${String(id).padStart(4, '0')}`,
    patient_id: null,
    avatar_url: null,
    password: DEMO_PASSWORD,
    is_active: true,
    ...extras,
  };
}

interface MockDatabase {
  users: MockUserRow[];
  patients: PatientDto[];
  wards: WardDto[];
  beds: BedDto[];
  admissions: AdmissionDto[];
  medicalHistory: MedicalHistoryEntryDto[];
  doctors: DoctorDto[];
  doctorSchedules: DoctorScheduleDto[];
  appointments: AppointmentDto[];
  suppliers: SupplierDto[];
  inventoryItems: InventoryItemDto[];
  batches: BatchDto[];
  stockMovements: StockMovementDto[];
  labTests: LabTestDto[];
  labOrders: LabOrderDto[];
  reports: ReportDocumentDto[];
  reportDownloads: ReportDownloadRow[];
  invoices: InvoiceDto[];
  /** Monotonic id sequences per table, so inserts never collide with seeds. */
  sequences: Record<string, number>;
}

const patientSeed = buildPatientSeed();
// Appointments reference real patients, so the seed is derived from theirs.
const appointmentSeed = buildAppointmentSeed(patientSeed.patients);
const inventorySeed = buildInventorySeed();
const labSeed = buildLabSeed(patientSeed.patients);
const billingSeed = buildBillingSeed(patientSeed.patients);

export const db: MockDatabase = {
  users: [
    user(1, 'admin', 'admin', 'Ayesha', 'Rahman'),
    user(2, 'doctor', 'doctor', 'Imran', 'Hossain'),
    user(3, 'nurse', 'nurse', 'Nusrat', 'Jahan'),
    user(4, 'reception', 'receptionist', 'Tanvir', 'Ahmed'),
    user(5, 'lab', 'lab_technician', 'Sabbir', 'Khan'),
    user(6, 'pharmacy', 'pharmacist', 'Farhana', 'Akter'),
    // Linked to patient #1 so the portal has real records to show.
    user(7, 'patient', 'patient', 'Rafiqul', 'Islam', { patient_id: 1, staff_id: null }),
  ],
  patients: patientSeed.patients,
  wards: patientSeed.wards,
  beds: patientSeed.beds,
  admissions: patientSeed.admissions,
  medicalHistory: patientSeed.history,
  doctors: appointmentSeed.doctors,
  doctorSchedules: appointmentSeed.schedules,
  appointments: appointmentSeed.appointments,
  suppliers: inventorySeed.suppliers,
  inventoryItems: inventorySeed.items,
  batches: inventorySeed.batches,
  stockMovements: inventorySeed.movements,
  labTests: labSeed.tests,
  labOrders: labSeed.orders,
  reports: labSeed.reports,
  reportDownloads: [],
  invoices: billingSeed.invoices,
  sequences: {},
};

/** Next id for a table, seeded past the highest existing row. */
export function nextId(table: string, existing: readonly { id: number }[]): number {
  const current = db.sequences[table];
  const next =
    current === undefined
      ? existing.reduce((max, row) => Math.max(max, row.id), 0) + 1
      : current + 1;
  db.sequences[table] = next;
  return next;
}

/** Credentials shown on the login screen so the demo is self-explanatory. */
export const DEMO_ACCOUNTS: readonly { username: string; role: string; password: string }[] =
  db.users.map((row) => ({ username: row.username, role: row.role, password: DEMO_PASSWORD }));
