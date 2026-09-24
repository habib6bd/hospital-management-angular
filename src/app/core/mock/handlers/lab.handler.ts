import { db, nextId } from '../db';
import {
  created,
  detailError,
  isoDateTime,
  match,
  notFound,
  ok,
  orderBy,
  paginate,
  searchFilter,
  validationError,
} from '../mock-utils';
import { currentUser } from './auth.handler';
import type { MockHandler, MockRequest } from '../mock-types';
import type { LabOrderDto, LabResultDto, ReportDocumentDto } from '../../../shared/models/lab.dto';

const DEFAULT_PAGE_SIZE = 20;

function body(request: MockRequest): Record<string, unknown> {
  return (request.body ?? {}) as Record<string, unknown>;
}

function str(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  return typeof value === 'string' ? value : '';
}

function replaceOrder(id: number, changes: Partial<LabOrderDto>): LabOrderDto | null {
  const index = db.labOrders.findIndex((row) => row.id === id);
  if (index < 0) {
    return null;
  }
  const updated = { ...db.labOrders[index]!, ...changes };
  db.labOrders[index] = updated;
  return updated;
}

export const labHandler: MockHandler = (request) => {
  if (
    !request.path.startsWith('/lab-orders/') &&
    !request.path.startsWith('/lab-tests/') &&
    !request.path.startsWith('/reports/') &&
    !request.path.startsWith('/portal/')
  ) {
    return null;
  }

  const user = currentUser(request);
  if (user === null) {
    return detailError(401, 'Authentication credentials were not provided.');
  }

  /* -------------------------------------------------------- lab tests */

  if (match(request, 'GET', '/lab-tests/') !== null) {
    const rows = searchFilter(db.labTests, request.params.get('search'), ['name', 'code']);
    return ok({ count: rows.length, next: null, previous: null, results: rows });
  }

  /* ------------------------------------------------------- lab orders */

  if (match(request, 'GET', '/lab-orders/') !== null) {
    let rows: readonly LabOrderDto[] = db.labOrders;

    const status = request.params.get('status');
    if (status !== null && status !== '') {
      rows = rows.filter((row) => row.status === status);
    }

    const statusIn = request.params.get('status__in');
    if (statusIn !== null && statusIn !== '') {
      const allowed = new Set(statusIn.split(','));
      rows = rows.filter((row) => allowed.has(row.status));
    }

    const priority = request.params.get('priority');
    if (priority !== null && priority !== '') {
      rows = rows.filter((row) => row.priority === priority);
    }

    const patient = request.params.get('patient');
    if (patient !== null && patient !== '') {
      rows = rows.filter((row) => row.patient === Number(patient));
    }

    rows = searchFilter(rows, request.params.get('search'), [
      'order_number',
      'patient_name',
      'patient_mrn',
      'sample_id',
    ]);
    rows = orderBy(rows, request.params.get('ordering') ?? '-ordered_at');

    return ok(paginate(rows, request, DEFAULT_PAGE_SIZE));
  }

  if (match(request, 'POST', '/lab-orders/') !== null) {
    const payload = body(request);
    const patientId = Number(payload['patient']);
    const testIds = Array.isArray(payload['tests'])
      ? payload['tests'].filter((id): id is number => typeof id === 'number')
      : [];

    const errors: Record<string, string[]> = {};
    const patient = db.patients.find((row) => row.id === patientId);
    if (patient === undefined) {
      errors['patient'] = ['Select a valid patient.'];
    }
    if (testIds.length === 0) {
      errors['tests'] = ['Select at least one test.'];
    }
    if (Object.keys(errors).length > 0) {
      return validationError(errors);
    }

    const tests = db.labTests.filter((test) => testIds.includes(test.id));
    const id = nextId('labOrders', db.labOrders);

    const order: LabOrderDto = {
      id,
      order_number: `LAB-${String(id).padStart(5, '0')}`,
      patient: patientId,
      patient_name: patient!.full_name,
      patient_mrn: patient!.mrn,
      ordered_by: user.id,
      ordered_by_name: `${user.first_name} ${user.last_name}`.trim(),
      status: 'ordered',
      priority: str(payload, 'priority') === 'urgent' ? 'urgent' : 'routine',
      tests,
      results: [],
      ordered_at: isoDateTime(0),
      sample_collected_at: null,
      sample_id: null,
      completed_at: null,
      clinical_notes: str(payload, 'clinical_notes'),
      report: null,
    };

    db.labOrders = [order, ...db.labOrders];
    return created(order);
  }

  const detail = match(request, 'GET', '/lab-orders/:id/');
  if (detail !== null) {
    const row = db.labOrders.find((order) => order.id === Number(detail['id']));
    return row === undefined ? notFound('Order not found.') : ok(row);
  }

  const collect = match(request, 'POST', '/lab-orders/:id/collect-sample/');
  if (collect !== null) {
    const id = Number(collect['id']);
    const order = db.labOrders.find((row) => row.id === id);
    if (order === undefined) {
      return notFound('Order not found.');
    }
    if (order.status !== 'ordered') {
      return detailError(409, 'A sample has already been collected for this order.');
    }
    return ok(
      replaceOrder(id, {
        status: 'sample_collected',
        sample_collected_at: isoDateTime(0),
        sample_id: `S-${String(id).padStart(5, '0')}`,
      }),
    );
  }

  const start = match(request, 'POST', '/lab-orders/:id/start/');
  if (start !== null) {
    const id = Number(start['id']);
    const order = db.labOrders.find((row) => row.id === id);
    if (order === undefined) {
      return notFound('Order not found.');
    }
    if (order.status !== 'sample_collected') {
      return detailError(409, 'The sample must be collected before analysis can start.');
    }
    return ok(replaceOrder(id, { status: 'in_progress' }));
  }

  const cancel = match(request, 'POST', '/lab-orders/:id/cancel/');
  if (cancel !== null) {
    const id = Number(cancel['id']);
    const order = db.labOrders.find((row) => row.id === id);
    if (order === undefined) {
      return notFound('Order not found.');
    }
    if (order.status === 'completed') {
      return detailError(409, 'A completed order cannot be cancelled.');
    }
    return ok(replaceOrder(id, { status: 'cancelled' }));
  }

  /**
   * Entering results completes the order and issues the patient-facing report
   * in one step — the report is what makes the result reachable in the portal.
   */
  const enterResults = match(request, 'POST', '/lab-orders/:id/results/');
  if (enterResults !== null) {
    const id = Number(enterResults['id']);
    const order = db.labOrders.find((row) => row.id === id);
    if (order === undefined) {
      return notFound('Order not found.');
    }
    if (order.status === 'cancelled') {
      return detailError(409, 'Results cannot be entered on a cancelled order.');
    }
    if (order.status === 'ordered') {
      return detailError(409, 'The sample has not been collected yet.');
    }

    const payload = body(request);
    const entries = Array.isArray(payload['results']) ? payload['results'] : [];

    const errors: Record<string, string[]> = {};
    const values = new Map<number, { value: string; notes: string }>();

    for (const entry of entries) {
      if (entry === null || typeof entry !== 'object') {
        continue;
      }
      const record = entry as Record<string, unknown>;
      const testId = Number(record['test']);
      const value = str(record, 'value').trim();
      if (value === '') {
        errors[`results.${testId}`] = ['A result value is required.'];
        continue;
      }
      values.set(testId, { value, notes: str(record, 'notes') });
    }

    // Every ordered test must have a value before the order can be completed.
    for (const test of order.tests) {
      if (!values.has(test.id)) {
        errors[`results.${test.id}`] = ['A result value is required.'];
      }
    }
    if (Object.keys(errors).length > 0) {
      return validationError(errors);
    }

    let resultId = db.labOrders.reduce(
      (max, row) => Math.max(max, ...row.results.map((result) => result.id), 0),
      0,
    );

    const results: LabResultDto[] = order.tests.map((test) => {
      const entry = values.get(test.id)!;
      return {
        id: ++resultId,
        test: test.id,
        test_name: test.name,
        unit: test.unit,
        value: entry.value,
        reference_low: test.reference_low,
        reference_high: test.reference_high,
        notes: entry.notes,
      };
    });

    const completedAt = isoDateTime(0);

    const report: ReportDocumentDto = {
      id: nextId('reports', db.reports),
      patient: order.patient,
      kind: 'lab_report',
      title: order.tests.map((test) => test.name).join(', '),
      status: 'ready',
      issued_at: completedAt,
      downloaded_at: null,
      size_bytes: 120_000 + order.tests.length * 20_000,
      related_order_number: order.order_number,
    };
    db.reports = [report, ...db.reports];

    return ok(
      replaceOrder(id, {
        status: 'completed',
        results,
        completed_at: completedAt,
        report: report.id,
      }),
    );
  }

  /* ---------------------------------------------------- patient portal */

  /**
   * Portal endpoints are scoped to the caller's own patient record from the
   * token — the client never supplies a patient id, so it cannot ask for
   * someone else's documents. This mirrors what Django must enforce.
   */
  if (request.path.startsWith('/portal/')) {
    if (user.role !== 'patient' || user.patient_id === null) {
      return detailError(403, 'Only patients can access the portal.');
    }
    const patientId = user.patient_id;

    if (match(request, 'GET', '/portal/reports/') !== null) {
      let rows = db.reports.filter((report) => report.patient === patientId);

      const kind = request.params.get('kind');
      if (kind !== null && kind !== '') {
        rows = rows.filter((row) => row.kind === kind);
      }
      const status = request.params.get('status');
      if (status !== null && status !== '') {
        rows = rows.filter((row) => row.status === status);
      }

      rows = [...searchFilter(rows, request.params.get('search'), ['title', 'related_order_number'])];
      rows = [...orderBy(rows, request.params.get('ordering') ?? '-issued_at')];
      return ok(paginate(rows, request, DEFAULT_PAGE_SIZE));
    }

    const downloadUrl = match(request, 'GET', '/portal/reports/:id/download-url/');
    if (downloadUrl !== null) {
      const id = Number(downloadUrl['id']);
      const report = db.reports.find((row) => row.id === id);
      // A missing report and someone else's report are indistinguishable from
      // outside, so an attacker cannot probe for which ids exist.
      if (report === undefined || report.patient !== patientId) {
        return notFound('Report not found.');
      }
      if (report.status === 'pending') {
        return detailError(409, 'This report is not ready yet.');
      }
      return ok({
        // A real backend signs this; expiry is short on purpose.
        url: `/api/portal/reports/${id}/file/?sig=${Math.random().toString(36).slice(2, 18)}`,
        expires_at: isoDateTime(5),
        filename: `${report.kind}-${id}.pdf`,
      });
    }

    const logDownload = match(request, 'POST', '/portal/reports/:id/downloads/');
    if (logDownload !== null) {
      const id = Number(logDownload['id']);
      const index = db.reports.findIndex((row) => row.id === id && row.patient === patientId);
      if (index < 0) {
        return notFound('Report not found.');
      }
      const updated: ReportDocumentDto = {
        ...db.reports[index]!,
        status: 'downloaded',
        downloaded_at: isoDateTime(0),
      };
      db.reports[index] = updated;

      // The audit trail is append-only; it is never exposed to the patient.
      db.reportDownloads = [
        {
          id: nextId('reportDownloads', db.reportDownloads),
          report: id,
          patient: patientId,
          downloaded_at: updated.downloaded_at!,
        },
        ...db.reportDownloads,
      ];
      return created(updated);
    }

    if (match(request, 'GET', '/portal/appointments/') !== null) {
      const rows = db.appointments
        .filter((row) => row.patient === patientId)
        .sort((a, b) => `${b.date}${b.start_time}`.localeCompare(`${a.date}${a.start_time}`));
      return ok(paginate(rows, request, DEFAULT_PAGE_SIZE));
    }

    if (match(request, 'GET', '/portal/profile/') !== null) {
      const patient = db.patients.find((row) => row.id === patientId);
      return patient === undefined ? notFound('Patient not found.') : ok(patient);
    }

    return null;
  }

  /* ------------------------------------------- staff-side report access */

  if (match(request, 'GET', '/reports/') !== null) {
    const patient = request.params.get('patient');
    const rows =
      patient === null || patient === ''
        ? db.reports
        : db.reports.filter((row) => row.patient === Number(patient));
    return ok(paginate(rows, request, DEFAULT_PAGE_SIZE));
  }

  return null;
};
