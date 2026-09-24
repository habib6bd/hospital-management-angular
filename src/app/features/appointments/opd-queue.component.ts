import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  PLATFORM_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AppointmentService, DoctorService, type AppointmentAction } from './appointment.service';
import { PermissionService } from '../../core/auth/permission.service';
import { ToastService } from '../../core/services/toast.service';
import { toApiError } from '../../core/http/api-error';
import { CardComponent } from '../../shared/ui/card/card.component';
import { PageHeaderComponent } from '../../shared/ui/page-header/page-header.component';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { BadgeComponent } from '../../shared/ui/badge/badge.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { RelativeTimePipe } from '../../shared/pipes/hms-pipes';
import type { Appointment } from '../../shared/models/appointment.model';

const POLL_INTERVAL_MS = 20_000;

interface QueueColumn {
  readonly key: 'notArrived' | 'waiting' | 'inConsultation';
  readonly title: string;
  readonly hint: string;
  readonly tone: 'info' | 'pending' | 'ready';
  readonly items: readonly Appointment[];
}

@Component({
  selector: 'hms-opd-queue',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CardComponent,
    PageHeaderComponent,
    ButtonComponent,
    BadgeComponent,
    SkeletonComponent,
    EmptyStateComponent,
    RelativeTimePipe,
  ],
  template: `
    <hms-page-header heading="OPD queue" [description]="'Today’s live queue. Refreshes automatically.'">
      <label class="flex items-center gap-1.5">
        <span class="sr-only-focusable">Filter by doctor</span>
        <select
          class="h-9 rounded-control bg-surface px-2 text-sm text-surface-fg ring-1 ring-inset ring-surface-border focus:ring-2 focus:ring-brand-500"
          [value]="appointments.queueDoctor()"
          (change)="onDoctorChange($event)"
        >
          <option value="">All doctors</option>
          @for (doctor of doctors.doctors(); track doctor.id) {
            <option [value]="doctor.id">{{ doctor.fullName }}</option>
          }
        </select>
      </label>
      <hms-button variant="secondary" (pressed)="appointments.refreshQueue()">Refresh</hms-button>
    </hms-page-header>

    @if (appointments.isQueueLoading() && appointments.queue().length === 0) {
      <hms-card><hms-skeleton [lines]="6" [height]="20" label="Loading queue" /></hms-card>
    } @else {
      <!-- Announce queue size changes without moving focus. -->
      <p class="sr-only-focusable" aria-live="polite">
        {{ appointments.waiting().length }} patients waiting,
        {{ appointments.inConsultation().length }} in consultation.
      </p>

      <div class="grid gap-4 lg:grid-cols-3">
        @for (column of columns(); track column.key) {
          <hms-card [heading]="column.title" [subheading]="column.hint" [padded]="false">
            <span card-actions>
              <hms-badge [tone]="column.tone">{{ column.items.length }}</hms-badge>
            </span>

            @if (column.items.length === 0) {
              <hms-empty-state title="Nobody here" [description]="null" />
            } @else {
              <ul role="list" class="divide-y divide-surface-border">
                @for (appointment of column.items; track appointment.id) {
                  <li class="px-4 py-3">
                    <div class="flex items-start gap-3">
                      <span
                        class="flex size-9 shrink-0 items-center justify-center rounded-control bg-surface-sunken font-mono text-sm font-semibold text-surface-fg"
                        [attr.aria-label]="'Token ' + appointment.tokenNumber"
                      >
                        {{ appointment.tokenNumber }}
                      </span>
                      <div class="min-w-0 flex-1">
                        <p class="truncate text-sm font-medium text-surface-fg">
                          {{ appointment.patientName }}
                        </p>
                        <p class="truncate text-xs text-surface-fg-muted">
                          {{ appointment.startTime }} · {{ appointment.doctorName }}
                        </p>
                        @if (appointment.checkedInAt !== null) {
                          <p class="mt-0.5 text-xs text-surface-fg-muted">
                            Checked in {{ appointment.checkedInAt | relativeTime }}
                          </p>
                        }
                      </div>
                    </div>

                    @if (canManageQueue()) {
                      <div class="mt-2 flex flex-wrap gap-1.5">
                        @for (action of actionsFor(appointment); track action.action) {
                          <hms-button
                            size="sm"
                            [variant]="action.variant"
                            [loading]="pendingId() === appointment.id"
                            [disabled]="pendingId() !== null"
                            (pressed)="run(appointment, action.action)"
                          >
                            {{ action.label }}
                          </hms-button>
                        }
                      </div>
                    }
                  </li>
                }
              </ul>
            }
          </hms-card>
        }
      </div>
    }
  `,
})
export class OpdQueueComponent {
  protected readonly appointments = inject(AppointmentService);
  protected readonly doctors = inject(DoctorService);
  private readonly permissions = inject(PermissionService);
  private readonly toast = inject(ToastService);

  protected readonly pendingId = signal<number | null>(null);
  protected readonly canManageQueue = this.permissions.hasPermission('appointments.queue');

  constructor() {
    // Polling is browser-only: an interval during SSR would hold the render open.
    if (isPlatformBrowser(inject(PLATFORM_ID))) {
      const timer = setInterval(() => this.appointments.refreshQueue(), POLL_INTERVAL_MS);
      inject(DestroyRef).onDestroy(() => clearInterval(timer));
    }
  }

  protected readonly columns = computed<readonly QueueColumn[]>(() => [
    {
      key: 'notArrived',
      title: 'Not arrived',
      hint: 'Booked but not checked in',
      tone: 'info',
      items: this.appointments.notArrived(),
    },
    {
      key: 'waiting',
      title: 'Waiting',
      hint: 'Checked in, awaiting the doctor',
      tone: 'pending',
      items: this.appointments.waiting(),
    },
    {
      key: 'inConsultation',
      title: 'In consultation',
      hint: 'Currently with the doctor',
      tone: 'ready',
      items: this.appointments.inConsultation(),
    },
  ]);

  /**
   * Only legal transitions are offered. The backend re-checks the state machine,
   * so a stale queue can never push a booking into an invalid state.
   */
  protected actionsFor(
    appointment: Appointment,
  ): readonly { action: AppointmentAction; label: string; variant: 'primary' | 'secondary' | 'danger' }[] {
    switch (appointment.status) {
      case 'booked':
        return [
          { action: 'check-in', label: 'Check in', variant: 'primary' },
          { action: 'no-show', label: 'No show', variant: 'secondary' },
          { action: 'cancel', label: 'Cancel', variant: 'danger' },
        ];
      case 'checked_in':
        return [
          { action: 'start', label: 'Start', variant: 'primary' },
          { action: 'no-show', label: 'No show', variant: 'secondary' },
        ];
      case 'in_consultation':
        return [{ action: 'complete', label: 'Complete', variant: 'primary' }];
      default:
        return [];
    }
  }

  protected onDoctorChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.appointments.setQueueDoctor(value === '' ? '' : Number(value));
  }

  protected async run(appointment: Appointment, action: AppointmentAction): Promise<void> {
    this.pendingId.set(appointment.id);
    try {
      const updated = await this.appointments.transition(appointment.id, action);
      this.toast.success(
        `${appointment.patientName} — ${updated.status.replace('_', ' ')}`,
        `Token ${updated.tokenNumber}`,
      );
    } catch (error: unknown) {
      const apiError = toApiError(error);
      if (apiError.status === 409) {
        // Someone else moved this patient; the toast from the interceptor
        // explains it, and a refresh brings the board back in sync.
        this.appointments.refreshQueue();
      }
    } finally {
      this.pendingId.set(null);
    }
  }
}
