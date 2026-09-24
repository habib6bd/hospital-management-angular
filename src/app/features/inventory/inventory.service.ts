import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, httpResource } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { APP_CONFIG } from '../../core/config/app-config';
import { mapPage, toQueryParams, type Page, type PaginatedDto } from '../../core/http/paginated';
import {
  toBatch,
  toInventoryItem,
  toInventoryItemWriteDto,
  toStockMovement,
  toStockMovementWriteDto,
  toSupplier,
  type BatchDto,
  type InventoryItemDto,
  type StockMovementDto,
  type SupplierDto,
} from '../../shared/models/inventory.dto';
import {
  EXPIRY_WARNING_DAYS,
  daysUntil,
  stockStatus,
  type Batch,
  type InventoryItem,
  type InventoryItemInput,
  type ItemCategory,
  type StockMovement,
  type StockMovementInput,
  type Supplier,
} from '../../shared/models/inventory.model';

export type StockFilter = '' | 'low' | 'out' | 'expiring';

export interface InventoryListQuery {
  readonly page: number;
  readonly pageSize: number;
  readonly search: string;
  readonly category: ItemCategory | '';
  readonly supplierId: number | '';
  readonly stock: StockFilter;
  readonly ordering: string;
}

function toInventoryParams(query: InventoryListQuery): Record<string, string> {
  return toQueryParams({
    page: query.page,
    page_size: query.pageSize,
    search: query.search,
    category: query.category,
    supplier: query.supplierId,
    stock_status: query.stock,
    ordering: query.ordering,
  });
}

@Injectable({ providedIn: 'root' })
export class InventoryService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(APP_CONFIG);
  private readonly baseUrl = `${this.config.apiBaseUrl}/inventory`;

  private readonly queryState = signal<InventoryListQuery>({
    page: 1,
    pageSize: this.config.pageSize,
    search: '',
    category: '',
    supplierId: '',
    stock: '',
    ordering: 'name',
  });

  readonly query = this.queryState.asReadonly();

  private readonly listResource = httpResource<PaginatedDto<InventoryItemDto>>(() => ({
    url: `${this.baseUrl}/`,
    params: toInventoryParams(this.queryState()),
  }));

  readonly items = computed<Page<InventoryItem> | undefined>(() => {
    const value = this.listResource.value();
    if (value === undefined) {
      return undefined;
    }
    const { page, pageSize } = this.queryState();
    return mapPage(value, toInventoryItem, page, pageSize);
  });

  readonly isLoading = this.listResource.isLoading;

  /**
   * Everything needing attention, fetched separately from the paged list.
   *
   * This must come from its own endpoint: deriving alerts from the current page
   * would report only what happens to be visible, so a low-stock item on page 3
   * would never raise an alert.
   */
  private readonly alertsResource = httpResource<PaginatedDto<InventoryItemDto>>(
    () => `${this.baseUrl}/alerts/`,
  );

  private readonly alertItems = computed<readonly InventoryItem[]>(
    () => this.alertsResource.value()?.results.map(toInventoryItem) ?? [],
  );

  readonly isAlertsLoading = this.alertsResource.isLoading;

  /**
   * Derived once here and reused by the alerts panel and the dashboard widget,
   * so the two can never disagree about what counts as low stock.
   */
  readonly outOfStock = computed(() =>
    this.alertItems().filter((item) => stockStatus(item) === 'out_of_stock'),
  );

  readonly lowStock = computed(() =>
    this.alertItems().filter((item) => stockStatus(item) === 'low_stock'),
  );

  readonly expired = computed(() =>
    this.alertItems().filter((item) => stockStatus(item) === 'expired'),
  );

  readonly expiringSoon = computed(() =>
    this.alertItems()
      .filter((item) => stockStatus(item) === 'expiring_soon')
      .sort((a, b) => (a.nearestExpiry ?? '').localeCompare(b.nearestExpiry ?? '')),
  );

  readonly alertCount = computed(
    () =>
      this.outOfStock().length +
      this.lowStock().length +
      this.expired().length +
      this.expiringSoon().length,
  );

  /** Total value of held stock, for the dashboard's inventory tile. */
  readonly stockValue = computed(() =>
    this.alertItems().reduce((sum, item) => sum + item.quantityInStock * item.unitPrice, 0),
  );

  readonly expiryWarningDays = EXPIRY_WARNING_DAYS;

  daysToExpiry(item: InventoryItem): number | null {
    return item.nearestExpiry === null ? null : daysUntil(item.nearestExpiry);
  }

  /* -------------------------------------------------------------- detail */

  private readonly selectedId = signal<number | null>(null);

  private readonly detailResource = httpResource<InventoryItemDto>(() => {
    const id = this.selectedId();
    return id === null ? undefined : { url: `${this.baseUrl}/${id}/` };
  });

  readonly selectedItem = computed<InventoryItem | undefined>(() => {
    const value = this.detailResource.value();
    return value === undefined ? undefined : toInventoryItem(value);
  });

  readonly isDetailLoading = this.detailResource.isLoading;

  private readonly batchesResource = httpResource<PaginatedDto<BatchDto>>(() => {
    const id = this.selectedId();
    return id === null ? undefined : { url: `${this.baseUrl}/${id}/batches/` };
  });

  readonly batches = computed<readonly Batch[]>(
    () => this.batchesResource.value()?.results.map(toBatch) ?? [],
  );

  readonly isBatchesLoading = this.batchesResource.isLoading;

  private readonly ledgerResource = httpResource<PaginatedDto<StockMovementDto>>(() => {
    const id = this.selectedId();
    return id === null ? undefined : { url: `${this.baseUrl}/${id}/movements/` };
  });

  readonly ledger = computed<readonly StockMovement[]>(
    () => this.ledgerResource.value()?.results.map(toStockMovement) ?? [],
  );

  readonly isLedgerLoading = this.ledgerResource.isLoading;

  select(id: number | null): void {
    this.selectedId.set(id);
  }

  patchQuery(changes: Partial<InventoryListQuery>): void {
    this.queryState.update((current) => ({ ...current, ...changes, page: changes.page ?? 1 }));
  }

  setPage(page: number): void {
    this.queryState.update((current) => ({ ...current, page }));
  }

  resetQuery(): void {
    this.queryState.set({
      page: 1,
      pageSize: this.config.pageSize,
      search: '',
      category: '',
      supplierId: '',
      stock: '',
      ordering: 'name',
    });
  }

  /* -------------------------------------------------------------- writes */

  async create(input: InventoryItemInput): Promise<InventoryItem> {
    const dto = await firstValueFrom(
      this.http.post<InventoryItemDto>(`${this.baseUrl}/`, toInventoryItemWriteDto(input)),
    );
    this.reloadAll();
    return toInventoryItem(dto);
  }

  async update(id: number, input: InventoryItemInput): Promise<InventoryItem> {
    const dto = await firstValueFrom(
      this.http.patch<InventoryItemDto>(`${this.baseUrl}/${id}/`, toInventoryItemWriteDto(input)),
    );
    this.reloadAll();
    return toInventoryItem(dto);
  }

  async recordMovement(input: StockMovementInput): Promise<StockMovement> {
    const dto = await firstValueFrom(
      this.http.post<StockMovementDto>(
        `${this.config.apiBaseUrl}/stock-movements/`,
        toStockMovementWriteDto(input),
      ),
    );
    // A movement changes quantity, batches and the ledger all at once.
    this.reloadAll();
    this.batchesResource.reload();
    this.ledgerResource.reload();
    return toStockMovement(dto);
  }

  private reloadAll(): void {
    this.listResource.reload();
    this.alertsResource.reload();
    if (this.selectedId() !== null) {
      this.detailResource.reload();
    }
  }
}

@Injectable({ providedIn: 'root' })
export class SupplierService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(APP_CONFIG);
  private readonly baseUrl = `${this.config.apiBaseUrl}/suppliers`;

  private readonly suppliersResource = httpResource<PaginatedDto<SupplierDto>>(
    () => `${this.baseUrl}/`,
  );

  readonly suppliers = computed<readonly Supplier[]>(
    () => this.suppliersResource.value()?.results.map(toSupplier) ?? [],
  );

  readonly activeSuppliers = computed(() =>
    this.suppliers().filter((supplier) => supplier.isActive),
  );

  readonly isLoading = this.suppliersResource.isLoading;

  async create(input: {
    name: string;
    contactPerson: string;
    phone: string;
    email: string;
    address: string;
  }): Promise<Supplier> {
    const dto = await firstValueFrom(
      this.http.post<SupplierDto>(`${this.baseUrl}/`, {
        name: input.name,
        contact_person: input.contactPerson,
        phone: input.phone,
        email: input.email === '' ? null : input.email,
        address: input.address,
      }),
    );
    this.suppliersResource.reload();
    return toSupplier(dto);
  }
}
