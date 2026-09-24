import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { LabService, type LabOrderAction } from './lab.service';
import { PermissionService } from '../../core/auth/permission.service';
import { ToastService } from '../../core/services/toast.service';
import { toApiError } from '../../core/http/api-error';
import { CardComponent } from '../../shared/ui/card/card.component';
import { PageHeaderComponent } from '../../shared/ui/page-header/page-header.component';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { BadgeComponent } from '../../shared/ui/badge/badge.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { ResultEntryComponent } from './result-entry.component';
import { HmsDatePipe } from '../../shared/pipes/hms-pipes';
import {
  LAB_ORDER_STATUS_LABELS,
  RESULT_FLAG_LABELS,
  flagTone,
  labOrderTone,
  type LabOrder,
  type LabResult,
} from '../../shared/models/lab.model';

@Component({
  selector: 'hms-order-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CardComponent,
    PageHeaderComponent,
    ButtonComponent,
    BadgeComponent,
    SkeletonComponent,
    EmptyStateComponent,
    ResultEntryComponent,
    HmsDatePipe,
  ],
  template: `
    @if (lab.isDetailLoading() && order() === undefined) {
      <hms-card><hms-skeleton [lines]="6" [height]="16" label="Loading order" /></hms-card>
    } @else if (order(); as record) {
      <hms-page-header
        [heading]="record.orderNumber"
        [description]="record.patientName + ' · ' + record.patientMrn"
      >
        @for (action of availableActions(); track action.action) {
          <hms-button
            [variant]="action.variant"
            [loading]="pending()"
            [disabled]="pending()"
            (pressed)="run(action.action)"
          >
            {{ action.label }}
          </hms-button>
        }
        @if (canEnterResults() && canShowResultEntry()) {
          <hms-button (pressed)="entering.set(true)">Enter results</hms-button>
        }
      </hms-page-header>

      <div class="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div class="rounded-card bg-surface-raised p-4 ring-1 ring-surface-border ring-inset">
          <p class="text-xs text-surface-fg-muted">Status</p>
          <p class="mt-2">
            <hms-badge [tone]="tone(record)">{{ statusLabel(record) }}</hms-badge>
            @if (record.priority === 'urgent') {
              <hms-badge tone="critical" [dot]="false">Urgent</hms-badge>
            }
          </p>
        </div>
        <div class="rounded-card bg-surface-raised p-4 ring-1 ring-surface-border ring-inset">
          <p class="text-xs text-surface-fg-muted">Ordered by</p>
          <p class="mt-1 text-sm font-medium text-surface-fg">{{ record.orderedByName }}</p>
          <p class="text-xs text-surface-fg-muted">{{ record.orderedAt | hmsDate: true }}</p>
        </div>
        <div class="rounded-card bg-surface-raised p-4 ring-1 ring-surface-border ring-inset">
          <p class="text-xs text-surface-fg-muted">Sample</p>
          @if (record.sampleId === null) {
            <p class="mt-1 text-sm text-surface-fg-muted">Not collected</p>
          } @else {
            <p class="mt-1 font-mono text-sm font-medium text-surface-fg">{{ record.sampleId }}</p>
            <p class="text-xs text-surface-fg-muted">
              {{ record.sampleCollectedAt | hmsDate: true }}
            </p>
          }
        </div>
        <div class="rounded-card bg-surface-raised p-4 ring-1 ring-surface-border ring-inset">
          <p class="text-xs text-surface-fg-muted">Report</p>
          @if (record.reportId === null) {
            <p class="mt-1 text-sm text-surface-fg-muted">Not issued</p>
          } @else {
            <p class="mt-1 text-sm font-medium text-status-ready-strong">
              Issued to patient portal
            </p>
            <p class="text-xs text-surface-fg-muted">{{ record.completedAt | hmsDate: true }}</p>
          }
        </div>
      </div>

      @if (record.clinicalNotes !== '') {
        <hms-card heading="Clinical notes" class="mb-4">
          <p class="text-sm text-surface-fg">{{ record.clinicalNotes }}</p>
        </hms-card>
      }

      <hms-card heading="Tests & results" [padded]="false">
        @if (record.results.length === 0) {
          <div class="divide-y divide-surface-border">
            @for (test of record.tests; track test.id) {
              <div class="flex items-center gap-3 px-5 py-3">
                <div class="min-w-0 flex-1">
                  <p class="text-sm text-surface-fg">{{ test.name }}</p>
                  <p class="text-xs text-surface-fg-muted">
                    {{ test.code }} · {{ test.specimen }}
                    @if (test.referenceLow !== null || test.referenceHigh !== null) {
                      · ref {{ referenceText(test.referenceLow, test.referenceHigh) }}
                      {{ test.unit }}
                    }
                  </p>
                </div>
                <p class="text-xs text-surface-fg-muted">awaiting result</p>
              </div>
            }
          </div>
        } @else {
          <table class="w-full text-sm">
            <caption class="sr-only-focusable">Results for {{ record.orderNumber }}</caption>
            <thead>
              <tr class="border-b border-surface-border bg-surface-sunken/60">
                <th scope="col" class="px-5 py-2.5 text-left text-xs font-semibold text-surface-fg-muted">
                  Test
                </th>
                <th scope="col" class="px-3 py-2.5 text-right text-xs font-semibold text-surface-fg-muted">
                  Result
                </th>
                <th scope="col" class="hidden px-3 py-2.5 text-right text-xs font-semibold text-surface-fg-muted sm:table-cell">
                  Reference
                </th>
                <th scope="col" class="px-5 py-2.5 text-right text-xs font-semibold text-surface-fg-muted">
                  Flag
                </th>
              </tr>
            </thead>
            <tbody>
              @for (result of record.results; track result.id) {
                <tr class="border-b border-surface-border last:border-0">
                  <td class="px-5 py-3">
                    <p class="text-surface-fg">{{ result.testName }}</p>
                    @if (result.notes !== '') {
                      <p class="text-xs text-surface-fg-muted">{{ result.notes }}</p>
                    }
                  </td>
                  <td class="px-3 py-3 text-right font-medium" [class]="valueClass(result)">
                    {{ result.value }}
                    <span class="text-xs font-normal text-surface-fg-muted">{{ result.unit }}</span>
                  </td>
                  <td class="hidden px-3 py-3 text-right text-xs text-surface-fg-muted sm:table-cell">
                    {{ referenceText(result.referenceLow, result.referenceHigh) }}
                  </td>
                  <td class="px-5 py-3 text-right">
                    @if (result.flag !== 'non_numeric') {
                      <hms-badge [tone]="flagBadge(result)">{{ flagLabel(result) }}</hms-badge>
                    } @else {
                      <span class="text-xs text-surface-fg-muted">—</span>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        }
      </hms-card>

      @if (entering()) {
        <hms-result-entry
          [order]="record"
          (closed)="entering.set(false)"
          (completed)="onResultsSaved()"
        />
      }
    } @else {
      <hms-card>
        <hms-empty-state title="Order not found" description="It may have been removed." />
      </hms-card>
    }
  `,
})
export class OrderDetailComponent {
  protected readonly lab = inject(LabService);
  private readonly permissions = inject(PermissionService);
  private readonly toast = inject(ToastService);

  readonly id = input.required<string>();

  protected readonly order = this.lab.selectedOrder;
  protected readonly pending = signal(false);
  protected readonly entering = signal(false);
  protected readonly canEnterResults = this.permissions.hasPermission('lab.result');

  constructor() {
    effect(() => {
      const parsed = Number(this.id());
      this.lab.select(Number.isFinite(parsed) ? parsed : null);
    });
  }

  /** Only transitions the backend will accept are offered. */
  protected readonly availableActions = computed<
    readonly { action: LabOrderAction; label: string; variant: 'primary' | 'secondary' | 'danger' }[]
  >(() => {
    const record = this.order();
    if (record === undefined || !this.canEnterResults()) {
      return [];
    }
    switch (record.status) {
      case 'ordered':
        return [
          { action: 'collect-sample', label: 'Collect sample', variant: 'primary' },
          { action: 'cancel', label: 'Cancel', variant: 'danger' },
        ];
      case 'sample_collected':
        return [
          { action: 'start', label: 'Start analysis', variant: 'primary' },
          { action: 'cancel', label: 'Cancel', variant: 'danger' },
        ];
      default:
        return [];
    }
  });

  protected readonly canShowResultEntry = computed(() => {
    const record = this.order();
    return record !== undefined && (record.status === 'in_progress' || record.status === 'sample_collected');
  });

  protected tone(order: LabOrder) {
    return labOrderTone(order.status);
  }

  protected statusLabel(order: LabOrder): string {
    return LAB_ORDER_STATUS_LABELS[order.status];
  }

  protected flagBadge(result: LabResult) {
    return flagTone(result.flag);
  }

  protected flagLabel(result: LabResult): string {
    return RESULT_FLAG_LABELS[result.flag];
  }

  protected valueClass(result: LabResult): string {
    return result.flag === 'low' || result.flag === 'high'
      ? 'text-status-critical-strong'
      : 'text-surface-fg';
  }

  protected referenceText(low: number | null, high: number | null): string {
    if (low === null && high === null) {
      return '—';
    }
    if (low === null) {
      return `< ${high}`;
    }
    if (high === null) {
      return `> ${low}`;
    }
    return `${low} – ${high}`;
  }

  protected async run(action: LabOrderAction): Promise<void> {
    const record = this.order();
    if (record === undefined) {
      return;
    }
    this.pending.set(true);
    try {
      const updated = await this.lab.transition(record.id, action);
      this.toast.success(
        LAB_ORDER_STATUS_LABELS[updated.status],
        `${updated.orderNumber} · ${updated.patientName}`,
      );
    } catch (error: unknown) {
      // The interceptor has already raised a toast; nothing to add.
      toApiError(error);
    } finally {
      this.pending.set(false);
    }
  }

  protected onResultsSaved(): void {
    this.entering.set(false);
    this.toast.success('Results released', 'The report is now available in the patient portal.');
  }
}
