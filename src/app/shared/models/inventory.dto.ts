import type {
  Batch,
  InventoryItem,
  InventoryItemInput,
  ItemCategory,
  MovementType,
  StockMovement,
  StockMovementInput,
  Supplier,
} from './inventory.model';

export interface SupplierDto {
  readonly id: number;
  readonly name: string;
  readonly contact_person: string;
  readonly phone: string;
  readonly email: string | null;
  readonly address: string;
  readonly is_active: boolean;
}

export interface InventoryItemDto {
  readonly id: number;
  readonly code: string;
  readonly name: string;
  readonly category: string;
  readonly unit: string;
  readonly quantity_in_stock: number;
  readonly reorder_level: number;
  readonly unit_price: string;
  readonly supplier: number | null;
  readonly supplier_name: string | null;
  readonly is_active: boolean;
  readonly nearest_expiry: string | null;
}

export interface BatchDto {
  readonly id: number;
  readonly item: number;
  readonly item_name: string;
  readonly batch_number: string;
  readonly quantity: number;
  readonly expiry_date: string;
  readonly received_at: string;
  readonly supplier_name: string | null;
}

export interface StockMovementDto {
  readonly id: number;
  readonly item: number;
  readonly item_name: string;
  readonly batch_number: string | null;
  readonly movement_type: string;
  readonly quantity: number;
  readonly reason: string;
  readonly performed_by_name: string;
  readonly occurred_at: string;
  readonly balance_after: number;
}

function toCategory(value: string): ItemCategory {
  return value === 'medicine' || value === 'consumable' || value === 'equipment'
    ? value
    : 'consumable';
}

function toMovementType(value: string): MovementType {
  switch (value) {
    case 'stock_in':
    case 'stock_out':
    case 'wastage':
      return value;
    default:
      return 'adjustment';
  }
}

export function toSupplier(dto: SupplierDto): Supplier {
  return {
    id: dto.id,
    name: dto.name,
    contactPerson: dto.contact_person,
    phone: dto.phone,
    email: dto.email,
    address: dto.address,
    isActive: dto.is_active,
  };
}

export function toInventoryItem(dto: InventoryItemDto): InventoryItem {
  return {
    id: dto.id,
    code: dto.code,
    name: dto.name,
    category: toCategory(dto.category),
    unit: dto.unit,
    quantityInStock: dto.quantity_in_stock,
    reorderLevel: dto.reorder_level,
    unitPrice: Number.parseFloat(dto.unit_price),
    supplierId: dto.supplier,
    supplierName: dto.supplier_name,
    isActive: dto.is_active,
    nearestExpiry: dto.nearest_expiry,
  };
}

export function toBatch(dto: BatchDto): Batch {
  return {
    id: dto.id,
    itemId: dto.item,
    itemName: dto.item_name,
    batchNumber: dto.batch_number,
    quantity: dto.quantity,
    expiryDate: dto.expiry_date,
    receivedAt: dto.received_at,
    supplierName: dto.supplier_name,
  };
}

export function toStockMovement(dto: StockMovementDto): StockMovement {
  return {
    id: dto.id,
    itemId: dto.item,
    itemName: dto.item_name,
    batchNumber: dto.batch_number,
    type: toMovementType(dto.movement_type),
    quantity: dto.quantity,
    reason: dto.reason,
    performedBy: dto.performed_by_name,
    occurredAt: dto.occurred_at,
    balanceAfter: dto.balance_after,
  };
}

export function toInventoryItemWriteDto(input: InventoryItemInput): Record<string, unknown> {
  return {
    code: input.code.trim().toUpperCase(),
    name: input.name.trim(),
    category: input.category,
    unit: input.unit.trim(),
    reorder_level: Number(input.reorderLevel),
    // Sent as a string: Django's DecimalField rejects float artefacts.
    unit_price: Number(input.unitPrice).toFixed(2),
    supplier: input.supplierId === '' ? null : Number(input.supplierId),
  };
}

export function toStockMovementWriteDto(input: StockMovementInput): Record<string, unknown> {
  return {
    item: input.itemId,
    movement_type: input.type,
    quantity: Number(input.quantity),
    batch_number: input.batchNumber.trim() === '' ? null : input.batchNumber.trim(),
    expiry_date: input.expiryDate === '' ? null : input.expiryDate,
    reason: input.reason.trim(),
  };
}

export function emptyItemInput(): InventoryItemInput {
  return {
    code: '',
    name: '',
    category: 'medicine',
    unit: 'pcs',
    reorderLevel: '10',
    unitPrice: '0',
    supplierId: '',
  };
}

export function toItemInput(item: InventoryItem): InventoryItemInput {
  return {
    code: item.code,
    name: item.name,
    category: item.category,
    unit: item.unit,
    reorderLevel: String(item.reorderLevel),
    unitPrice: item.unitPrice.toFixed(2),
    supplierId: item.supplierId === null ? '' : String(item.supplierId),
  };
}
