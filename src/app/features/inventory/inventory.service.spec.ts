import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { InventoryService, SupplierService } from './inventory.service';
import { AuthService } from '../../core/auth/auth.service';
import { provideAppConfig } from '../../core/config/app-config';
import { authInterceptor } from '../../core/interceptors/auth.interceptor';
import { errorInterceptor } from '../../core/interceptors/error.interceptor';
import { mockApiInterceptor } from '../../core/interceptors/mock-api.interceptor';
import { stockStatus } from '../../shared/models/inventory.model';

async function setup(): Promise<{ inventory: InventoryService; suppliers: SupplierService }> {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: 'auth/login', children: [] }]),
      provideAppConfig({ mockLatencyMs: [0, 0], pageSize: 10 }),
      provideHttpClient(withInterceptors([errorInterceptor, authInterceptor, mockApiInterceptor])),
    ],
  });
  await TestBed.inject(AuthService).login({ username: 'pharmacy', password: 'demo1234' });
  return {
    inventory: TestBed.inject(InventoryService),
    suppliers: TestBed.inject(SupplierService),
  };
}

async function settle(isLoading?: () => boolean): Promise<void> {
  const appRef = TestBed.inject(ApplicationRef);
  for (let attempt = 0; attempt < 50; attempt++) {
    appRef.tick();
    await appRef.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    // `attempt > 2` matters: a resource that has not started yet also reports
    // `isLoading() === false`, so returning on the first pass would read a
    // resource that never fetched.
    if (isLoading !== undefined && !isLoading() && attempt > 2) {
      return;
    }
    if (isLoading === undefined && attempt >= 2) {
      return;
    }
  }
}

describe('InventoryService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('loads a paged item list mapped to domain models', async () => {
    const { inventory } = await setup();
    await settle(inventory.isLoading);

    const page = inventory.items()!;
    expect(page.items.length).toBe(10);
    expect(page.total).toBeGreaterThan(10);

    const first = page.items[0]!;
    expect(typeof first.unitPrice).toBe('number');
    expect(Number.isNaN(first.unitPrice)).toBe(false);
    expect(first.code).toMatch(/^(MED|CON|EQP)-\d{4}$/);
  });

  it('derives alerts from a dedicated endpoint, not the current page', async () => {
    const { inventory } = await setup();
    await settle(inventory.isAlertsLoading);

    // The alert set must be able to exceed one page of the list.
    expect(inventory.alertCount()).toBeGreaterThan(0);
    expect(inventory.outOfStock().every((item) => item.quantityInStock === 0)).toBe(true);
    expect(
      inventory
        .lowStock()
        .every((item) => item.quantityInStock > 0 && item.quantityInStock <= item.reorderLevel),
    ).toBe(true);

    // The four buckets are mutually exclusive, so nothing is double-counted.
    const ids = [
      ...inventory.outOfStock(),
      ...inventory.lowStock(),
      ...inventory.expired(),
      ...inventory.expiringSoon(),
    ].map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('sorts expiring items soonest-first so the panel is actionable', async () => {
    const { inventory } = await setup();
    await settle(inventory.isAlertsLoading);

    const expiries = inventory.expiringSoon().map((item) => item.nearestExpiry ?? '');
    expect([...expiries].sort()).toEqual(expiries);
  });

  it('filters by stock status server-side so paging stays correct', async () => {
    const { inventory } = await setup();
    await settle(inventory.isLoading);

    inventory.patchQuery({ stock: 'out' });
    await settle(inventory.isLoading);
    expect(inventory.items()!.items.every((item) => item.quantityInStock === 0)).toBe(true);

    inventory.patchQuery({ stock: 'low' });
    await settle(inventory.isLoading);
    expect(
      inventory.items()!.items.every((item) => stockStatus(item) !== 'healthy'),
    ).toBe(true);
  });

  it('filters by category', async () => {
    const { inventory } = await setup();
    await settle(inventory.isLoading);

    inventory.patchQuery({ category: 'equipment' });
    await settle(inventory.isLoading);

    const items = inventory.items()!.items;
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((item) => item.category === 'equipment')).toBe(true);
  });

  it('adds stock as a new batch and raises the quantity', async () => {
    const { inventory } = await setup();
    await settle(inventory.isLoading);

    const target = inventory.items()!.items.find((item) => item.category === 'medicine')!;
    inventory.select(target.id);
    await settle(inventory.isDetailLoading);

    const before = inventory.selectedItem()!.quantityInStock;

    const movement = await inventory.recordMovement({
      itemId: target.id,
      type: 'stock_in',
      quantity: '250',
      batchNumber: 'TEST-BATCH-1',
      expiryDate: '2028-12-31',
      reason: 'Purchase order',
    });

    expect(movement.balanceAfter).toBe(before + 250);
    await settle(inventory.isBatchesLoading);
    expect(inventory.batches().some((batch) => batch.batchNumber === 'TEST-BATCH-1')).toBe(true);
  });

  it('adds a batch to untracked stock without discarding the existing quantity', async () => {
    const { inventory } = await setup();
    await settle(inventory.isLoading);

    // A consumable seeded without batches — the case that previously reset the
    // total to just the new batch's size.
    inventory.patchQuery({ category: 'consumable' });
    await settle(inventory.isLoading);

    const untracked = inventory
      .items()!
      .items.find((row) => row.quantityInStock > 0 && row.nearestExpiry === null)!;

    inventory.select(untracked.id);
    await settle(inventory.isDetailLoading);
    const before = inventory.selectedItem()!.quantityInStock;
    expect(before).toBeGreaterThan(0);

    const movement = await inventory.recordMovement({
      itemId: untracked.id,
      type: 'stock_in',
      quantity: '75',
      batchNumber: 'MIXED-1',
      expiryDate: '2029-06-01',
      reason: 'Purchase order',
    });

    expect(movement.balanceAfter).toBe(before + 75);
  });

  it('issues stock first-expiry-first-out', async () => {
    const { inventory } = await setup();
    await settle(inventory.isLoading);

    const target = inventory.items()!.items.find((item) => item.category === 'medicine')!;
    inventory.select(target.id);
    await settle(inventory.isDetailLoading);

    // Two batches with different expiries; the earlier one must be drawn down first.
    await inventory.recordMovement({
      itemId: target.id,
      type: 'stock_in',
      quantity: '100',
      batchNumber: 'FEFO-LATE',
      expiryDate: '2030-01-01',
      reason: 'seed',
    });
    await settle(inventory.isBatchesLoading);
    await inventory.recordMovement({
      itemId: target.id,
      type: 'stock_in',
      quantity: '40',
      batchNumber: 'FEFO-EARLY',
      expiryDate: '2027-01-01',
      reason: 'seed',
    });
    await settle(inventory.isBatchesLoading);

    const earlyBefore = inventory.batches().find((b) => b.batchNumber === 'FEFO-EARLY')!;
    const lateBefore = inventory.batches().find((b) => b.batchNumber === 'FEFO-LATE')!;

    // Any batch expiring before FEFO-EARLY is consumed first; issue enough to
    // be sure FEFO-EARLY is touched before FEFO-LATE.
    const earlierStock = inventory
      .batches()
      .filter((b) => b.expiryDate < earlyBefore.expiryDate)
      .reduce((sum, b) => sum + b.quantity, 0);

    await inventory.recordMovement({
      itemId: target.id,
      type: 'stock_out',
      quantity: String(earlierStock + 10),
      batchNumber: '',
      expiryDate: '',
      reason: 'Dispensed',
    });
    await settle(inventory.isBatchesLoading);

    const earlyAfter = inventory.batches().find((b) => b.batchNumber === 'FEFO-EARLY')!;
    const lateAfter = inventory.batches().find((b) => b.batchNumber === 'FEFO-LATE')!;

    expect(earlyAfter.quantity).toBe(earlyBefore.quantity - 10);
    expect(lateAfter.quantity).toBe(lateBefore.quantity);
  });

  it('refuses to issue more stock than is on hand', async () => {
    const { inventory } = await setup();
    await settle(inventory.isLoading);

    const target = inventory.items()!.items.find((item) => item.quantityInStock > 0)!;

    try {
      await inventory.recordMovement({
        itemId: target.id,
        type: 'stock_out',
        quantity: String(target.quantityInStock + 1000),
        batchNumber: '',
        expiryDate: '',
        reason: 'Overdraw',
      });
      throw new Error('expected the movement to be rejected');
    } catch (error: unknown) {
      const apiError = error as { status?: number; fieldErrors?: Record<string, string[]> };
      expect(apiError.status).toBe(400);
      expect(apiError.fieldErrors?.['quantity']?.[0]).toContain('in stock');
    }
  });

  it('rejects a duplicate item code', async () => {
    const { inventory } = await setup();
    await settle(inventory.isLoading);

    const existing = inventory.items()!.items[0]!;

    try {
      await inventory.create({
        code: existing.code,
        name: 'Duplicate',
        category: 'medicine',
        unit: 'pcs',
        reorderLevel: '10',
        unitPrice: '5',
        supplierId: '',
      });
      throw new Error('expected the create to be rejected');
    } catch (error: unknown) {
      const apiError = error as { fieldErrors?: Record<string, string[]> };
      expect(apiError.fieldErrors?.['code']?.[0]).toContain('already exists');
    }
  });
});

describe('SupplierService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('separates active suppliers from the full list', async () => {
    const { suppliers } = await setup();
    await settle(suppliers.isLoading);

    expect(suppliers.suppliers().length).toBeGreaterThan(0);
    expect(suppliers.activeSuppliers().every((supplier) => supplier.isActive)).toBe(true);
    expect(suppliers.activeSuppliers().length).toBeLessThan(suppliers.suppliers().length);
  });
});
