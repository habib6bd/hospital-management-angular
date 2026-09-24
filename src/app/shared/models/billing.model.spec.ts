import { computeTotals, derivedStatus, lineTotal } from './billing.model';

describe('lineTotal', () => {
  it('multiplies then subtracts the discount', () => {
    expect(lineTotal(3, 250, 0)).toBe(750);
    expect(lineTotal(3, 250, 75)).toBe(675);
  });

  it('never returns a negative line', () => {
    expect(lineTotal(1, 100, 500)).toBe(0);
  });

  it('is exact for prices that float arithmetic gets wrong', () => {
    // 0.1 + 0.2 style drift: 3 × 1.15 is 3.4499999999999997 in float.
    expect(lineTotal(3, 1.15, 0)).toBe(3.45);
    expect(lineTotal(7, 0.07, 0)).toBe(0.49);
  });
});

describe('computeTotals', () => {
  const items = [
    { quantity: 1, unitPrice: 1200, discount: 0 },
    { quantity: 3, unitPrice: 250, discount: 75 },
    { quantity: 20, unitPrice: 1.2, discount: 0 },
  ];

  it('sums lines, applies tax and reports the balance', () => {
    const totals = computeTotals(items, 0.05);

    // 1200 + 750 + 24 = 1974 gross, minus 75 discount = 1899 subtotal.
    expect(totals.subtotal).toBe(1899);
    expect(totals.discountTotal).toBe(75);
    expect(totals.taxAmount).toBe(94.95);
    expect(totals.total).toBe(1993.95);
    expect(totals.amountPaid).toBe(0);
    expect(totals.amountDue).toBe(1993.95);
  });

  it('subtracts payments from the balance due', () => {
    const totals = computeTotals(items, 0.05, [{ amount: 1000 }, { amount: 493.95 }]);
    expect(totals.amountPaid).toBe(1493.95);
    expect(totals.amountDue).toBe(500);
  });

  it('never reports a negative balance, even if overpaid', () => {
    const totals = computeTotals(items, 0.05, [{ amount: 5000 }]);
    expect(totals.amountDue).toBe(0);
  });

  it('caps the discount at the gross so a bill cannot go negative', () => {
    const totals = computeTotals([{ quantity: 1, unitPrice: 100, discount: 500 }], 0.05);
    expect(totals.subtotal).toBe(0);
    expect(totals.discountTotal).toBe(100);
    expect(totals.total).toBe(0);
  });

  it('stays exact across many small lines', () => {
    // 100 lines at 0.07 would drift to 6.999999999999995 with naive addition.
    const many = Array.from({ length: 100 }, () => ({
      quantity: 1,
      unitPrice: 0.07,
      discount: 0,
    }));
    expect(computeTotals(many, 0).subtotal).toBe(7);
  });

  it('handles a zero tax rate and an empty invoice', () => {
    expect(computeTotals(items, 0).total).toBe(1899);
    const empty = computeTotals([], 0.05);
    expect(empty.total).toBe(0);
    expect(empty.amountDue).toBe(0);
  });
});

describe('derivedStatus', () => {
  it('reads the status off the money for live invoices', () => {
    expect(derivedStatus(1000, 0, 'unpaid')).toBe('unpaid');
    expect(derivedStatus(1000, 400, 'unpaid')).toBe('partial');
    expect(derivedStatus(1000, 1000, 'unpaid')).toBe('paid');
  });

  it('treats a paisa-exact payment as settled', () => {
    // 19.99 + 0.01 is 20.000000000000004 as a float.
    expect(derivedStatus(20, 19.99 + 0.01, 'partial')).toBe('paid');
  });

  it('leaves terminal and draft states alone', () => {
    expect(derivedStatus(1000, 0, 'cancelled')).toBe('cancelled');
    expect(derivedStatus(1000, 1000, 'refunded')).toBe('refunded');
    expect(derivedStatus(1000, 0, 'draft')).toBe('draft');
  });
});
