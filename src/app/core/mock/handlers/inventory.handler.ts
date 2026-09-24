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
import { currentUser } from './auth.handler';
import type { MockHandler, MockRequest } from '../mock-types';
import type {
  BatchDto,
  InventoryItemDto,
  StockMovementDto,
} from '../../../shared/models/inventory.dto';

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

/**
 * Applies a quantity delta and re-derives `nearest_expiry` from the batches.
 *
 * `quantity_in_stock` is the single source of truth for how much is on hand.
 * Batches are a *detail* of that stock, not a parallel total: an item can hold
 * untracked stock (consumables that never expire) alongside batch-tracked
 * stock, so summing batches would wrongly discard the untracked part.
 */
function applyStockDelta(itemId: number, delta: number): InventoryItemDto | null {
  const index = db.inventoryItems.findIndex((row) => row.id === itemId);
  if (index < 0) {
    return null;
  }
  const item = db.inventoryItems[index]!;
  const liveBatches = db.batches.filter((batch) => batch.item === itemId && batch.quantity > 0);

  const updated: InventoryItemDto = {
    ...item,
    quantity_in_stock: Math.max(0, item.quantity_in_stock + delta),
    nearest_expiry:
      liveBatches.length === 0
        ? null
        : liveBatches.reduce(
            (earliest, batch) => (batch.expiry_date < earliest ? batch.expiry_date : earliest),
            liveBatches[0]!.expiry_date,
          ),
  };

  db.inventoryItems[index] = updated;
  return updated;
}

/**
 * Removes stock FEFO (first-expiry-first-out), which is what a pharmacy
 * actually does — not FIFO by receipt date.
 */
function consumeFromBatches(itemId: number, quantity: number): string | null {
  const candidates = db.batches
    .filter((batch) => batch.item === itemId && batch.quantity > 0)
    .sort((a, b) => a.expiry_date.localeCompare(b.expiry_date));

  let remaining = quantity;
  let firstBatchNumber: string | null = null;

  for (const batch of candidates) {
    if (remaining <= 0) {
      break;
    }
    const taken = Math.min(batch.quantity, remaining);
    remaining -= taken;
    firstBatchNumber ??= batch.batch_number;

    const index = db.batches.findIndex((row) => row.id === batch.id);
    db.batches[index] = { ...batch, quantity: batch.quantity - taken };
  }

  return firstBatchNumber;
}

export const inventoryHandler: MockHandler = (request) => {
  if (
    !request.path.startsWith('/inventory/') &&
    !request.path.startsWith('/suppliers/') &&
    !request.path.startsWith('/batches/') &&
    !request.path.startsWith('/stock-movements/')
  ) {
    return null;
  }

  if (currentUser(request) === null) {
    return detailError(401, 'Authentication credentials were not provided.');
  }

  /* --------------------------------------------------------- suppliers */

  if (match(request, 'GET', '/suppliers/') !== null) {
    let rows = searchFilter(db.suppliers, request.params.get('search'), [
      'name',
      'contact_person',
      'phone',
    ]);
    const active = request.params.get('is_active');
    if (active !== null && active !== '') {
      rows = rows.filter((row) => String(row.is_active) === active);
    }
    return ok({ count: rows.length, next: null, previous: null, results: rows });
  }

  if (match(request, 'POST', '/suppliers/') !== null) {
    const payload = body(request);
    if (str(payload, 'name').trim() === '') {
      return validationError({ name: ['This field may not be blank.'] });
    }
    const supplier = {
      id: nextId('suppliers', db.suppliers),
      name: str(payload, 'name').trim(),
      contact_person: str(payload, 'contact_person'),
      phone: str(payload, 'phone'),
      email: str(payload, 'email') || null,
      address: str(payload, 'address'),
      is_active: true,
    };
    db.suppliers = [supplier, ...db.suppliers];
    return created(supplier);
  }

  /* ----------------------------------------------------- inventory items */

  if (match(request, 'GET', '/inventory/') !== null) {
    let rows: readonly InventoryItemDto[] = db.inventoryItems;

    const category = request.params.get('category');
    if (category !== null && category !== '') {
      rows = rows.filter((row) => row.category === category);
    }

    const supplier = request.params.get('supplier');
    if (supplier !== null && supplier !== '') {
      rows = rows.filter((row) => row.supplier === Number(supplier));
    }

    // Server-side stock filters, so paging stays correct: filtering client-side
    // would only ever narrow the current page.
    const stockFilter = request.params.get('stock_status');
    if (stockFilter === 'low') {
      rows = rows.filter(
        (row) => row.quantity_in_stock > 0 && row.quantity_in_stock <= row.reorder_level,
      );
    } else if (stockFilter === 'out') {
      rows = rows.filter((row) => row.quantity_in_stock <= 0);
    } else if (stockFilter === 'expiring') {
      const cutoffIso = isoDate(90);
      rows = rows.filter((row) => row.nearest_expiry !== null && row.nearest_expiry <= cutoffIso);
    }

    rows = searchFilter(rows, request.params.get('search'), ['name', 'code', 'supplier_name']);
    rows = orderBy(rows, request.params.get('ordering') ?? 'name');

    return ok(paginate(rows, request, DEFAULT_PAGE_SIZE));
  }

  /** Alerts endpoint: everything needing attention, unpaginated for the panel. */
  if (match(request, 'GET', '/inventory/alerts/') !== null) {
    const cutoffIso = isoDate(90);

    const rows = db.inventoryItems.filter(
      (row) =>
        row.quantity_in_stock <= row.reorder_level ||
        (row.nearest_expiry !== null && row.nearest_expiry <= cutoffIso),
    );
    return ok({ count: rows.length, next: null, previous: null, results: rows });
  }

  if (match(request, 'POST', '/inventory/') !== null) {
    const payload = body(request);
    const errors: Record<string, string[]> = {};

    const code = str(payload, 'code').trim();
    if (code === '') {
      errors['code'] = ['This field may not be blank.'];
    } else if (db.inventoryItems.some((row) => row.code === code)) {
      errors['code'] = ['An item with this code already exists.'];
    }
    if (str(payload, 'name').trim() === '') {
      errors['name'] = ['This field may not be blank.'];
    }
    const reorderLevel = num(payload, 'reorder_level');
    if (reorderLevel === null || reorderLevel < 0) {
      errors['reorder_level'] = ['Enter a number greater than or equal to 0.'];
    }
    const unitPrice = num(payload, 'unit_price');
    if (unitPrice === null || unitPrice < 0) {
      errors['unit_price'] = ['Enter a valid price.'];
    }
    if (Object.keys(errors).length > 0) {
      return validationError(errors);
    }

    const supplierId = num(payload, 'supplier');
    const supplier = db.suppliers.find((row) => row.id === supplierId);

    const item: InventoryItemDto = {
      id: nextId('inventory', db.inventoryItems),
      code,
      name: str(payload, 'name').trim(),
      category: str(payload, 'category') || 'consumable',
      unit: str(payload, 'unit') || 'pcs',
      quantity_in_stock: 0,
      reorder_level: reorderLevel!,
      unit_price: unitPrice!.toFixed(2),
      supplier: supplier?.id ?? null,
      supplier_name: supplier?.name ?? null,
      is_active: true,
      nearest_expiry: null,
    };
    db.inventoryItems = [item, ...db.inventoryItems];
    return created(item);
  }

  const detail = match(request, 'GET', '/inventory/:id/');
  if (detail !== null) {
    const row = db.inventoryItems.find((item) => item.id === Number(detail['id']));
    return row === undefined ? notFound('Item not found.') : ok(row);
  }

  const update = match(request, 'PATCH', '/inventory/:id/');
  if (update !== null) {
    const id = Number(update['id']);
    const index = db.inventoryItems.findIndex((row) => row.id === id);
    if (index < 0) {
      return notFound('Item not found.');
    }

    const payload = body(request);
    const code = str(payload, 'code').trim();
    if (code !== '' && db.inventoryItems.some((row) => row.code === code && row.id !== id)) {
      return validationError({ code: ['An item with this code already exists.'] });
    }

    const supplierId = num(payload, 'supplier');
    const supplier = db.suppliers.find((row) => row.id === supplierId);
    const existing = db.inventoryItems[index]!;

    db.inventoryItems[index] = {
      ...existing,
      code: code === '' ? existing.code : code,
      name: str(payload, 'name').trim() || existing.name,
      category: str(payload, 'category') || existing.category,
      unit: str(payload, 'unit') || existing.unit,
      reorder_level: num(payload, 'reorder_level') ?? existing.reorder_level,
      unit_price: num(payload, 'unit_price')?.toFixed(2) ?? existing.unit_price,
      supplier: supplier?.id ?? null,
      supplier_name: supplier?.name ?? null,
    };
    return ok(db.inventoryItems[index]);
  }

  /* ----------------------------------------------------------- batches */

  const itemBatches = match(request, 'GET', '/inventory/:id/batches/');
  if (itemBatches !== null) {
    const itemId = Number(itemBatches['id']);
    const rows = db.batches
      .filter((batch) => batch.item === itemId)
      .sort((a, b) => a.expiry_date.localeCompare(b.expiry_date));
    return ok({ count: rows.length, next: null, previous: null, results: rows });
  }

  /* ------------------------------------------------------ stock ledger */

  const itemLedger = match(request, 'GET', '/inventory/:id/movements/');
  if (itemLedger !== null) {
    const itemId = Number(itemLedger['id']);
    const rows = db.stockMovements
      .filter((movement) => movement.item === itemId)
      .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
    return ok(paginate(rows, request, DEFAULT_PAGE_SIZE));
  }

  if (match(request, 'GET', '/stock-movements/') !== null) {
    let rows: readonly StockMovementDto[] = db.stockMovements;
    const type = request.params.get('movement_type');
    if (type !== null && type !== '') {
      rows = rows.filter((row) => row.movement_type === type);
    }
    rows = searchFilter(rows, request.params.get('search'), ['item_name', 'reason']);
    rows = orderBy(rows, request.params.get('ordering') ?? '-occurred_at');
    return ok(paginate(rows, request, DEFAULT_PAGE_SIZE));
  }

  if (match(request, 'POST', '/stock-movements/') !== null) {
    const payload = body(request);
    const itemId = num(payload, 'item');
    const quantity = num(payload, 'quantity');
    const type = str(payload, 'movement_type');

    const errors: Record<string, string[]> = {};
    const item = db.inventoryItems.find((row) => row.id === itemId);
    if (item === undefined) {
      errors['item'] = ['Select a valid item.'];
    }
    if (quantity === null || quantity <= 0) {
      errors['quantity'] = ['Enter a quantity greater than 0.'];
    }
    if (!['stock_in', 'stock_out', 'adjustment', 'wastage'].includes(type)) {
      errors['movement_type'] = ['Select a valid movement type.'];
    }
    if (Object.keys(errors).length > 0) {
      return validationError(errors);
    }

    const isInbound = type === 'stock_in';
    // Stock cannot go negative — this is the rule the UI most needs enforced.
    if (!isInbound && type !== 'adjustment' && item!.quantity_in_stock < quantity!) {
      return validationError({
        quantity: [
          `Only ${item!.quantity_in_stock} ${item!.unit} in stock; cannot remove ${quantity}.`,
        ],
      });
    }

    let batchNumber = str(payload, 'batch_number') || null;

    if (isInbound) {
      const expiryDate = str(payload, 'expiry_date');
      if (expiryDate !== '') {
        // Expiring stock is tracked as a batch as well as in the total.
        const batch: BatchDto = {
          id: nextId('batches', db.batches),
          item: item!.id,
          item_name: item!.name,
          batch_number: batchNumber ?? `B${Date.now().toString().slice(-6)}`,
          quantity: quantity!,
          expiry_date: expiryDate,
          received_at: isoDateTime(0),
          supplier_name: item!.supplier_name,
        };
        db.batches = [batch, ...db.batches];
        batchNumber = batch.batch_number;
      }
    } else {
      // Draw down batches first-expiry-first-out; any shortfall comes from the
      // item's untracked stock, which the total already accounts for.
      const consumed = consumeFromBatches(item!.id, quantity!);
      batchNumber ??= consumed;
    }

    const delta = isInbound ? quantity! : -quantity!;
    const refreshed = applyStockDelta(item!.id, delta) ?? item!;

    const movement: StockMovementDto = {
      id: nextId('movements', db.stockMovements),
      item: item!.id,
      item_name: item!.name,
      batch_number: batchNumber,
      movement_type: type,
      quantity: quantity!,
      reason: str(payload, 'reason'),
      performed_by_name: currentUser(request)?.first_name ?? 'System',
      occurred_at: isoDateTime(0),
      balance_after: refreshed.quantity_in_stock,
    };

    db.stockMovements = [movement, ...db.stockMovements];
    return created(movement);
  }

  return null;
};
