import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { BillingService } from './billing.service';
import { AuthService } from '../../core/auth/auth.service';
import { provideAppConfig } from '../../core/config/app-config';
import { authInterceptor } from '../../core/interceptors/auth.interceptor';
import { errorInterceptor } from '../../core/interceptors/error.interceptor';
import { mockApiInterceptor } from '../../core/interceptors/mock-api.interceptor';
import { computeTotals } from '../../shared/models/billing.model';
import { db } from '../../core/mock/db';

async function setup(username = 'reception'): Promise<BillingService> {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: 'auth/login', children: [] }]),
      provideAppConfig({ mockLatencyMs: [0, 0], pageSize: 50 }),
      provideHttpClient(withInterceptors([errorInterceptor, authInterceptor, mockApiInterceptor])),
    ],
  });
  await TestBed.inject(AuthService).login({ username, password: 'demo1234' });
  return TestBed.inject(BillingService);
}

async function settle(isLoading?: () => boolean): Promise<void> {
  const appRef = TestBed.inject(ApplicationRef);
  for (let attempt = 0; attempt < 50; attempt++) {
    appRef.tick();
    await appRef.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    if (isLoading !== undefined && !isLoading() && attempt > 2) {
      return;
    }
    if (isLoading === undefined && attempt >= 2) {
      return;
    }
  }
}

describe('BillingService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('derives totals that agree with the line items on every invoice', async () => {
    const billing = await setup();
    await settle(billing.isLoading);

    const invoices = billing.invoices()!.items;
    expect(invoices.length).toBeGreaterThan(0);

    for (const invoice of invoices) {
      const expected = computeTotals(invoice.items, invoice.taxRate, invoice.payments);
      expect(invoice.subtotal).toBe(expected.subtotal);
      expect(invoice.total).toBe(expected.total);
      expect(invoice.amountDue).toBe(expected.amountDue);
      // Paid plus due always reconstructs the total, so a bill never "loses" money.
      expect(Math.round((invoice.amountPaid + invoice.amountDue) * 100)).toBe(
        Math.round(invoice.total * 100),
      );
    }
  });

  it('keeps the status badge consistent with the money', async () => {
    const billing = await setup();
    await settle(billing.isLoading);

    for (const invoice of billing.invoices()!.items) {
      if (invoice.status === 'paid') {
        expect(invoice.amountDue).toBe(0);
      }
      if (invoice.status === 'unpaid') {
        expect(invoice.amountPaid).toBe(0);
      }
      if (invoice.status === 'partial') {
        expect(invoice.amountPaid).toBeGreaterThan(0);
        expect(invoice.amountDue).toBeGreaterThan(0);
      }
    }
  });

  it('reports revenue from a summary endpoint, not the current page', async () => {
    const billing = await setup();
    await settle(billing.isSummaryLoading);

    const summary = billing.summary()!;
    expect(summary.totalBilled).toBeGreaterThan(0);
    expect(summary.totalCollected).toBeGreaterThanOrEqual(0);
    // Billed must account for everything collected plus everything still owed.
    expect(Math.round((summary.totalCollected + summary.totalOutstanding) * 100)).toBe(
      Math.round(summary.totalBilled * 100),
    );
    expect(summary.bySource.length).toBeGreaterThan(0);
    expect(billing.collectionRate()).toBeGreaterThan(0);
    expect(billing.collectionRate()).toBeLessThanOrEqual(1);
  });

  it('creates an invoice and computes its total the same way the preview did', async () => {
    const billing = await setup();
    await settle(billing.isLoading);

    const lines = [
      { source: 'consultation' as const, description: 'Specialist consultation', quantity: '1', unitPrice: '1200', discount: '' },
      { source: 'lab' as const, description: 'Complete Blood Count', quantity: '2', unitPrice: '750', discount: '150' },
    ];

    const preview = computeTotals(
      lines.map((line) => ({
        quantity: Number(line.quantity),
        unitPrice: Number(line.unitPrice),
        discount: Number(line.discount || '0'),
      })),
      0.05,
    );

    const invoice = await billing.create({
      patientId: 1,
      items: lines,
      taxRate: 0.05,
      dueDate: '',
      notes: 'Created by test',
    });

    expect(invoice.total).toBe(preview.total);
    expect(invoice.subtotal).toBe(preview.subtotal);
    expect(invoice.status).toBe('unpaid');
    expect(invoice.amountDue).toBe(invoice.total);
  });

  it('records a part payment then settles the balance', async () => {
    const billing = await setup();
    await settle(billing.isLoading);

    const invoice = await billing.create({
      patientId: 1,
      items: [
        { source: 'consultation', description: 'Consultation', quantity: '1', unitPrice: '1000', discount: '' },
      ],
      taxRate: 0,
      dueDate: '',
      notes: '',
    });
    expect(invoice.total).toBe(1000);

    const partial = await billing.recordPayment(invoice.id, {
      amount: '400',
      method: 'bkash',
      reference: 'TX123',
    });
    expect(partial.status).toBe('partial');
    expect(partial.amountPaid).toBe(400);
    expect(partial.amountDue).toBe(600);

    const settled = await billing.recordPayment(invoice.id, {
      amount: '600',
      method: 'cash',
      reference: '',
    });
    expect(settled.status).toBe('paid');
    expect(settled.amountDue).toBe(0);
    expect(settled.payments.length).toBe(2);
  });

  it('refuses a payment larger than the outstanding balance', async () => {
    const billing = await setup();
    await settle(billing.isLoading);

    const invoice = await billing.create({
      patientId: 1,
      items: [
        { source: 'consultation', description: 'Consultation', quantity: '1', unitPrice: '500', discount: '' },
      ],
      taxRate: 0,
      dueDate: '',
      notes: '',
    });

    try {
      await billing.recordPayment(invoice.id, { amount: '900', method: 'cash', reference: '' });
      throw new Error('expected the overpayment to be rejected');
    } catch (error: unknown) {
      const apiError = error as { status?: number; fieldErrors?: Record<string, string[]> };
      expect(apiError.status).toBe(400);
      expect(apiError.fieldErrors?.['amount']?.[0]).toContain('outstanding balance');
    }
  });

  it('rejects a line whose discount exceeds the line total', async () => {
    const billing = await setup();
    await settle(billing.isLoading);

    try {
      await billing.create({
        patientId: 1,
        items: [
          { source: 'lab', description: 'CBC', quantity: '1', unitPrice: '100', discount: '500' },
        ],
        taxRate: 0.05,
        dueDate: '',
        notes: '',
      });
      throw new Error('expected the create to be rejected');
    } catch (error: unknown) {
      const apiError = error as { fieldErrors?: Record<string, string[]> };
      expect(apiError.fieldErrors?.['items.0.discount']?.[0]).toContain('exceed');
    }
  });

  it('will not cancel an invoice that already has payments', async () => {
    const billing = await setup();
    await settle(billing.isLoading);

    const invoice = await billing.create({
      patientId: 1,
      items: [
        { source: 'consultation', description: 'Consultation', quantity: '1', unitPrice: '300', discount: '' },
      ],
      taxRate: 0,
      dueDate: '',
      notes: '',
    });
    await billing.recordPayment(invoice.id, { amount: '100', method: 'cash', reference: '' });

    try {
      await billing.cancel(invoice.id);
      throw new Error('expected the cancel to be rejected');
    } catch (error: unknown) {
      expect((error as { status?: number }).status).toBe(409);
    }
  });
});

describe('billing access for patients', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows a patient only their own invoices', async () => {
    const billing = await setup('patient');
    await settle(billing.isLoading);

    const invoices = billing.invoices()!.items;
    expect(invoices.every((invoice) => invoice.patientId === 1)).toBe(true);
    // The fixture must contain other patients' invoices for this to mean anything.
    expect(db.invoices.some((row) => row.patient !== 1)).toBe(true);
  });

  it('does not let a patient record a payment against their own bill', async () => {
    const billing = await setup('patient');
    await settle(billing.isLoading);

    const invoice = billing.invoices()!.items.find((row) => row.amountDue > 0)!;

    try {
      await billing.recordPayment(invoice.id, { amount: '10', method: 'cash', reference: '' });
      throw new Error('expected the payment to be refused');
    } catch (error: unknown) {
      expect((error as { status?: number }).status).toBe(403);
    }
  });
});
