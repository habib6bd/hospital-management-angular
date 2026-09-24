import type { InvoiceDto, InvoiceLineItemDto, PaymentDto } from '../../../shared/models/billing.dto';
import type { PatientDto } from '../../../shared/models/patient.dto';
import { createRng, isoDate, isoDateTime, pick, randomInt } from '../mock-utils';

const CONSULTATION_ITEMS = [
  { description: 'Specialist consultation', price: 1200 },
  { description: 'General consultation', price: 800 },
  { description: 'Follow-up consultation', price: 500 },
];

const ADMISSION_ITEMS = [
  { description: 'General ward bed charge (per day)', price: 1500 },
  { description: 'ICU bed charge (per day)', price: 8500 },
  { description: 'Nursing care (per day)', price: 900 },
];

const PHARMACY_ITEMS = [
  { description: 'Paracetamol 500mg', price: 1.2 },
  { description: 'Ceftriaxone 1g Injection', price: 180 },
  { description: 'Normal Saline 500ml', price: 95 },
  { description: 'IV Cannula 20G', price: 32 },
];

const LAB_ITEMS = [
  { description: 'Complete Blood Count', price: 750 },
  { description: 'Fasting Blood Glucose', price: 200 },
  { description: 'Liver Function Test', price: 700 },
  { description: 'HbA1c', price: 900 },
];

const PROCEDURE_ITEMS = [
  { description: 'Wound dressing', price: 600 },
  { description: 'ECG', price: 500 },
  { description: 'Nebulisation', price: 350 },
];

const CASHIERS = ['Tanvir Ahmed', 'Ayesha Rahman', 'Farhana Akter'];

const TAX_RATE = 0.05;

interface BillingSeedResult {
  invoices: InvoiceDto[];
}

export function buildBillingSeed(patients: readonly PatientDto[]): BillingSeedResult {
  const rng = createRng(31415926);
  const invoices: InvoiceDto[] = [];

  let invoiceId = 1;
  let itemId = 1;
  let paymentId = 1;

  for (let n = 0; n < 38; n++) {
    const patient = pick(rng, patients);
    const isInpatient = patient.patient_type === 'ipd';
    const items: InvoiceLineItemDto[] = [];

    const push = (source: string, entry: { description: string; price: number }, quantity: number) => {
      // Occasional small discounts, so the discount column is not always zero.
      const discount = rng() < 0.18 ? Math.round(entry.price * quantity * 0.1) : 0;
      items.push({
        id: itemId++,
        source,
        description: entry.description,
        quantity,
        unit_price: entry.price.toFixed(2),
        discount: discount.toFixed(2),
        reference: null,
      });
    };

    push('consultation', pick(rng, CONSULTATION_ITEMS), 1);

    if (isInpatient) {
      const days = randomInt(rng, 1, 7);
      push('admission', pick(rng, ADMISSION_ITEMS), days);
      push('admission', ADMISSION_ITEMS[2]!, days);
    }

    const labCount = randomInt(rng, 0, 3);
    for (let i = 0; i < labCount; i++) {
      push('lab', pick(rng, LAB_ITEMS), 1);
    }

    const pharmacyCount = randomInt(rng, 0, 4);
    for (let i = 0; i < pharmacyCount; i++) {
      push('pharmacy', pick(rng, PHARMACY_ITEMS), randomInt(rng, 1, 20));
    }

    if (rng() < 0.3) {
      push('procedure', pick(rng, PROCEDURE_ITEMS), 1);
    }

    // Total, mirroring the client-side formula so seeded payments are coherent.
    const gross = items.reduce(
      (sum, item) => sum + Math.round(Number(item.unit_price) * 100) * item.quantity,
      0,
    );
    const discount = items.reduce((sum, item) => sum + Math.round(Number(item.discount) * 100), 0);
    const subtotal = gross - Math.min(discount, gross);
    const total = subtotal + Math.round(subtotal * TAX_RATE);

    const issuedMinutesAgo = randomInt(rng, 60, 60 * 24 * 60);
    const roll = rng();
    const payments: PaymentDto[] = [];
    let status: string;

    if (roll < 0.1) {
      status = 'draft';
    } else if (roll < 0.35) {
      status = 'unpaid';
    } else if (roll < 0.55) {
      // Part payment: somewhere between a quarter and three quarters.
      const paid = Math.round(total * (0.25 + rng() * 0.5));
      payments.push({
        id: paymentId++,
        amount: (paid / 100).toFixed(2),
        method: pick(rng, ['cash', 'bkash', 'card', 'nagad']),
        reference: null,
        received_at: isoDateTime(-randomInt(rng, 10, issuedMinutesAgo)),
        received_by_name: pick(rng, CASHIERS),
      });
      status = 'partial';
    } else if (roll < 0.95) {
      payments.push({
        id: paymentId++,
        amount: (total / 100).toFixed(2),
        method: pick(rng, ['cash', 'bkash', 'card', 'bank_transfer', 'insurance']),
        reference: null,
        received_at: isoDateTime(-randomInt(rng, 10, issuedMinutesAgo)),
        received_by_name: pick(rng, CASHIERS),
      });
      status = 'paid';
    } else {
      status = 'cancelled';
    }

    invoices.push({
      id: invoiceId,
      invoice_number: `INV-2026-${String(invoiceId).padStart(5, '0')}`,
      patient: patient.id,
      patient_name: patient.full_name,
      patient_mrn: patient.mrn,
      status,
      items,
      payments,
      tax_rate: TAX_RATE.toFixed(4),
      issued_at: isoDateTime(-issuedMinutesAgo),
      due_date: isoDate(randomInt(rng, -20, 20)),
      notes: '',
    });

    invoiceId++;
  }

  return { invoices };
}

export const DEFAULT_TAX_RATE = TAX_RATE;
