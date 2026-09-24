import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { PatientPortalFacade } from './patient-portal.facade';
import { ToastService } from '../../core/services/toast.service';
import { toApiError } from '../../core/http/api-error';
import { CardComponent } from '../../shared/ui/card/card.component';
import { PageHeaderComponent } from '../../shared/ui/page-header/page-header.component';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { BadgeComponent } from '../../shared/ui/badge/badge.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { PaginationComponent } from '../../shared/ui/pagination/pagination.component';
import { ReportViewerComponent } from './report-viewer.component';
import { HmsDatePipe } from '../../shared/pipes/hms-pipes';
import {
  REPORT_KIND_LABELS,
  REPORT_STATUS_LABELS,
  formatBytes,
  reportTone,
  type ReportDocument,
  type ReportKind,
  type ReportStatus,
} from '../../shared/models/lab.model';

@Component({
  selector: 'hms-report-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CardComponent,
    PageHeaderComponent,
    ButtonComponent,
    BadgeComponent,
    SkeletonComponent,
    EmptyStateComponent,
    PaginationComponent,
    ReportViewerComponent,
    HmsDatePipe,
  ],
  template: `
    <hms-page-header
      heading="My reports"
      description="Lab reports, prescriptions and discharge summaries issued to you."
    />

    <hms-card [padded]="false">
      <div class="flex flex-wrap items-center gap-2 border-b border-surface-border p-3">
        <label class="flex items-center gap-1.5">
          <span class="sr-only-focusable">Filter by document type</span>
          <select
            class="h-9 rounded-control bg-surface px-2 text-sm text-surface-fg ring-1 ring-inset ring-surface-border focus:ring-2 focus:ring-brand-500"
            [value]="query().kind"
            (change)="onKindChange($event)"
          >
            <option value="">All documents</option>
            @for (entry of kindOptions; track entry.value) {
              <option [value]="entry.value">{{ entry.label }}</option>
            }
          </select>
        </label>

        <label class="flex items-center gap-1.5">
          <span class="sr-only-focusable">Filter by status</span>
          <select
            class="h-9 rounded-control bg-surface px-2 text-sm text-surface-fg ring-1 ring-inset ring-surface-border focus:ring-2 focus:ring-brand-500"
            [value]="query().status"
            (change)="onStatusChange($event)"
          >
            <option value="">Any status</option>
            @for (entry of statusOptions; track entry.value) {
              <option [value]="entry.value">{{ entry.label }}</option>
            }
          </select>
        </label>
      </div>

      @if (portal.isReportsLoading() && rows().length === 0) {
        <div class="p-5"><hms-skeleton [lines]="5" [height]="20" label="Loading your reports" /></div>
      } @else if (rows().length === 0) {
        <hms-empty-state
          title="No reports yet"
          description="Reports appear here as soon as your results are released."
        />
      } @else {
        <ul role="list" class="divide-y divide-surface-border">
          @for (report of rows(); track report.id) {
            <li class="flex flex-wrap items-start gap-4 px-5 py-4">
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <p class="text-sm font-medium text-surface-fg">{{ report.title }}</p>
                  <hms-badge [tone]="tone(report)">{{ statusLabel(report) }}</hms-badge>
                </div>
                <p class="mt-0.5 text-xs text-surface-fg-muted">
                  {{ kindLabel(report) }}
                  @if (report.relatedOrderNumber !== null) {
                    · {{ report.relatedOrderNumber }}
                  }
                  @if (report.issuedAt !== null) {
                    · issued {{ report.issuedAt | hmsDate }}
                  }
                  @if (report.sizeBytes !== null) {
                    · {{ size(report) }}
                  }
                </p>
                @if (report.downloadedAt !== null) {
                  <p class="mt-0.5 text-xs text-surface-fg-muted">
                    Downloaded {{ report.downloadedAt | hmsDate: true }}
                  </p>
                }
              </div>

              <!-- A pending report offers no actions at all: there is no file
                   behind it yet, so a disabled button would only mislead. -->
              @if (report.status === 'pending') {
                <p class="text-xs text-status-pending-strong">Awaiting release</p>
              } @else {
                <div class="flex items-center gap-2">
                  <hms-button variant="secondary" size="sm" (pressed)="preview(report)">
                    Preview
                  </hms-button>
                  <hms-button
                    size="sm"
                    [loading]="downloadingId() === report.id"
                    [disabled]="downloadingId() !== null"
                    (pressed)="download(report)"
                  >
                    Download
                  </hms-button>
                </div>
              }
            </li>
          }
        </ul>
      }

      @if (page(); as currentPage) {
        <hms-pagination
          [page]="currentPage.page"
          [totalPages]="currentPage.totalPages"
          [total]="currentPage.total"
          [pageSize]="currentPage.pageSize"
          (pageChanged)="portal.setPage($event)"
        />
      }
    </hms-card>

    <!-- The viewer is deferred: pulling in the PDF embed for a patient who
         only downloads would be wasted bytes on a phone connection. -->
    @defer (when previewing() !== null) {
      @if (previewing(); as report) {
        <hms-report-viewer [report]="report" (closed)="previewing.set(null)" />
      }
    } @placeholder {
      <span></span>
    } @loading {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div class="w-full max-w-lg rounded-card bg-surface-raised p-6">
          <hms-skeleton [lines]="4" [height]="18" label="Opening report" />
        </div>
      </div>
    }
  `,
})
export class ReportListComponent {
  protected readonly portal = inject(PatientPortalFacade);
  private readonly toast = inject(ToastService);

  protected readonly query = this.portal.query;
  protected readonly page = this.portal.reports;
  protected readonly rows = computed<readonly ReportDocument[]>(() => this.page()?.items ?? []);

  protected readonly previewing = signal<ReportDocument | null>(null);
  protected readonly downloadingId = signal<number | null>(null);

  protected readonly kindOptions = Object.entries(REPORT_KIND_LABELS).map(([value, label]) => ({
    value,
    label,
  }));

  protected readonly statusOptions = Object.entries(REPORT_STATUS_LABELS).map(([value, label]) => ({
    value,
    label,
  }));

  protected tone(report: ReportDocument) {
    return reportTone(report.status);
  }

  protected statusLabel(report: ReportDocument): string {
    return REPORT_STATUS_LABELS[report.status];
  }

  protected kindLabel(report: ReportDocument): string {
    return REPORT_KIND_LABELS[report.kind];
  }

  protected size(report: ReportDocument): string {
    return formatBytes(report.sizeBytes);
  }

  protected onKindChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.portal.patchQuery({ kind: value === '' ? '' : (value as ReportKind) });
  }

  protected onStatusChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.portal.patchQuery({ status: value === '' ? '' : (value as ReportStatus) });
  }

  protected preview(report: ReportDocument): void {
    this.previewing.set(report);
  }

  protected async download(report: ReportDocument): Promise<void> {
    this.downloadingId.set(report.id);
    try {
      await this.portal.download(report);
      this.toast.success('Download started', report.title);
    } catch (error: unknown) {
      const apiError = toApiError(error);
      this.toast.error('Could not download report', apiError.message);
    } finally {
      this.downloadingId.set(null);
    }
  }
}
