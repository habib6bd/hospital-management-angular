import {
  flagFor,
  type DownloadTicket,
  type LabOrder,
  type LabOrderInput,
  type LabOrderStatus,
  type LabResult,
  type LabTest,
  type ReportDocument,
  type ReportKind,
  type ReportStatus,
  type ResultEntryInput,
} from './lab.model';

export interface LabTestDto {
  readonly id: number;
  readonly code: string;
  readonly name: string;
  readonly specimen: string;
  readonly unit: string;
  readonly reference_low: string | null;
  readonly reference_high: string | null;
  readonly price: string;
  readonly turnaround_hours: number;
}

export interface LabResultDto {
  readonly id: number;
  readonly test: number;
  readonly test_name: string;
  readonly unit: string;
  readonly value: string;
  readonly reference_low: string | null;
  readonly reference_high: string | null;
  readonly notes: string;
}

export interface LabOrderDto {
  readonly id: number;
  readonly order_number: string;
  readonly patient: number;
  readonly patient_name: string;
  readonly patient_mrn: string;
  readonly ordered_by: number;
  readonly ordered_by_name: string;
  readonly status: string;
  readonly priority: string;
  readonly tests: readonly LabTestDto[];
  readonly results: readonly LabResultDto[];
  readonly ordered_at: string;
  readonly sample_collected_at: string | null;
  readonly sample_id: string | null;
  readonly completed_at: string | null;
  readonly clinical_notes: string;
  readonly report: number | null;
}

export interface ReportDocumentDto {
  readonly id: number;
  readonly patient: number;
  readonly kind: string;
  readonly title: string;
  readonly status: string;
  readonly issued_at: string | null;
  readonly downloaded_at: string | null;
  readonly size_bytes: number | null;
  readonly related_order_number: string | null;
}

export interface DownloadTicketDto {
  readonly url: string;
  readonly expires_at: string;
  readonly filename: string;
}

function parseDecimal(value: string | null): number | null {
  if (value === null || value.trim() === '') {
    return null;
  }
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function toOrderStatus(value: string): LabOrderStatus {
  switch (value) {
    case 'sample_collected':
    case 'in_progress':
    case 'completed':
    case 'cancelled':
      return value;
    default:
      return 'ordered';
  }
}

function toReportStatus(value: string): ReportStatus {
  return value === 'ready' || value === 'downloaded' ? value : 'pending';
}

function toReportKind(value: string): ReportKind {
  switch (value) {
    case 'prescription':
    case 'discharge_summary':
    case 'invoice':
      return value;
    default:
      return 'lab_report';
  }
}

export function toLabTest(dto: LabTestDto): LabTest {
  return {
    id: dto.id,
    code: dto.code,
    name: dto.name,
    specimen: dto.specimen,
    unit: dto.unit,
    referenceLow: parseDecimal(dto.reference_low),
    referenceHigh: parseDecimal(dto.reference_high),
    price: Number.parseFloat(dto.price),
    turnaroundHours: dto.turnaround_hours,
  };
}

/**
 * The out-of-range flag is derived on the client from the value and the
 * reference interval rather than trusted from the wire, so a report always
 * flags consistently even if the backend omits it.
 */
export function toLabResult(dto: LabResultDto): LabResult {
  const low = parseDecimal(dto.reference_low);
  const high = parseDecimal(dto.reference_high);
  return {
    id: dto.id,
    testId: dto.test,
    testName: dto.test_name,
    unit: dto.unit,
    value: dto.value,
    referenceLow: low,
    referenceHigh: high,
    flag: flagFor(dto.value, low, high),
    notes: dto.notes,
  };
}

export function toLabOrder(dto: LabOrderDto): LabOrder {
  return {
    id: dto.id,
    orderNumber: dto.order_number,
    patientId: dto.patient,
    patientName: dto.patient_name,
    patientMrn: dto.patient_mrn,
    orderedById: dto.ordered_by,
    orderedByName: dto.ordered_by_name,
    status: toOrderStatus(dto.status),
    priority: dto.priority === 'urgent' ? 'urgent' : 'routine',
    tests: dto.tests.map(toLabTest),
    results: dto.results.map(toLabResult),
    orderedAt: dto.ordered_at,
    sampleCollectedAt: dto.sample_collected_at,
    sampleId: dto.sample_id,
    completedAt: dto.completed_at,
    clinicalNotes: dto.clinical_notes,
    reportId: dto.report,
  };
}

export function toReportDocument(dto: ReportDocumentDto): ReportDocument {
  return {
    id: dto.id,
    patientId: dto.patient,
    kind: toReportKind(dto.kind),
    title: dto.title,
    status: toReportStatus(dto.status),
    issuedAt: dto.issued_at,
    downloadedAt: dto.downloaded_at,
    sizeBytes: dto.size_bytes,
    relatedOrderNumber: dto.related_order_number,
  };
}

export function toDownloadTicket(dto: DownloadTicketDto): DownloadTicket {
  return { url: dto.url, expiresAt: dto.expires_at, filename: dto.filename };
}

export function toLabOrderWriteDto(input: LabOrderInput): Record<string, unknown> {
  return {
    patient: input.patientId,
    tests: input.testIds,
    priority: input.priority,
    clinical_notes: input.clinicalNotes.trim(),
  };
}

export function toResultsWriteDto(entries: readonly ResultEntryInput[]): Record<string, unknown> {
  return {
    results: entries.map((entry) => ({
      test: entry.testId,
      value: entry.value.trim(),
      notes: entry.notes.trim(),
    })),
  };
}
