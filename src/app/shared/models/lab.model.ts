export type LabOrderStatus =
  | 'ordered'
  | 'sample_collected'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export const LAB_ORDER_STATUS_LABELS: Readonly<Record<LabOrderStatus, string>> = {
  ordered: 'Ordered',
  sample_collected: 'Sample collected',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export function labOrderTone(
  status: LabOrderStatus,
): 'ready' | 'pending' | 'critical' | 'info' | 'neutral' {
  switch (status) {
    case 'completed':
      return 'ready';
    case 'in_progress':
    case 'sample_collected':
      return 'pending';
    case 'ordered':
      return 'info';
    default:
      return 'neutral';
  }
}

/**
 * Report delivery status, as seen by the patient. `downloaded` is recorded for
 * compliance — it proves the patient actually retrieved the report.
 */
export type ReportStatus = 'pending' | 'ready' | 'downloaded';

export const REPORT_STATUS_LABELS: Readonly<Record<ReportStatus, string>> = {
  pending: 'Pending',
  ready: 'Ready',
  downloaded: 'Downloaded',
};

export function reportTone(status: ReportStatus): 'ready' | 'pending' | 'neutral' {
  switch (status) {
    case 'ready':
      return 'ready';
    case 'downloaded':
      return 'neutral';
    default:
      return 'pending';
  }
}

export type ReportKind = 'lab_report' | 'prescription' | 'discharge_summary' | 'invoice';

export const REPORT_KIND_LABELS: Readonly<Record<ReportKind, string>> = {
  lab_report: 'Lab report',
  prescription: 'Prescription',
  discharge_summary: 'Discharge summary',
  invoice: 'Invoice',
};

/** A test the lab offers, with its reference range. */
export interface LabTest {
  readonly id: number;
  readonly code: string;
  readonly name: string;
  readonly specimen: string;
  readonly unit: string;
  readonly referenceLow: number | null;
  readonly referenceHigh: number | null;
  readonly price: number;
  readonly turnaroundHours: number;
}

export interface LabResult {
  readonly id: number;
  readonly testId: number;
  readonly testName: string;
  readonly unit: string;
  readonly value: string;
  readonly referenceLow: number | null;
  readonly referenceHigh: number | null;
  readonly flag: ResultFlag;
  readonly notes: string;
}

/** Out-of-range flagging, computed from the reference interval. */
export type ResultFlag = 'normal' | 'low' | 'high' | 'non_numeric';

export function flagFor(
  value: string,
  low: number | null,
  high: number | null,
): ResultFlag {
  const parsed = Number(value);
  if (value.trim() === '' || Number.isNaN(parsed)) {
    return 'non_numeric';
  }
  if (low !== null && parsed < low) {
    return 'low';
  }
  if (high !== null && parsed > high) {
    return 'high';
  }
  return 'normal';
}

export function flagTone(flag: ResultFlag): 'ready' | 'pending' | 'critical' | 'neutral' {
  switch (flag) {
    case 'low':
    case 'high':
      return 'critical';
    case 'normal':
      return 'ready';
    default:
      return 'neutral';
  }
}

export const RESULT_FLAG_LABELS: Readonly<Record<ResultFlag, string>> = {
  normal: 'Normal',
  low: 'Low',
  high: 'High',
  non_numeric: '—',
};

export interface LabOrder {
  readonly id: number;
  readonly orderNumber: string;
  readonly patientId: number;
  readonly patientName: string;
  readonly patientMrn: string;
  readonly orderedById: number;
  readonly orderedByName: string;
  readonly status: LabOrderStatus;
  readonly priority: 'routine' | 'urgent';
  readonly tests: readonly LabTest[];
  readonly results: readonly LabResult[];
  readonly orderedAt: string;
  readonly sampleCollectedAt: string | null;
  readonly sampleId: string | null;
  readonly completedAt: string | null;
  readonly clinicalNotes: string;
  readonly reportId: number | null;
}

/** A downloadable document belonging to a patient. */
export interface ReportDocument {
  readonly id: number;
  readonly patientId: number;
  readonly kind: ReportKind;
  readonly title: string;
  readonly status: ReportStatus;
  readonly issuedAt: string | null;
  readonly downloadedAt: string | null;
  readonly sizeBytes: number | null;
  readonly relatedOrderNumber: string | null;
}

/** A short-lived, signed URL minted by the backend at click time. */
export interface DownloadTicket {
  readonly url: string;
  readonly expiresAt: string;
  readonly filename: string;
}

export interface LabOrderInput {
  readonly patientId: number;
  readonly testIds: readonly number[];
  readonly priority: 'routine' | 'urgent';
  readonly clinicalNotes: string;
}

export interface ResultEntryInput {
  readonly testId: number;
  readonly value: string;
  readonly notes: string;
}

export function formatBytes(bytes: number | null): string {
  if (bytes === null) {
    return '—';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
