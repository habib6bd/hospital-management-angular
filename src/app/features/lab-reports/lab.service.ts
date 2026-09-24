import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, httpResource } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { APP_CONFIG } from '../../core/config/app-config';
import { mapPage, toQueryParams, type Page, type PaginatedDto } from '../../core/http/paginated';
import {
  toLabOrder,
  toLabOrderWriteDto,
  toLabTest,
  toResultsWriteDto,
  type LabOrderDto,
  type LabTestDto,
} from '../../shared/models/lab.dto';
import type {
  LabOrder,
  LabOrderInput,
  LabOrderStatus,
  LabTest,
  ResultEntryInput,
} from '../../shared/models/lab.model';

export type LabOrderAction = 'collect-sample' | 'start' | 'cancel';

export interface LabOrderListQuery {
  readonly page: number;
  readonly pageSize: number;
  readonly search: string;
  readonly status: LabOrderStatus | '';
  readonly priority: 'routine' | 'urgent' | '';
  readonly ordering: string;
}

function toLabParams(query: LabOrderListQuery): Record<string, string> {
  return toQueryParams({
    page: query.page,
    page_size: query.pageSize,
    search: query.search,
    status: query.status,
    priority: query.priority,
    ordering: query.ordering,
  });
}

@Injectable({ providedIn: 'root' })
export class LabService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(APP_CONFIG);
  private readonly baseUrl = `${this.config.apiBaseUrl}/lab-orders`;

  private readonly queryState = signal<LabOrderListQuery>({
    page: 1,
    pageSize: this.config.pageSize,
    search: '',
    status: '',
    priority: '',
    ordering: '-ordered_at',
  });

  readonly query = this.queryState.asReadonly();

  private readonly listResource = httpResource<PaginatedDto<LabOrderDto>>(() => ({
    url: `${this.baseUrl}/`,
    params: toLabParams(this.queryState()),
  }));

  readonly orders = computed<Page<LabOrder> | undefined>(() => {
    const value = this.listResource.value();
    if (value === undefined) {
      return undefined;
    }
    const { page, pageSize } = this.queryState();
    return mapPage(value, toLabOrder, page, pageSize);
  });

  readonly isLoading = this.listResource.isLoading;

  /** Work queue counts, for the lab technician's board. */
  private readonly pendingResource = httpResource<PaginatedDto<LabOrderDto>>(() => ({
    url: `${this.baseUrl}/`,
    params: toQueryParams({
      status__in: 'ordered,sample_collected,in_progress',
      page_size: 200,
      ordering: 'ordered_at',
    }),
  }));

  private readonly pendingOrders = computed<readonly LabOrder[]>(
    () => this.pendingResource.value()?.results.map(toLabOrder) ?? [],
  );

  readonly awaitingSample = computed(() =>
    this.pendingOrders().filter((order) => order.status === 'ordered'),
  );
  readonly awaitingAnalysis = computed(() =>
    this.pendingOrders().filter((order) => order.status === 'sample_collected'),
  );
  readonly inProgress = computed(() =>
    this.pendingOrders().filter((order) => order.status === 'in_progress'),
  );
  readonly urgentPending = computed(() =>
    this.pendingOrders().filter((order) => order.priority === 'urgent'),
  );
  readonly pendingCount = computed(() => this.pendingOrders().length);
  readonly isPendingLoading = this.pendingResource.isLoading;

  private readonly testsResource = httpResource<PaginatedDto<LabTestDto>>(
    () => `${this.config.apiBaseUrl}/lab-tests/`,
  );

  readonly tests = computed<readonly LabTest[]>(
    () => this.testsResource.value()?.results.map(toLabTest) ?? [],
  );
  readonly isTestsLoading = this.testsResource.isLoading;

  /* -------------------------------------------------------------- detail */

  private readonly selectedId = signal<number | null>(null);

  private readonly detailResource = httpResource<LabOrderDto>(() => {
    const id = this.selectedId();
    return id === null ? undefined : { url: `${this.baseUrl}/${id}/` };
  });

  readonly selectedOrder = computed<LabOrder | undefined>(() => {
    const value = this.detailResource.value();
    return value === undefined ? undefined : toLabOrder(value);
  });

  readonly isDetailLoading = this.detailResource.isLoading;

  select(id: number | null): void {
    this.selectedId.set(id);
  }

  patchQuery(changes: Partial<LabOrderListQuery>): void {
    this.queryState.update((current) => ({ ...current, ...changes, page: changes.page ?? 1 }));
  }

  setPage(page: number): void {
    this.queryState.update((current) => ({ ...current, page }));
  }

  /* -------------------------------------------------------------- writes */

  async order(input: LabOrderInput): Promise<LabOrder> {
    const dto = await firstValueFrom(
      this.http.post<LabOrderDto>(`${this.baseUrl}/`, toLabOrderWriteDto(input)),
    );
    this.reloadAll();
    return toLabOrder(dto);
  }

  async transition(id: number, action: LabOrderAction): Promise<LabOrder> {
    const dto = await firstValueFrom(
      this.http.post<LabOrderDto>(`${this.baseUrl}/${id}/${action}/`, {}),
    );
    this.reloadAll();
    return toLabOrder(dto);
  }

  /** Entering results completes the order and issues the patient's report. */
  async enterResults(id: number, entries: readonly ResultEntryInput[]): Promise<LabOrder> {
    const dto = await firstValueFrom(
      this.http.post<LabOrderDto>(`${this.baseUrl}/${id}/results/`, toResultsWriteDto(entries)),
    );
    this.reloadAll();
    return toLabOrder(dto);
  }

  private reloadAll(): void {
    this.listResource.reload();
    this.pendingResource.reload();
    if (this.selectedId() !== null) {
      this.detailResource.reload();
    }
  }
}
