import {
  computeTotals,
  derivedStatus,
  lineTotal,
  type ChargeSource,
  type Invoice,
  type InvoiceInput,
  type InvoiceLineItem,
  type Payment,
  type PaymentInput,
  type PaymentMethod,
  type PaymentStatus,
} from './billing.model';

export interface InvoiceLineItemDto {
  readonly id: number;
  readonly source: string;
  readonly description: string;
  readonly quantity: number;
  readonly unit_price: string;
  readonly discount: string;
  readonly reference: string | null;
}

export interface PaymentDto {
  readonly id: number;
  readonly amount: string;
  readonly method: string;
  readonly reference: string | null;
  readonly received_at: string;
  readonly received_by_name: string;
}

export interface InvoiceDto {
  readonly id: number;
  readonly invoice_number: string;
  readonly patient: number;
  readonly patient_name: string;
  readonly patient_mrn: string;
  readonly status: string;
  readonly items: readonly InvoiceLineItemDto[];
  readonly payments: readonly PaymentDto[];
  readonly tax_rate: string;
  readonly issued_at: string;
  readonly due_date: string;
  readonly notes: string;
}

function decimal(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function toSource(value: string): ChargeSource {
  switch (value) {
    case 'admission':
    case 'pharmacy':
    case 'lab':
    case 'procedure':
      return value;
    default:
      return 'consultation';
  }
}

function toMethod(value: string): PaymentMethod {
  switch (value) {
    case 'card':
    case 'bkash':
    case 'nagad':
    case 'bank_transfer':
    case 'insurance':
      return value;
    default:
      return 'cash';
  }
}

function toStatus(value: string): PaymentStatus {
  switch (value) {
    case 'unpaid':
    case 'partial':
    case 'paid':
    case 'cancelled':
    case 'refunded':
      return value;
    default:
      return 'draft';
  }
}

export function toInvoiceLineItem(dto: InvoiceLineItemDto): InvoiceLineItem {
  const unitPrice = decimal(dto.unit_price);
  const discount = decimal(dto.discount);
  return {
    id: dto.id,
    source: toSource(dto.source),
    description: dto.description,
    quantity: dto.quantity,
    unitPrice,
    discount,
    lineTotal: lineTotal(dto.quantity, unitPrice, discount),
    reference: dto.reference,
  };
}

export function toPayment(dto: PaymentDto): Payment {
  return {
    id: dto.id,
    amount: decimal(dto.amount),
    method: toMethod(dto.method),
    reference: dto.reference,
    receivedAt: dto.received_at,
    receivedBy: dto.received_by_name,
  };
}

/**
 * Totals are recomputed from the line items rather than read from the wire.
 *
 * The backend sends only the raw lines and the tax rate; deriving here means
 * the invoice a user sees is arithmetically consistent with the lines shown,
 * and a draft edited locally previews with the identical formula.
 */
export function toInvoice(dto: InvoiceDto): Invoice {
  const items = dto.items.map(toInvoiceLineItem);
  const payments = dto.payments.map(toPayment);
  const taxRate = decimal(dto.tax_rate);
  const totals = computeTotals(items, taxRate, payments);
  const status = toStatus(dto.status);

  return {
    id: dto.id,
    invoiceNumber: dto.invoice_number,
    patientId: dto.patient,
    patientName: dto.patient_name,
    patientMrn: dto.patient_mrn,
    status: derivedStatus(totals.total, totals.amountPaid, status),
    items,
    payments,
    taxRate,
    ...totals,
    issuedAt: dto.issued_at,
    dueDate: dto.due_date,
    notes: dto.notes,
  };
}

export function toInvoiceWriteDto(input: InvoiceInput): Record<string, unknown> {
  return {
    patient: input.patientId,
    tax_rate: input.taxRate.toFixed(4),
    due_date: input.dueDate === '' ? null : input.dueDate,
    notes: input.notes.trim(),
    items: input.items.map((item) => ({
      source: item.source,
      description: item.description.trim(),
      quantity: Number(item.quantity),
      unit_price: Number(item.unitPrice).toFixed(2),
      discount: Number(item.discount || '0').toFixed(2),
    })),
  };
}

export function toPaymentWriteDto(input: PaymentInput): Record<string, unknown> {
  return {
    amount: Number(input.amount).toFixed(2),
    method: input.method,
    reference: input.reference.trim() === '' ? null : input.reference.trim(),
  };
}
