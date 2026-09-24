import {
  EXPIRY_WARNING_DAYS,
  daysUntil,
  stockStatus,
  stockStatusTone,
  type InventoryItem,
} from './inventory.model';

function item(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: 1,
    code: 'MED-0001',
    name: 'Paracetamol 500mg',
    category: 'medicine',
    unit: 'tablet',
    quantityInStock: 500,
    reorderLevel: 100,
    unitPrice: 1.2,
    supplierId: 1,
    supplierName: 'Square Pharmaceuticals',
    isActive: true,
    nearestExpiry: null,
    ...overrides,
  };
}

/** Fixed "now" so these never drift with the calendar. */
const NOW = new Date('2026-06-15T10:00:00');

function offsetDate(days: number): string {
  const date = new Date(NOW);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

describe('daysUntil', () => {
  it('counts whole days from the start of today', () => {
    expect(daysUntil(offsetDate(0), NOW)).toBe(0);
    expect(daysUntil(offsetDate(1), NOW)).toBe(1);
    expect(daysUntil(offsetDate(-3), NOW)).toBe(-3);
  });

  it('treats an unparseable date as infinitely far away rather than expired', () => {
    expect(daysUntil('not-a-date', NOW)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('stockStatus', () => {
  it('reports healthy stock above the reorder level', () => {
    expect(stockStatus(item(), NOW)).toBe('healthy');
  });

  it('reports low stock at or below the reorder level', () => {
    expect(stockStatus(item({ quantityInStock: 100 }), NOW)).toBe('low_stock');
    expect(stockStatus(item({ quantityInStock: 99 }), NOW)).toBe('low_stock');
  });

  it('reports out of stock at zero or below', () => {
    expect(stockStatus(item({ quantityInStock: 0 }), NOW)).toBe('out_of_stock');
    expect(stockStatus(item({ quantityInStock: -5 }), NOW)).toBe('out_of_stock');
  });

  it('prioritises out of stock over every expiry signal', () => {
    const empty = item({ quantityInStock: 0, nearestExpiry: offsetDate(-10) });
    expect(stockStatus(empty, NOW)).toBe('out_of_stock');
  });

  it('prioritises expiry over low stock, because expired stock cannot be issued', () => {
    const expiring = item({ quantityInStock: 50, nearestExpiry: offsetDate(10) });
    expect(stockStatus(expiring, NOW)).toBe('expiring_soon');

    const expired = item({ quantityInStock: 50, nearestExpiry: offsetDate(-1) });
    expect(stockStatus(expired, NOW)).toBe('expired');
  });

  it('uses an inclusive boundary at the warning window', () => {
    expect(stockStatus(item({ nearestExpiry: offsetDate(EXPIRY_WARNING_DAYS) }), NOW)).toBe(
      'expiring_soon',
    );
    expect(stockStatus(item({ nearestExpiry: offsetDate(EXPIRY_WARNING_DAYS + 1) }), NOW)).toBe(
      'healthy',
    );
    expect(stockStatus(item({ nearestExpiry: offsetDate(0) }), NOW)).toBe('expiring_soon');
  });

  it('ignores expiry for items that do not carry one', () => {
    expect(stockStatus(item({ nearestExpiry: null, quantityInStock: 500 }), NOW)).toBe('healthy');
  });
});

describe('stockStatusTone', () => {
  it('maps urgency onto the shared status palette', () => {
    expect(stockStatusTone('out_of_stock')).toBe('critical');
    expect(stockStatusTone('expired')).toBe('critical');
    expect(stockStatusTone('expiring_soon')).toBe('pending');
    expect(stockStatusTone('low_stock')).toBe('pending');
    expect(stockStatusTone('healthy')).toBe('ready');
  });
});
