export type ChargeSource = 'consultation' | 'admission' | 'pharmacy' | 'lab' | 'procedure';

export const CHARGE_SOURCE_LABELS: Readonly<Record<ChargeSource, string>> = {
  consultation: 'Consultation',
  admission: 'Admission',
  pharmacy: 'Pharmacy',
  lab: 'Laboratory',
  procedure: 'Procedure',
};

export type PaymentStatus = 'draft' | 'unpaid' | 'partial' | 'paid' | 'cancelled' | 'refunded';

export const PAYMENT_STATUS_LABELS: Readonly<Record<PaymentStatus, string>> = {
  draft: 'Draft',
  unpaid: 'Unpaid',
  partial: 'Part paid',
  paid: 'Paid',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

export function paymentTone(
  status: PaymentStatus,
): 'ready' | 'pending' | 'critical' | 'info' | 'neutral' {
  switch (status) {
    case 'paid':
      return 'ready';
    case 'partial':
      return 'pending';
    case 'unpaid':
      return 'critical';
    case 'draft':
      return 'info';
    default:
      return 'neutral';
  }
}

export type PaymentMethod = 'cash' | 'card' | 'bkash' | 'nagad' | 'bank_transfer' | 'insurance';

export const PAYMENT_METHOD_LABELS: Readonly<Record<PaymentMethod, string>> = {
  cash: 'Cash',
  card: 'Card',
  bkash: 'bKash',
  nagad: 'Nagad',
  bank_transfer: 'Bank transfer',
  insurance: 'Insurance',
};

export interface InvoiceLineItem {
  readonly id: number;
  readonly source: ChargeSource;
  readonly description: string;
  readonly quantity: number;
  readonly unitPrice: number;
  /** Per-line discount in BDT, not a percentage. */
  readonly discount: number;
  /** quantity × unitPrice − discount. */
  readonly lineTotal: number;
  readonly reference: string | null;
}

export interface Payment {
  readonly id: number;
  readonly amount: number;
  readonly method: PaymentMethod;
  readonly reference: string | null;
  readonly receivedAt: string;
  readonly receivedBy: string;
}

export interface Invoice {
  readonly id: number;
  readonly invoiceNumber: string;
  readonly patientId: number;
  readonly patientName: string;
  readonly patientMrn: string;
  readonly status: PaymentStatus;
  readonly items: readonly InvoiceLineItem[];
  readonly payments: readonly Payment[];
  readonly subtotal: number;
  readonly discountTotal: number;
  readonly taxRate: number;
  readonly taxAmount: number;
  readonly total: number;
  readonly amountPaid: number;
  readonly amountDue: number;
  readonly issuedAt: string;
  readonly dueDate: string;
  readonly notes: string;
}

/**
 * Money is computed in integer paisa and converted back, so a bill never ends
 * up a paisa out from floating-point drift across many lines.
 */
function toPaisa(amount: number): number {
  return Math.round(amount * 100);
}

function fromPaisa(paisa: number): number {
  return paisa / 100;
}

export function lineTotal(quantity: number, unitPrice: number, discount: number): number {
  const gross = toPaisa(unitPrice) * quantity;
  return fromPaisa(Math.max(0, gross - toPaisa(discount)));
}

export interface InvoiceTotals {
  readonly subtotal: number;
  readonly discountTotal: number;
  readonly taxAmount: number;
  readonly total: number;
  readonly amountPaid: number;
  readonly amountDue: number;
}

/**
 * Single source of truth for invoice arithmetic. The list, the detail view and
 * the draft editor all call this, so a draft's preview always matches what the
 * backend will charge.
 */
export function computeTotals(
  items: readonly { quantity: number; unitPrice: number; discount: number }[],
  taxRate: number,
  payments: readonly { amount: number }[] = [],
): InvoiceTotals {
  let grossPaisa = 0;
  let discountPaisa = 0;

  for (const item of items) {
    grossPaisa += toPaisa(item.unitPrice) * item.quantity;
    discountPaisa += toPaisa(item.discount);
  }

  // A discount can never exceed the gross; a negative bill is not a thing.
  const cappedDiscount = Math.min(discountPaisa, grossPaisa);
  const subtotalPaisa = grossPaisa - cappedDiscount;
  const taxPaisa = Math.round(subtotalPaisa * taxRate);
  const totalPaisa = subtotalPaisa + taxPaisa;
  const paidPaisa = payments.reduce((sum, payment) => sum + toPaisa(payment.amount), 0);

  return {
    subtotal: fromPaisa(subtotalPaisa),
    discountTotal: fromPaisa(cappedDiscount),
    taxAmount: fromPaisa(taxPaisa),
    total: fromPaisa(totalPaisa),
    amountPaid: fromPaisa(paidPaisa),
    amountDue: fromPaisa(Math.max(0, totalPaisa - paidPaisa)),
  };
}

/** Status implied by the money, used to keep the badge honest. */
export function derivedStatus(
  total: number,
  amountPaid: number,
  current: PaymentStatus,
): PaymentStatus {
  if (current === 'cancelled' || current === 'refunded' || current === 'draft') {
    return current;
  }
  if (amountPaid <= 0) {
    return 'unpaid';
  }
  return toPaisa(amountPaid) >= toPaisa(total) ? 'paid' : 'partial';
}

export interface InvoiceLineInput {
  source: ChargeSource;
  description: string;
  quantity: string;
  unitPrice: string;
  discount: string;
}

export interface InvoiceInput {
  readonly patientId: number;
  readonly items: readonly InvoiceLineInput[];
  readonly taxRate: number;
  readonly dueDate: string;
  readonly notes: string;
}

export interface PaymentInput {
  readonly amount: string;
  readonly method: PaymentMethod;
  readonly reference: string;
}
