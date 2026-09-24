import { db, nextId } from '../db';
import {
  created,
  detailError,
  isoDate,
  isoDateTime,
  match,
  notFound,
  ok,
  orderBy,
  paginate,
  searchFilter,
  validationError,
} from '../mock-utils';
import { DEFAULT_TAX_RATE } from '../seeds/billing.seed';
import { currentUser } from './auth.handler';
import type { MockHandler, MockRequest } from '../mock-types';
import type { InvoiceDto, InvoiceLineItemDto, PaymentDto } from '../../../shared/models/billing.dto';

const DEFAULT_PAGE_SIZE = 20;

function body(request: MockRequest): Record<string, unknown> {
  return (request.body ?? {}) as Record<string, unknown>;
}

function str(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  return typeof value === 'string' ? value : '';
}

function num(source: Record<string, unknown>, key: string): number | null {
  const value = source[key];
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** Integer paisa, matching the client's `computeTotals`. */
function invoiceTotalPaisa(invoice: InvoiceDto): number {
  const gross = invoice.items.reduce(
    (sum, item) => sum + Math.round(Number(item.unit_price) * 100) * item.quantity,
    0,
  );
  const discount = invoice.items.reduce(
    (sum, item) => sum + Math.round(Number(item.discount) * 100),
    0,
  );
  const subtotal = gross - Math.min(discount, gross);
  return subtotal + Math.round(subtotal * Number(invoice.tax_rate));
}

function paidPaisa(invoice: InvoiceDto): number {
  return invoice.payments.reduce((sum, payment) => sum + Math.round(Number(payment.amount) * 100), 0);
}

function statusFor(invoice: InvoiceDto): string {
  if (invoice.status === 'cancelled' || invoice.status === 'refunded' || invoice.status === 'draft') {
    return invoice.status;
  }
  const paid = paidPaisa(invoice);
  if (paid <= 0) {
    return 'unpaid';
  }
  return paid >= invoiceTotalPaisa(invoice) ? 'paid' : 'partial';
}

function replaceInvoice(id: number, changes: Partial<InvoiceDto>): InvoiceDto | null {
  const index = db.invoices.findIndex((row) => row.id === id);
  if (index < 0) {
    return null;
  }
  const merged = { ...db.invoices[index]!, ...changes };
  const updated = { ...merged, status: statusFor(merged) };
  db.invoices[index] = updated;
  return updated;
}

export const billingHandler: MockHandler = (request) => {
  if (!request.path.startsWith('/invoices/')) {
    return null;
  }

  const user = currentUser(request);
  if (user === null) {
    return detailError(401, 'Authentication credentials were not provided.');
  }

  /* ---------------------------------------------------------- invoices */

  if (match(request, 'GET', '/invoices/') !== null) {
    let rows: readonly InvoiceDto[] = db.invoices;

    // A patient may only ever see their own invoices, regardless of params.
    if (user.role === 'patient') {
      rows = rows.filter((row) => row.patient === user.patient_id);
    } else {
      const patient = request.params.get('patient');
      if (patient !== null && patient !== '') {
        rows = rows.filter((row) => row.patient === Number(patient));
      }
    }

    const status = request.params.get('status');
    if (status !== null && status !== '') {
      rows = rows.filter((row) => statusFor(row) === status);
    }

    // `overdue=true` — past due date with money still outstanding.
    if (request.params.get('overdue') === 'true') {
      const today = isoDate(0);
      rows = rows.filter(
        (row) =>
          row.due_date < today &&
          paidPaisa(row) < invoiceTotalPaisa(row) &&
          !['cancelled', 'refunded', 'draft'].includes(row.status),
      );
    }

    rows = searchFilter(rows, request.params.get('search'), [
      'invoice_number',
      'patient_name',
      'patient_mrn',
    ]);
    rows = orderBy(rows, request.params.get('ordering') ?? '-issued_at');

    return ok(paginate(rows, request, DEFAULT_PAGE_SIZE));
  }

  /** Aggregate figures for the dashboard's revenue widget. */
  if (match(request, 'GET', '/invoices/summary/') !== null) {
    const today = isoDate(0);
    let billed = 0;
    let collected = 0;
    let outstanding = 0;
    let overdueCount = 0;
    const byDepartment = new Map<string, number>();

    for (const invoice of db.invoices) {
      if (invoice.status === 'cancelled' || invoice.status === 'draft') {
        continue;
      }
      const total = invoiceTotalPaisa(invoice);
      const paid = paidPaisa(invoice);
      billed += total;
      collected += paid;
      outstanding += Math.max(0, total - paid);
      if (invoice.due_date < today && paid < total) {
        overdueCount += 1;
      }
      for (const item of invoice.items) {
        const line = Math.round(Number(item.unit_price) * 100) * item.quantity -
          Math.round(Number(item.discount) * 100);
        byDepartment.set(item.source, (byDepartment.get(item.source) ?? 0) + line);
      }
    }

    return ok({
      total_billed: (billed / 100).toFixed(2),
      total_collected: (collected / 100).toFixed(2),
      total_outstanding: (outstanding / 100).toFixed(2),
      overdue_count: overdueCount,
      by_source: [...byDepartment.entries()].map(([source, paisa]) => ({
        source,
        amount: (paisa / 100).toFixed(2),
      })),
    });
  }

  if (match(request, 'POST', '/invoices/') !== null) {
    const payload = body(request);
    const patientId = Number(payload['patient']);
    const rawItems = Array.isArray(payload['items']) ? payload['items'] : [];

    const errors: Record<string, string[]> = {};
    const patient = db.patients.find((row) => row.id === patientId);
    if (patient === undefined) {
      errors['patient'] = ['Select a valid patient.'];
    }
    if (rawItems.length === 0) {
      errors['items'] = ['An invoice needs at least one line item.'];
    }

    let lineId = db.invoices.reduce(
      (max, row) => Math.max(max, ...row.items.map((item) => item.id), 0),
      0,
    );
    const items: InvoiceLineItemDto[] = [];

    rawItems.forEach((raw, index) => {
      if (raw === null || typeof raw !== 'object') {
        return;
      }
      const record = raw as Record<string, unknown>;
      const description = str(record, 'description').trim();
      const quantity = num(record, 'quantity');
      const unitPrice = num(record, 'unit_price');
      const discount = num(record, 'discount') ?? 0;

      if (description === '') {
        errors[`items.${index}.description`] = ['This field may not be blank.'];
      }
      if (quantity === null || quantity <= 0 || !Number.isInteger(quantity)) {
        errors[`items.${index}.quantity`] = ['Enter a whole quantity greater than 0.'];
      }
      if (unitPrice === null || unitPrice < 0) {
        errors[`items.${index}.unit_price`] = ['Enter a valid price.'];
      }
      // A discount larger than the line is almost always a typo for a price.
      if (quantity !== null && unitPrice !== null && discount > quantity * unitPrice) {
        errors[`items.${index}.discount`] = ['Discount cannot exceed the line total.'];
      }

      items.push({
        id: ++lineId,
        source: str(record, 'source') || 'consultation',
        description,
        quantity: quantity ?? 0,
        unit_price: (unitPrice ?? 0).toFixed(2),
        discount: discount.toFixed(2),
        reference: null,
      });
    });

    if (Object.keys(errors).length > 0) {
      return validationError(errors);
    }

    const id = nextId('invoices', db.invoices);
    const invoice: InvoiceDto = {
      id,
      invoice_number: `INV-2026-${String(id).padStart(5, '0')}`,
      patient: patientId,
      patient_name: patient!.full_name,
      patient_mrn: patient!.mrn,
      status: 'unpaid',
      items,
      payments: [],
      tax_rate: (num(payload, 'tax_rate') ?? DEFAULT_TAX_RATE).toFixed(4),
      issued_at: isoDateTime(0),
      due_date: str(payload, 'due_date') || isoDate(14),
      notes: str(payload, 'notes'),
    };

    db.invoices = [invoice, ...db.invoices];
    return created(invoice);
  }

  const detail = match(request, 'GET', '/invoices/:id/');
  if (detail !== null) {
    const row = db.invoices.find((invoice) => invoice.id === Number(detail['id']));
    if (row === undefined) {
      return notFound('Invoice not found.');
    }
    if (user.role === 'patient' && row.patient !== user.patient_id) {
      return notFound('Invoice not found.');
    }
    return ok(row);
  }

  /* ---------------------------------------------------------- payments */

  const addPayment = match(request, 'POST', '/invoices/:id/payments/');
  if (addPayment !== null) {
    if (user.role === 'patient') {
      return detailError(403, 'Payments are recorded by hospital staff.');
    }

    const id = Number(addPayment['id']);
    const invoice = db.invoices.find((row) => row.id === id);
    if (invoice === undefined) {
      return notFound('Invoice not found.');
    }
    if (invoice.status === 'cancelled') {
      return detailError(409, 'A cancelled invoice cannot take payments.');
    }

    const payload = body(request);
    const amount = num(payload, 'amount');
    if (amount === null || amount <= 0) {
      return validationError({ amount: ['Enter an amount greater than 0.'] });
    }

    const due = invoiceTotalPaisa(invoice) - paidPaisa(invoice);
    // Overpayment would silently create a credit nobody tracks.
    if (Math.round(amount * 100) > due) {
      return validationError({
        amount: [`The outstanding balance is ৳${(due / 100).toFixed(2)}.`],
      });
    }

    const payment: PaymentDto = {
      id: nextId('payments', db.invoices.flatMap((row) => row.payments)),
      amount: amount.toFixed(2),
      method: str(payload, 'method') || 'cash',
      reference: str(payload, 'reference') || null,
      received_at: isoDateTime(0),
      received_by_name: `${user.first_name} ${user.last_name}`.trim(),
    };

    return ok(replaceInvoice(id, { payments: [...invoice.payments, payment] }));
  }

  const cancel = match(request, 'POST', '/invoices/:id/cancel/');
  if (cancel !== null) {
    if (user.role === 'patient') {
      return detailError(403, 'Only hospital staff can cancel an invoice.');
    }
    const id = Number(cancel['id']);
    const invoice = db.invoices.find((row) => row.id === id);
    if (invoice === undefined) {
      return notFound('Invoice not found.');
    }
    if (paidPaisa(invoice) > 0) {
      return detailError(409, 'An invoice with payments must be refunded, not cancelled.');
    }
    return ok(replaceInvoice(id, { status: 'cancelled' }));
  }

  /** Invoice PDF, delivered through the same signed-ticket flow as reports. */
  const pdf = match(request, 'GET', '/invoices/:id/download-url/');
  if (pdf !== null) {
    const id = Number(pdf['id']);
    const invoice = db.invoices.find((row) => row.id === id);
    if (invoice === undefined || (user.role === 'patient' && invoice.patient !== user.patient_id)) {
      return notFound('Invoice not found.');
    }
    return ok({
      url: `/api/invoices/${id}/file/?sig=${Math.random().toString(36).slice(2, 18)}`,
      expires_at: isoDateTime(5),
      filename: `${invoice.invoice_number}.pdf`,
    });
  }

  return null;
};
