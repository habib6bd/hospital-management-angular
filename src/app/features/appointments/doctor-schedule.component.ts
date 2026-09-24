import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { DoctorService } from './appointment.service';
import { PermissionService } from '../../core/auth/permission.service';
import { ToastService } from '../../core/services/toast.service';
import { CardComponent } from '../../shared/ui/card/card.component';
import { PageHeaderComponent } from '../../shared/ui/page-header/page-header.component';
import { BadgeComponent } from '../../shared/ui/badge/badge.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { WEEKDAY_LABELS, type DoctorSchedule } from '../../shared/models/appointment.model';

@Component({
  selector: 'hms-doctor-schedule',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CardComponent,
    PageHeaderComponent,
    BadgeComponent,
    SkeletonComponent,
    EmptyStateComponent,
  ],
  template: `
    <hms-page-header
      heading="Doctor schedules"
      description="Weekly clinic hours. Turning a day off removes its slots from booking."
    >
      <label class="flex items-center gap-1.5">
        <span class="sr-only-focusable">Select doctor</span>
        <select
          class="h-9 rounded-control bg-surface px-2 text-sm text-surface-fg ring-1 ring-inset ring-surface-border focus:ring-2 focus:ring-brand-500"
          [value]="selectedDoctorId() ?? ''"
          (change)="onDoctorChange($event)"
        >
          <option value="">Select a doctor</option>
          @for (doctor of doctors.doctors(); track doctor.id) {
            <option [value]="doctor.id">{{ doctor.fullName }} — {{ doctor.specialty }}</option>
          }
        </select>
      </label>
    </hms-page-header>

    <hms-card [padded]="false">
      @if (selectedDoctorId() === null) {
        <hms-empty-state
          title="Select a doctor"
          description="Their weekly clinic template appears here."
        />
      } @else if (doctors.isSchedulesLoading()) {
        <div class="p-5"><hms-skeleton [lines]="5" [height]="18" label="Loading schedule" /></div>
      } @else {
        <ul role="list" class="divide-y divide-surface-border">
          @for (day of week(); track day.weekday) {
            <li class="flex flex-wrap items-center gap-3 px-5 py-3">
              <span class="w-24 text-sm font-medium text-surface-fg">{{ day.label }}</span>

              @if (day.schedule === null) {
                <hms-badge tone="neutral">No clinic</hms-badge>
              } @else {
                <span class="font-mono text-sm text-surface-fg">
                  {{ day.schedule.startTime }}–{{ day.schedule.endTime }}
                </span>
                <span class="text-xs text-surface-fg-muted">
                  {{ day.schedule.slotMinutes }} min slots · {{ slotCount(day.schedule) }} per day
                </span>
                <hms-badge [tone]="day.schedule.isActive ? 'ready' : 'neutral'">
                  {{ day.schedule.isActive ? 'Active' : 'Paused' }}
                </hms-badge>

                <div class="flex-1"></div>

                @if (canManage()) {
                  <label class="flex cursor-pointer items-center gap-2 text-xs text-surface-fg-muted">
                    <input
                      type="checkbox"
                      class="size-4 rounded accent-brand-600"
                      [checked]="day.schedule.isActive"
                      [disabled]="pendingId() === day.schedule.id"
                      [attr.aria-label]="'Clinic active on ' + day.label"
                      (change)="toggle(day.schedule!, $event)"
                    />
                    Active
                  </label>
                }
              }
            </li>
          }
        </ul>
      }
    </hms-card>
  `,
})
export class DoctorScheduleComponent {
  protected readonly doctors = inject(DoctorService);
  private readonly permissions = inject(PermissionService);
  private readonly toast = inject(ToastService);

  protected readonly selectedDoctorId = signal<number | null>(null);
  protected readonly pendingId = signal<number | null>(null);
  protected readonly canManage = this.permissions.hasPermission('appointments.manage');

  constructor() {
    effect(() => {
      this.doctors.selectScheduleDoctor(this.selectedDoctorId());
    });

    // Default to the first doctor once the list arrives, so the page is never blank.
    effect(() => {
      const first = this.doctors.doctors()[0];
      if (first !== undefined && this.selectedDoctorId() === null) {
        this.selectedDoctorId.set(first.id);
      }
    });
  }

  /** All seven days, so days without a clinic are visibly absent rather than missing. */
  protected readonly week = computed(() => {
    const schedules = this.doctors.schedules();
    return WEEKDAY_LABELS.map((label, weekday) => ({
      weekday,
      label,
      schedule: schedules.find((schedule) => schedule.weekday === weekday) ?? null,
    }));
  });

  protected slotCount(schedule: DoctorSchedule): number {
    const toMinutes = (time: string): number => {
      const [hours = '0', mins = '0'] = time.split(':');
      return Number(hours) * 60 + Number(mins);
    };
    return Math.floor(
      (toMinutes(schedule.endTime) - toMinutes(schedule.startTime)) / schedule.slotMinutes,
    );
  }

  protected onDoctorChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.selectedDoctorId.set(value === '' ? null : Number(value));
  }

  protected async toggle(schedule: DoctorSchedule, event: Event): Promise<void> {
    const isActive = (event.target as HTMLInputElement).checked;
    this.pendingId.set(schedule.id);
    try {
      await this.doctors.updateSchedule(schedule.id, { isActive });
      this.toast.success(
        isActive ? 'Clinic resumed' : 'Clinic paused',
        `${WEEKDAY_LABELS[schedule.weekday]} · ${schedule.doctorName}`,
      );
    } finally {
      this.pendingId.set(null);
    }
  }
}
