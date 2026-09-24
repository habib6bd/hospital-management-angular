import type {
  BatchDto,
  InventoryItemDto,
  StockMovementDto,
  SupplierDto,
} from '../../../shared/models/inventory.dto';
import { createRng, isoDate, isoDateTime, pick, randomInt } from '../mock-utils';

export const SUPPLIER_SEED: SupplierDto[] = [
  { id: 1, name: 'Square Pharmaceuticals', contact_person: 'Rashed Karim', phone: '01711000001', email: 'sales@square.example', address: 'Tejgaon, Dhaka', is_active: true },
  { id: 2, name: 'Beximco Pharma', contact_person: 'Nadia Sultana', phone: '01711000002', email: 'orders@beximco.example', address: 'Tongi, Gazipur', is_active: true },
  { id: 3, name: 'Incepta Pharmaceuticals', contact_person: 'Faisal Ahmed', phone: '01711000003', email: 'supply@incepta.example', address: 'Savar, Dhaka', is_active: true },
  { id: 4, name: 'MediEquip BD', contact_person: 'Tanzim Hasan', phone: '01711000004', email: 'info@mediequip.example', address: 'Motijheel, Dhaka', is_active: true },
  { id: 5, name: 'CareSupplies Ltd', contact_person: 'Lubna Akter', phone: '01711000005', email: null, address: 'Agrabad, Chattogram', is_active: false },
];

interface ItemTemplate {
  readonly name: string;
  readonly category: 'medicine' | 'consumable' | 'equipment';
  readonly unit: string;
  readonly price: number;
  /** Equipment and consumables generally carry no expiry. */
  readonly hasExpiry: boolean;
}

const ITEM_TEMPLATES: readonly ItemTemplate[] = [
  { name: 'Paracetamol 500mg', category: 'medicine', unit: 'tablet', price: 1.2, hasExpiry: true },
  { name: 'Amoxicillin 250mg', category: 'medicine', unit: 'capsule', price: 4.5, hasExpiry: true },
  { name: 'Metformin 500mg', category: 'medicine', unit: 'tablet', price: 2.1, hasExpiry: true },
  { name: 'Amlodipine 5mg', category: 'medicine', unit: 'tablet', price: 3.0, hasExpiry: true },
  { name: 'Omeprazole 20mg', category: 'medicine', unit: 'capsule', price: 5.5, hasExpiry: true },
  { name: 'Salbutamol Inhaler', category: 'medicine', unit: 'unit', price: 320, hasExpiry: true },
  { name: 'Ceftriaxone 1g Injection', category: 'medicine', unit: 'vial', price: 180, hasExpiry: true },
  { name: 'Insulin Glargine', category: 'medicine', unit: 'pen', price: 850, hasExpiry: true },
  { name: 'Normal Saline 500ml', category: 'medicine', unit: 'bag', price: 95, hasExpiry: true },
  { name: 'Diclofenac 50mg', category: 'medicine', unit: 'tablet', price: 2.8, hasExpiry: true },
  { name: 'Ibuprofen 400mg', category: 'medicine', unit: 'tablet', price: 2.4, hasExpiry: true },
  { name: 'Ranitidine 150mg', category: 'medicine', unit: 'tablet', price: 1.9, hasExpiry: true },
  { name: 'Azithromycin 500mg', category: 'medicine', unit: 'tablet', price: 22, hasExpiry: true },
  { name: 'Hydrocortisone Cream', category: 'medicine', unit: 'tube', price: 140, hasExpiry: true },
  { name: 'ORS Sachet', category: 'medicine', unit: 'sachet', price: 8, hasExpiry: true },
  { name: 'Heparin 5000IU', category: 'medicine', unit: 'vial', price: 260, hasExpiry: true },

  { name: 'Disposable Syringe 5ml', category: 'consumable', unit: 'pcs', price: 6, hasExpiry: true },
  { name: 'Surgical Gloves (M)', category: 'consumable', unit: 'pair', price: 12, hasExpiry: true },
  { name: 'Surgical Gloves (L)', category: 'consumable', unit: 'pair', price: 12, hasExpiry: true },
  { name: 'Face Mask 3-ply', category: 'consumable', unit: 'pcs', price: 3, hasExpiry: false },
  { name: 'N95 Respirator', category: 'consumable', unit: 'pcs', price: 45, hasExpiry: false },
  { name: 'Gauze Bandage 10cm', category: 'consumable', unit: 'roll', price: 18, hasExpiry: false },
  { name: 'Adhesive Plaster', category: 'consumable', unit: 'roll', price: 25, hasExpiry: false },
  { name: 'IV Cannula 20G', category: 'consumable', unit: 'pcs', price: 32, hasExpiry: true },
  { name: 'Urinary Catheter', category: 'consumable', unit: 'pcs', price: 110, hasExpiry: true },
  { name: 'Cotton Roll 500g', category: 'consumable', unit: 'roll', price: 180, hasExpiry: false },
  { name: 'Alcohol Swab', category: 'consumable', unit: 'pcs', price: 2, hasExpiry: true },
  { name: 'Surgical Blade No.15', category: 'consumable', unit: 'pcs', price: 15, hasExpiry: false },
  { name: 'Examination Gown', category: 'consumable', unit: 'pcs', price: 55, hasExpiry: false },
  { name: 'Blood Collection Tube (EDTA)', category: 'consumable', unit: 'pcs', price: 9, hasExpiry: true },

  { name: 'Digital Thermometer', category: 'equipment', unit: 'unit', price: 450, hasExpiry: false },
  { name: 'Pulse Oximeter', category: 'equipment', unit: 'unit', price: 1800, hasExpiry: false },
  { name: 'BP Monitor (Digital)', category: 'equipment', unit: 'unit', price: 3200, hasExpiry: false },
  { name: 'Nebuliser Machine', category: 'equipment', unit: 'unit', price: 4500, hasExpiry: false },
  { name: 'Stethoscope', category: 'equipment', unit: 'unit', price: 2200, hasExpiry: false },
  { name: 'Infusion Pump', category: 'equipment', unit: 'unit', price: 42000, hasExpiry: false },
  { name: 'Wheelchair', category: 'equipment', unit: 'unit', price: 12500, hasExpiry: false },
  { name: 'ECG Electrodes', category: 'equipment', unit: 'pack', price: 380, hasExpiry: true },
  { name: 'Oxygen Cylinder (D)', category: 'equipment', unit: 'unit', price: 8500, hasExpiry: false },
  { name: 'Suction Machine', category: 'equipment', unit: 'unit', price: 15000, hasExpiry: false },
];

const CATEGORY_PREFIX: Readonly<Record<string, string>> = {
  medicine: 'MED',
  consumable: 'CON',
  equipment: 'EQP',
};

interface InventorySeedResult {
  suppliers: SupplierDto[];
  items: InventoryItemDto[];
  batches: BatchDto[];
  movements: StockMovementDto[];
}

export function buildInventorySeed(): InventorySeedResult {
  const rng = createRng(50413377);
  const items: InventoryItemDto[] = [];
  const batches: BatchDto[] = [];
  const movements: StockMovementDto[] = [];

  let batchId = 1;
  let movementId = 1;
  const perCategoryCount = new Map<string, number>();

  ITEM_TEMPLATES.forEach((template, index) => {
    const id = index + 1;
    const sequence = (perCategoryCount.get(template.category) ?? 0) + 1;
    perCategoryCount.set(template.category, sequence);

    const reorderLevel =
      template.category === 'equipment' ? randomInt(rng, 2, 5) : randomInt(rng, 40, 120);

    // Deliberate spread so the alert panels have something to show:
    // ~10% out of stock, ~20% below reorder level, the rest healthy.
    const roll = rng();
    const quantity =
      roll < 0.1
        ? 0
        : roll < 0.3
          ? randomInt(rng, 1, reorderLevel)
          : randomInt(rng, reorderLevel + 1, reorderLevel * 6);

    const supplier = pick(rng, SUPPLIER_SEED.filter((row) => row.is_active));

    let nearestExpiry: string | null = null;

    if (quantity > 0 && template.hasExpiry) {
      // One to three batches, occasionally including an expired or near-expiry one.
      const batchCount = randomInt(rng, 1, 3);
      let remaining = quantity;

      for (let n = 0; n < batchCount; n++) {
        const isLast = n === batchCount - 1;
        const batchQuantity = isLast
          ? remaining
          : Math.max(1, Math.floor(remaining / (batchCount - n)));
        remaining -= batchQuantity;
        if (batchQuantity <= 0) {
          continue;
        }

        const expiryRoll = rng();
        const expiryDate =
          expiryRoll < 0.08
            ? isoDate(-randomInt(rng, 1, 60)) // already expired
            : expiryRoll < 0.28
              ? isoDate(randomInt(rng, 5, 85)) // expiring soon
              : isoDate(randomInt(rng, 180, 900));

        batches.push({
          id: batchId++,
          item: id,
          item_name: template.name,
          batch_number: `B${String(batchId).padStart(4, '0')}-${expiryDate.slice(2, 4)}${expiryDate.slice(5, 7)}`,
          quantity: batchQuantity,
          expiry_date: expiryDate,
          received_at: isoDateTime(-randomInt(rng, 5, 300) * 24 * 60),
          supplier_name: supplier.name,
        });

        if (nearestExpiry === null || expiryDate < nearestExpiry) {
          nearestExpiry = expiryDate;
        }
      }
    }

    items.push({
      id,
      code: `${CATEGORY_PREFIX[template.category]}-${String(sequence).padStart(4, '0')}`,
      name: template.name,
      category: template.category,
      unit: template.unit,
      quantity_in_stock: quantity,
      reorder_level: reorderLevel,
      unit_price: template.price.toFixed(2),
      supplier: supplier.id,
      supplier_name: supplier.name,
      is_active: true,
      nearest_expiry: nearestExpiry,
    });

    // A short ledger history per item, ending at the current balance.
    const movementCount = randomInt(rng, 2, 5);
    let balance = quantity;
    for (let n = 0; n < movementCount; n++) {
      const type = pick(rng, ['stock_in', 'stock_out', 'stock_out', 'adjustment', 'wastage']);
      const amount = randomInt(rng, 1, Math.max(2, Math.floor(reorderLevel / 2)));
      movements.push({
        id: movementId++,
        item: id,
        item_name: template.name,
        batch_number: null,
        movement_type: type,
        quantity: amount,
        reason: MOVEMENT_REASONS[type]!,
        performed_by_name: pick(rng, ['Farhana Akter', 'Nusrat Jahan', 'Ayesha Rahman']),
        occurred_at: isoDateTime(-(n + 1) * randomInt(rng, 12, 96) * 60),
        balance_after: balance,
      });
      // Walking backwards through history keeps balances self-consistent.
      balance = type === 'stock_in' ? balance - amount : balance + amount;
    }
  });

  return { suppliers: SUPPLIER_SEED, items, batches, movements };
}

const MOVEMENT_REASONS: Readonly<Record<string, string>> = {
  stock_in: 'Purchase order received',
  stock_out: 'Dispensed to ward',
  adjustment: 'Stock count correction',
  wastage: 'Damaged in storage',
};
