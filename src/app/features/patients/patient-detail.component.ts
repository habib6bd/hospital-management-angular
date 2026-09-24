import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { PatientService, WardService } from './patient.service';
import { PermissionService } from '../../core/auth/permission.service';
import { ToastService } from '../../core/services/toast.service';
import { CardComponent } from '../../shared/ui/card/card.component';
import { PageHeaderComponent } from '../../shared/ui/page-header/page-header.component';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { BadgeComponent } from '../../shared/ui/badge/badge.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { AdmissionDialogComponent } from './admission-dialog.component';
import { AgePipe, HmsDatePipe, HumanisePipe, RelativeTimePipe } from '../../shared/pipes/hms-pipes';
import { GENDER_LABELS, PATIENT_TYPE_LABELS, type MedicalHistoryEntry } from '../../shared/models/patient.model';

type DetailTab = 'overview' | 'history' | 'admission';

const HISTORY_TONES: Readonly<Record<MedicalHistoryEntry['category'], 'critical' | 'info' | 'pending' | 'neutral'>> = {
  allergy: 'critical',
  diagnosis: 'info',
  procedure: 'pending',
  medication: 'info',
  note: 'neutral',
};

@Component({
  selector: 'hms-patient-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    CardComponent,
    PageHeaderComponent,
    ButtonComponent,
    BadgeComponent,
    SkeletonComponent,
    EmptyStateComponent,
    AdmissionDialogComponent,
    AgePipe,
    HmsDatePipe,
    HumanisePipe,
    RelativeTimePipe,
  ],
  template: `
    @if (patients.isDetailLoading() && patient() === undefined) {
      <hms-card><hms-skeleton [lines]="8" [height]="16" label="Loading patient" /></hms-card>
    } @else if (patient(); as record) {
      <hms-page-header [heading]="record.fullName" [description]="record.mrn">
        @if (canManage()) {
          <hms-button variant="secondary" [routerLink]="['/patients', record.id, 'edit']">
            Edit
          </hms-button>
        }
        @if (canAdmit()) {
          @if (record.admission.status === 'admitted') {
            <hms-button variant="danger" (pressed)="dialog.set('discharge')">Discharge</hms-button>
          } @else {
            <hms-button (pressed)="dialog.set('admit')">Admit</hms-button>
          }
        }
      </hms-page-header>

      <!-- Key clinical facts stay visible above the tabs: on a ward round these
           are what gets read, and burying allergies behind a tab is unsafe. -->
      <div class="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div class="rounded-card bg-surface-raised p-4 ring-1 ring-surface-border ring-inset">
          <p class="text-xs text-surface-fg-muted">Age / Gender</p>
          <p class="mt-1 text-sm font-semibold text-surface-fg">
            {{ record.dateOfBirth | age }} · {{ genderLabel(record.gender) }}
          </p>
        </div>
        <div class="rounded-card bg-surface-raised p-4 ring-1 ring-surface-border ring-inset">
          <p class="text-xs text-surface-fg-muted">Blood group</p>
          <p class="mt-1 text-sm font-semibold text-status-critical-strong">
            {{ record.bloodGroup ?? 'Not typed' }}
          </p>
        </div>
        <div class="rounded-card bg-surface-raised p-4 ring-1 ring-surface-border ring-inset">
          <p class="text-xs text-surface-fg-muted">Care type</p>
          <p class="mt-1 text-sm font-semibold text-surface-fg">{{ typeLabel(record.type) }}</p>
        </div>
        <div
          class="rounded-card p-4 ring-1 ring-inset"
          [class]="
            record.allergies.length > 0
              ? 'bg-status-critical-soft ring-status-critical/30'
              : 'bg-surface-raised ring-surface-border'
          "
        >
          <p class="text-xs text-surface-fg-muted">Allergies</p>
          @if (record.allergies.length > 0) {
            <p class="mt-1 text-sm font-semibold text-status-critical-strong">
              {{ record.allergies.join(', ') }}
            </p>
          } @else {
            <p class="mt-1 text-sm font-semibold text-surface-fg">None recorded</p>
          }
        </div>
      </div>

      <div class="mb-4 flex gap-1 border-b border-surface-border" role="tablist">
        @for (item of tabs; track item.id) {
          <button
            type="button"
            role="tab"
            [attr.aria-selected]="tab() === item.id"
            class="-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors"
            [class]="
              tab() === item.id
                ? 'border-brand-600 text-brand-700 dark:text-brand-300'
                : 'border-transparent text-surface-fg-muted hover:text-surface-fg'
            "
            (click)="tab.set(item.id)"
          >
            {{ item.label }}
          </button>
        }
      </div>

      <div role="tabpanel">
        @switch (tab()) {
          @case ('overview') {
            <hms-card heading="Demographics & contact">
              <dl class="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                @for (row of overviewRows(); track row.label) {
                  <div>
                    <dt class="text-xs text-surface-fg-muted">{{ row.label }}</dt>
                    <dd class="mt-0.5 text-sm text-surface-fg">{{ row.value }}</dd>
                  </div>
                }
              </dl>
            </hms-card>
          }

          @case ('history') {
            <hms-card heading="Medical history" [padded]="false">
              @if (patients.isHistoryLoading()) {
                <div class="p-5"><hms-skeleton [lines]="5" [height]="14" /></div>
              } @else if (history().length === 0) {
                <hms-empty-state
                  title="No history recorded"
                  description="Diagnoses, procedures and notes appear here once entered."
                />
              } @else {
                <ol class="divide-y divide-surface-border">
                  @for (entry of history(); track entry.id) {
                    <li class="flex gap-3 px-5 py-4">
                      <hms-badge [tone]="historyTone(entry.category)">
                        {{ entry.category | humanise }}
                      </hms-badge>
                      <div class="min-w-0 flex-1">
                        <p class="text-sm font-medium text-surface-fg">{{ entry.title }}</p>
                        <p class="mt-0.5 text-xs text-surface-fg-muted">{{ entry.details }}</p>
                        <p class="mt-1 text-xs text-surface-fg-muted">
                          {{ entry.recordedBy }} · {{ entry.recordedAt | relativeTime }}
                        </p>
                      </div>
                    </li>
                  }
                </ol>
              }
            </hms-card>
          }

          @case ('admission') {
            <hms-card heading="Admission">
              @switch (record.admission.status) {
                @case ('admitted') {
                  <dl class="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                    <div>
                      <dt class="text-xs text-surface-fg-muted">Ward</dt>
                      <dd class="mt-0.5 text-sm text-surface-fg">{{ record.admission.wardName }}</dd>
                    </div>
                    <div>
                      <dt class="text-xs text-surface-fg-muted">Bed</dt>
                      <dd class="mt-0.5 font-mono text-sm text-surface-fg">
                        {{ record.admission.bedNumber }}
                      </dd>
                    </div>
                    <div>
                      <dt class="text-xs text-surface-fg-muted">Admitted</dt>
                      <dd class="mt-0.5 text-sm text-surface-fg">
                        {{ record.admission.admittedAt | hmsDate: true }}
                      </dd>
                    </div>
                    <div>
                      <dt class="text-xs text-surface-fg-muted">Attending doctor</dt>
                      <dd class="mt-0.5 text-sm text-surface-fg">
                        {{ record.admission.attendingDoctor }}
                      </dd>
                    </div>
                  </dl>
                }
                @case ('discharged') {
                  <dl class="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                    <div>
                      <dt class="text-xs text-surface-fg-muted">Admitted</dt>
                      <dd class="mt-0.5 text-sm text-surface-fg">
                        {{ record.admission.admittedAt | hmsDate: true }}
                      </dd>
                    </div>
                    <div>
                      <dt class="text-xs text-surface-fg-muted">Discharged</dt>
                      <dd class="mt-0.5 text-sm text-surface-fg">
                        {{ record.admission.dischargedAt | hmsDate: true }}
                      </dd>
                    </div>
                  </dl>
                }
                @default {
                  <hms-empty-state
                    title="Not currently admitted"
                    description="This patient is being seen as an outpatient."
                  />
                }
              }
            </hms-card>
          }
        }
      </div>

      @if (dialog() !== null) {
        <hms-admission-dialog
          [patient]="record"
          [mode]="dialog()!"
          (closed)="dialog.set(null)"
          (completed)="onAdmissionChanged($event)"
        />
      }
    } @else {
      <hms-card>
        <hms-empty-state
          title="Patient not found"
          description="The record may have been removed or you followed an out-of-date link."
        />
      </hms-card>
    }
  `,
})
export class PatientDetailComponent {
  protected readonly patients = inject(PatientService);
  private readonly wards = inject(WardService);
  private readonly permissions = inject(PermissionService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly datePipe = new HmsDatePipe();

  readonly id = input.required<string>();

  protected readonly tab = signal<DetailTab>('overview');
  protected readonly dialog = signal<'admit' | 'discharge' | null>(null);

  protected readonly tabs: readonly { id: DetailTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'history', label: 'Medical history' },
    { id: 'admission', label: 'Admission' },
  ];

  protected readonly patient = this.patients.selectedPatient;
  protected readonly history = this.patients.history;
  protected readonly canManage = this.permissions.hasPermission('patients.manage');
  protected readonly canAdmit = this.permissions.hasPermission('patients.admit');

  protected readonly overviewRows = computed(() => {
    const record = this.patient();
    if (record === undefined) {
      return [];
    }
    return [
      { label: 'Date of birth', value: this.datePipe.transform(record.dateOfBirth) },
      { label: 'Phone', value: record.phone },
      { label: 'Email', value: record.email ?? '—' },
      { label: 'NID', value: record.nid ?? '—' },
      { label: 'Address', value: record.address },
      { label: 'Emergency contact', value: record.emergencyContactName ?? '—' },
      { label: 'Emergency phone', value: record.emergencyContactPhone ?? '—' },
      { label: 'Registered', value: this.datePipe.transform(record.registeredAt, true) },
    ];
  });

  constructor() {
    effect(() => {
      const parsed = Number(this.id());
      this.patients.select(Number.isFinite(parsed) ? parsed : null);
    });
  }

  protected genderLabel(gender: keyof typeof GENDER_LABELS): string {
    return GENDER_LABELS[gender];
  }

  protected typeLabel(type: keyof typeof PATIENT_TYPE_LABELS): string {
    return PATIENT_TYPE_LABELS[type];
  }

  protected historyTone(category: MedicalHistoryEntry['category']): 'critical' | 'info' | 'pending' | 'neutral' {
    return HISTORY_TONES[category];
  }

  protected onAdmissionChanged(message: string): void {
    this.dialog.set(null);
    this.toast.success(message);
    // Bed counts changed, so the ward views are stale too.
    this.wards.reload();
  }

  protected async back(): Promise<void> {
    await this.router.navigate(['/patients']);
  }
}
