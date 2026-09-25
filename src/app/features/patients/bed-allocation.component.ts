import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { WardService } from './patient.service';
import { PermissionService } from '../../core/auth/permission.service';
import { ToastService } from '../../core/services/toast.service';
import { CardComponent } from '../../shared/ui/card/card.component';
import { PageHeaderComponent } from '../../shared/ui/page-header/page-header.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';
import { HumanisePipe } from '../../shared/pipes/hms-pipes';
import type { Bed } from '../../shared/models/patient.model';

const BED_STATUS_CLASSES: Readonly<Record<Bed['status'], string>> = {
  available: 'bg-status-ready-soft text-status-ready-strong ring-status-ready/30',
  occupied: 'bg-status-info-soft text-status-info-strong ring-status-info/30',
  cleaning: 'bg-status-pending-soft text-status-pending-strong ring-status-pending/30',
  maintenance: 'bg-status-critical-soft text-status-critical-strong ring-status-critical/30',
};

@Component({
  selector: 'hms-bed-allocation',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardComponent, PageHeaderComponent, SkeletonComponent, HumanisePipe],
  template: `
    <hms-page-header
      heading="Ward & bed allocation"
      description="Live occupancy across all wards."
    />

    <div class="mb-4 grid gap-3 sm:grid-cols-3">
      <div class="rounded-card bg-surface-raised p-4 ring-1 ring-surface-border ring-inset">
        <p class="text-xs text-surface-fg-muted">Total beds</p>
        <p class="mt-1 text-2xl font-semibold text-surface-fg">{{ wards.totalBeds() }}</p>
      </div>
      <div class="rounded-card bg-surface-raised p-4 ring-1 ring-surface-border ring-inset">
        <p class="text-xs text-surface-fg-muted">Occupied</p>
        <p class="mt-1 text-2xl font-semibold text-status-info-strong">{{ wards.occupiedBeds() }}</p>
      </div>
      <div class="rounded-card bg-surface-raised p-4 ring-1 ring-surface-border ring-inset">
        <p class="text-xs text-surface-fg-muted">Occupancy rate</p>
        <p class="mt-1 text-2xl font-semibold" [class]="occupancyClass()">
          {{ occupancyPercent() }}%
        </p>
      </div>
    </div>

    <div class="grid gap-4 lg:grid-cols-[16rem_1fr]">
      <hms-card heading="Wards" [padded]="false">
        @if (wards.isLoading()) {
          <div class="p-4"><hms-skeleton [lines]="5" [height]="14" /></div>
        } @else {
          <ul role="list" class="divide-y divide-surface-border">
            @for (ward of wards.wards(); track ward.id) {
              <li>
                <button
                  type="button"
                  class="w-full px-4 py-3 text-left transition-colors"
                  [class]="
                    ward.id === wards.activeWardId()
                      ? 'bg-brand-50 dark:bg-brand-950'
                      : 'hover:bg-surface-sunken'
                  "
                  [attr.aria-current]="ward.id === wards.activeWardId() ? 'true' : null"
                  (click)="wards.selectWard(ward.id)"
                >
                  <span class="block text-sm font-medium text-surface-fg">{{ ward.name }}</span>
                  <span class="mt-0.5 block text-xs text-surface-fg-muted">
                    Floor {{ ward.floor }} · {{ ward.occupiedBeds }}/{{ ward.totalBeds }} occupied
                  </span>
                  <span
                    class="mt-2 block h-1 overflow-hidden rounded-full bg-surface-sunken"
                    role="img"
                    [attr.aria-label]="wardOccupancyLabel(ward.name, ward.occupiedBeds, ward.totalBeds)"
                  >
                    <span
                      class="block h-full rounded-full bg-brand-500"
                      [style.width.%]="ward.totalBeds === 0 ? 0 : (ward.occupiedBeds / ward.totalBeds) * 100"
                    ></span>
                  </span>
                </button>
              </li>
            }
          </ul>
        }
      </hms-card>

      <hms-card [heading]="activeWardName()" subheading="Select an occupied bed to open the patient record.">
        @if (wards.isBedsLoading()) {
          <hms-skeleton [lines]="4" [height]="48" label="Loading beds" />
        } @else {
          <ul role="list" class="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            @for (bed of wards.beds(); track bed.id) {
              <li>
                <button
                  type="button"
                  class="w-full rounded-control p-2.5 text-left ring-1 ring-inset transition-transform hover:scale-[1.02] disabled:cursor-default disabled:hover:scale-100"
                  [class]="statusClass(bed.status)"
                  [disabled]="bed.patientId === null"
                  [attr.aria-label]="bedLabel(bed)"
                  (click)="openPatient(bed)"
                >
                  <span class="block font-mono text-xs font-semibold">{{ bed.bedNumber }}</span>
                  <span class="mt-0.5 block truncate text-[11px] opacity-90">
                    {{ bed.patientName ?? (bed.status | humanise) }}
                  </span>
                </button>
              </li>
            }
          </ul>

          <div class="mt-4 flex flex-wrap gap-3 border-t border-surface-border pt-3">
            @for (entry of legend; track entry.status) {
              <span class="flex items-center gap-1.5 text-xs text-surface-fg-muted">
                <span class="size-2.5 rounded-sm ring-1 ring-inset" [class]="statusClass(entry.status)"></span>
                {{ entry.label }}
              </span>
            }
          </div>
        }
      </hms-card>
    </div>
  `,
})
export class BedAllocationComponent {
  protected readonly wards = inject(WardService);
  private readonly permissions = inject(PermissionService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly legend: readonly { status: Bed['status']; label: string }[] = [
    { status: 'available', label: 'Available' },
    { status: 'occupied', label: 'Occupied' },
    { status: 'cleaning', label: 'Cleaning' },
    { status: 'maintenance', label: 'Maintenance' },
  ];

  protected readonly occupancyPercent = computed(() => Math.round(this.wards.occupancyRate() * 100));

  /** Occupancy above 90% is an operational problem, so it reads as critical. */
  protected readonly occupancyClass = computed(() => {
    const rate = this.wards.occupancyRate();
    if (rate >= 0.9) {
      return 'text-status-critical-strong';
    }
    return rate >= 0.75 ? 'text-status-pending-strong' : 'text-status-ready-strong';
  });

  protected readonly activeWardName = computed(() => {
    const id = this.wards.activeWardId();
    return this.wards.wards().find((ward) => ward.id === id)?.name ?? 'Beds';
  });

  protected statusClass(status: Bed['status']): string {
    return BED_STATUS_CLASSES[status];
  }

  protected bedLabel(bed: Bed): string {
    return bed.patientName === null
      ? `Bed ${bed.bedNumber}, ${bed.status}`
      : `Bed ${bed.bedNumber}, occupied by ${bed.patientName}`;
  }

  protected wardOccupancyLabel(name: string, occupied: number, total: number): string {
    return `${name}: ${occupied} of ${total} beds occupied`;
  }

  protected async openPatient(bed: Bed): Promise<void> {
    if (bed.patientId === null) {
      return;
    }
    if (!this.permissions.can('patients.view')) {
      this.toast.warning('Not permitted', 'You cannot open patient records.');
      return;
    }
    await this.router.navigate(['/app/patients', bed.patientId]);
  }
}
