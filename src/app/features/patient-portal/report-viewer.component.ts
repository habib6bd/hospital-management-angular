import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { DomSanitizer, type SafeResourceUrl } from '@angular/platform-browser';
import { PatientPortalFacade } from './patient-portal.facade';
import { ToastService } from '../../core/services/toast.service';
import { toApiError } from '../../core/http/api-error';
import { ModalComponent } from '../../shared/ui/modal/modal.component';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';
import { REPORT_KIND_LABELS, type ReportDocument } from '../../shared/models/lab.model';

/**
 * PDF preview.
 *
 * The signed URL is fetched when this component opens, not when the list
 * renders, so no live signature ever sits in the list markup. It is held in a
 * signal and never written to the address bar or to storage.
 */
@Component({
  selector: 'hms-report-viewer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModalComponent, ButtonComponent, SkeletonComponent],
  template: `
    <hms-modal
      [heading]="report().title"
      [description]="kindLabel() + (expiresNote() === null ? '' : ' · ' + expiresNote())"
      (closed)="closed.emit()"
    >
      @if (loading()) {
        <hms-skeleton [lines]="6" [height]="24" label="Loading report" />
      } @else if (error() !== null) {
        <p class="rounded-control bg-status-critical-soft px-3 py-2 text-sm text-status-critical-strong" role="alert">
          {{ error() }}
        </p>
      } @else if (safeUrl(); as url) {
        <!-- <object> degrades to its fallback when the browser has no PDF
             viewer, which <iframe> would not do. -->
        <object [data]="url" type="application/pdf" class="h-[60dvh] w-full rounded-control bg-surface-sunken">
          <div class="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
            <p class="text-sm text-surface-fg">
              Your browser cannot display PDFs inline.
            </p>
            <hms-button size="sm" (pressed)="download()">Download instead</hms-button>
          </div>
        </object>
      }

      <div modal-footer class="contents">
        <hms-button variant="secondary" (pressed)="closed.emit()">Close</hms-button>
        <hms-button [loading]="downloading()" (pressed)="download()">Download</hms-button>
      </div>
    </hms-modal>
  `,
})
export class ReportViewerComponent {
  private readonly portal = inject(PatientPortalFacade);
  private readonly toast = inject(ToastService);
  private readonly sanitizer = inject(DomSanitizer);

  readonly report = input.required<ReportDocument>();
  readonly closed = output<void>();

  protected readonly loading = signal(true);
  protected readonly downloading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly safeUrl = signal<SafeResourceUrl | null>(null);
  protected readonly expiresNote = signal<string | null>(null);

  constructor() {
    // An effect, not the constructor: a required input is not yet set while the
    // component is being constructed, so reading `report()` there throws.
    effect(() => {
      void this.load(this.report().id);
    });
  }

  protected kindLabel(): string {
    return REPORT_KIND_LABELS[this.report().kind];
  }

  private async load(reportId: number): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const ticket = await this.portal.requestDownloadUrl(reportId);
      // The URL comes from our own API, so it is trusted as a resource URL.
      this.safeUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(ticket.url));

      const expires = new Date(ticket.expiresAt);
      if (!Number.isNaN(expires.getTime())) {
        const minutes = Math.max(1, Math.round((expires.getTime() - Date.now()) / 60_000));
        this.expiresNote.set(`link valid for ${minutes} min`);
      }
    } catch (caught: unknown) {
      this.error.set(toApiError(caught).message);
    } finally {
      this.loading.set(false);
    }
  }

  protected async download(): Promise<void> {
    this.downloading.set(true);
    try {
      await this.portal.download(this.report());
      this.toast.success('Download started', this.report().title);
      this.closed.emit();
    } catch (caught: unknown) {
      this.toast.error('Could not download report', toApiError(caught).message);
    } finally {
      this.downloading.set(false);
    }
  }
}
