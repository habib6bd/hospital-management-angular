export type ItemCategory = 'medicine' | 'consumable' | 'equipment';

export const ITEM_CATEGORY_LABELS: Readonly<Record<ItemCategory, string>> = {
  medicine: 'Medicine',
  consumable: 'Consumable',
  equipment: 'Equipment',
};

export type MovementType = 'stock_in' | 'stock_out' | 'adjustment' | 'wastage';

export const MOVEMENT_LABELS: Readonly<Record<MovementType, string>> = {
  stock_in: 'Stock in',
  stock_out: 'Stock out',
  adjustment: 'Adjustment',
  wastage: 'Wastage',
};

/** Movements that add to stock; the rest subtract. */
export const INBOUND_MOVEMENTS: readonly MovementType[] = ['stock_in'];

export interface Supplier {
  readonly id: number;
  readonly name: string;
  readonly contactPerson: string;
  readonly phone: string;
  readonly email: string | null;
  readonly address: string;
  readonly isActive: boolean;
}

export interface InventoryItem {
  readonly id: number;
  /** Internal SKU, e.g. `MED-0042`. */
  readonly code: string;
  readonly name: string;
  readonly category: ItemCategory;
  readonly unit: string;
  /** Sum across all non-expired batches. */
  readonly quantityInStock: number;
  readonly reorderLevel: number;
  readonly unitPrice: number;
  readonly supplierId: number | null;
  readonly supplierName: string | null;
  readonly isActive: boolean;
  /** Earliest expiry across batches with stock; null for items without batches. */
  readonly nearestExpiry: string | null;
}

export interface Batch {
  readonly id: number;
  readonly itemId: number;
  readonly itemName: string;
  readonly batchNumber: string;
  readonly quantity: number;
  readonly expiryDate: string;
  readonly receivedAt: string;
  readonly supplierName: string | null;
}

export interface StockMovement {
  readonly id: number;
  readonly itemId: number;
  readonly itemName: string;
  readonly batchNumber: string | null;
  readonly type: MovementType;
  /** Always positive; `type` carries the direction. */
  readonly quantity: number;
  readonly reason: string;
  readonly performedBy: string;
  readonly occurredAt: string;
  /** Stock level after this movement — makes the ledger auditable. */
  readonly balanceAfter: number;
}

/**
 * Derived stock health. Ordering matters: an expired item is the most urgent
 * signal even if quantity looks healthy.
 */
export type StockStatus = 'out_of_stock' | 'expired' | 'expiring_soon' | 'low_stock' | 'healthy';

export const STOCK_STATUS_LABELS: Readonly<Record<StockStatus, string>> = {
  out_of_stock: 'Out of stock',
  expired: 'Expired stock',
  expiring_soon: 'Expiring soon',
  low_stock: 'Low stock',
  healthy: 'In stock',
};

export function stockStatusTone(
  status: StockStatus,
): 'ready' | 'pending' | 'critical' | 'info' | 'neutral' {
  switch (status) {
    case 'out_of_stock':
    case 'expired':
      return 'critical';
    case 'expiring_soon':
    case 'low_stock':
      return 'pending';
    default:
      return 'ready';
  }
}

/** Days before expiry at which an item is flagged. */
export const EXPIRY_WARNING_DAYS = 90;

export function daysUntil(date: string, now = new Date()): number {
  const target = new Date(`${date}T00:00:00`);
  if (Number.isNaN(target.getTime())) {
    return Number.POSITIVE_INFINITY;
  }
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - startOfToday.getTime()) / 86_400_000);
}

/**
 * Single source of truth for stock health. The list, the alerts panel and the
 * dashboard widget all call this, so they can never disagree.
 */
export function stockStatus(item: InventoryItem, now = new Date()): StockStatus {
  if (item.quantityInStock <= 0) {
    return 'out_of_stock';
  }
  if (item.nearestExpiry !== null) {
    const days = daysUntil(item.nearestExpiry, now);
    if (days < 0) {
      return 'expired';
    }
    if (days <= EXPIRY_WARNING_DAYS) {
      return 'expiring_soon';
    }
  }
  return item.quantityInStock <= item.reorderLevel ? 'low_stock' : 'healthy';
}

export interface InventoryItemInput {
  readonly code: string;
  readonly name: string;
  readonly category: ItemCategory;
  readonly unit: string;
  readonly reorderLevel: string;
  readonly unitPrice: string;
  readonly supplierId: string;
}

export interface StockMovementInput {
  readonly itemId: number;
  readonly type: MovementType;
  readonly quantity: string;
  readonly batchNumber: string;
  readonly expiryDate: string;
  readonly reason: string;
}
