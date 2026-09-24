import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { HttpClient, httpResource } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { APP_CONFIG } from '../../core/config/app-config';
import { authContext } from '../../core/http/http-context';
import { mapPage, toQueryParams, type Page, type PaginatedDto } from '../../core/http/paginated';
import {
  toInvoice,
  toInvoiceWriteDto,
  toPaymentWriteDto,
  type InvoiceDto,
} from '../../shared/models/billing.dto';
import { toDownloadTicket, type DownloadTicketDto } from '../../shared/models/lab.dto';
import type {
  ChargeSource,
  Invoice,
  InvoiceInput,
  PaymentInput,
  PaymentStatus,
} from '../../shared/models/billing.model';
import type { DownloadTicket } from '../../shared/models/lab.model';

export interface InvoiceListQuery {
  readonly page: number;
  readonly pageSize: number;
  readonly search: string;
  readonly status: PaymentStatus | '';
  readonly overdue: boolean;
  readonly patientId: number | '';
  readonly ordering: string;
}

/** Revenue figures for the billing page and the dashboard widget. */
export interface RevenueSummary {
  readonly totalBilled: number;
  readonly totalCollected: number;
  readonly totalOutstanding: number;
  readonly overdueCount: number;
  readonly bySource: readonly { source: ChargeSource; amount: number }[];
}

interface RevenueSummaryDto {
  readonly total_billed: string;
  readonly total_collected: string;
  readonly total_outstanding: string;
  readonly overdue_count: number;
  readonly by_source: readonly { source: string; amount: string }[];
}

function toInvoiceParams(query: InvoiceListQuery): Record<string, string> {
  return toQueryParams({
    page: query.page,
    page_size: query.pageSize,
    search: query.search,
    status: query.status,
    overdue: query.overdue ? 'true' : '',
    patient: query.patientId,
    ordering: query.ordering,
  });
}

@Injectable({ providedIn: 'root' })
export class BillingService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(APP_CONFIG);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly baseUrl = `${this.config.apiBaseUrl}/invoices`;

  private readonly queryState = signal<InvoiceListQuery>({
    page: 1,
    pageSize: this.config.pageSize,
    search: '',
    status: '',
    overdue: false,
    patientId: '',
    ordering: '-issued_at',
  });

  readonly query = this.queryState.asReadonly();

  private readonly listResource = httpResource<PaginatedDto<InvoiceDto>>(() => ({
    url: `${this.baseUrl}/`,
    params: toInvoiceParams(this.queryState()),
  }));

  readonly invoices = computed<Page<Invoice> | undefined>(() => {
    const value = this.listResource.value();
    if (value === undefined) {
      return undefined;
    }
    const { page, pageSize } = this.queryState();
    return mapPage(value, toInvoice, page, pageSize);
  });

  readonly isLoading = this.listResource.isLoading;

  /**
   * Revenue totals come from a dedicated endpoint rather than being summed on
   * the client: the current page is only ever 20 rows, so any figure derived
   * from it would understate the true total.
   */
  private readonly summaryResource = httpResource<RevenueSummaryDto>(
    () => `${this.baseUrl}/summary/`,
  );

  readonly summary = computed<RevenueSummary | undefined>(() => {
    const value = this.summaryResource.value();
    if (value === undefined) {
      return undefined;
    }
    return {
      totalBilled: Number.parseFloat(value.total_billed),
      totalCollected: Number.parseFloat(value.total_collected),
      totalOutstanding: Number.parseFloat(value.total_outstanding),
      overdueCount: value.overdue_count,
      bySource: value.by_source.map((entry) => ({
        source: entry.source as ChargeSource,
        amount: Number.parseFloat(entry.amount),
      })),
    };
  });

  readonly isSummaryLoading = this.summaryResource.isLoading;

  readonly collectionRate = computed(() => {
    const current = this.summary();
    if (current === undefined || current.totalBilled === 0) {
      return 0;
    }
    return current.totalCollected / current.totalBilled;
  });

  /* -------------------------------------------------------------- detail */

  private readonly selectedId = signal<number | null>(null);

  private readonly detailResource = httpResource<InvoiceDto>(() => {
    const id = this.selectedId();
    return id === null ? undefined : { url: `${this.baseUrl}/${id}/` };
  });

  readonly selectedInvoice = computed<Invoice | undefined>(() => {
    const value = this.detailResource.value();
    return value === undefined ? undefined : toInvoice(value);
  });

  readonly isDetailLoading = this.detailResource.isLoading;

  select(id: number | null): void {
    this.selectedId.set(id);
  }

  patchQuery(changes: Partial<InvoiceListQuery>): void {
    this.queryState.update((current) => ({ ...current, ...changes, page: changes.page ?? 1 }));
  }

  setPage(page: number): void {
    this.queryState.update((current) => ({ ...current, page }));
  }

  resetQuery(): void {
    this.queryState.update((current) => ({
      ...current,
      page: 1,
      search: '',
      status: '',
      overdue: false,
      patientId: '',
    }));
  }

  /* -------------------------------------------------------------- writes */

  async create(input: InvoiceInput): Promise<Invoice> {
    const dto = await firstValueFrom(
      this.http.post<InvoiceDto>(`${this.baseUrl}/`, toInvoiceWriteDto(input)),
    );
    this.reloadAll();
    return toInvoice(dto);
  }

  async recordPayment(invoiceId: number, input: PaymentInput): Promise<Invoice> {
    const dto = await firstValueFrom(
      this.http.post<InvoiceDto>(
        `${this.baseUrl}/${invoiceId}/payments/`,
        toPaymentWriteDto(input),
      ),
    );
    this.reloadAll();
    return toInvoice(dto);
  }

  async cancel(invoiceId: number): Promise<Invoice> {
    const dto = await firstValueFrom(
      this.http.post<InvoiceDto>(`${this.baseUrl}/${invoiceId}/cancel/`, {}),
    );
    this.reloadAll();
    return toInvoice(dto);
  }

  async requestPdf(invoiceId: number): Promise<DownloadTicket> {
    const dto = await firstValueFrom(
      this.http.get<DownloadTicketDto>(`${this.baseUrl}/${invoiceId}/download-url/`, {
        context: authContext({ skipErrorToast: true }),
      }),
    );
    return toDownloadTicket(dto);
  }

  async downloadPdf(invoice: Invoice): Promise<void> {
    const ticket = await this.requestPdf(invoice.id);
    if (!this.isBrowser) {
      return;
    }
    const link = document.createElement('a');
    link.href = ticket.url;
    link.download = ticket.filename;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  private reloadAll(): void {
    this.listResource.reload();
    this.summaryResource.reload();
    if (this.selectedId() !== null) {
      this.detailResource.reload();
    }
  }
}
