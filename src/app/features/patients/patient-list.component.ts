import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  viewChild,
  type TemplateRef,
} from '@angular/core';
import { Router } from '@angular/router';
import { PatientService, WardService } from './patient.service';
import { PermissionService } from '../../core/auth/permission.service';
import { CardComponent } from '../../shared/ui/card/card.component';
import { PageHeaderComponent } from '../../shared/ui/page-header/page-header.component';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { BadgeComponent } from '../../shared/ui/badge/badge.component';
import { DataTableComponent } from '../../shared/ui/data-table/data-table.component';
import { PaginationComponent } from '../../shared/ui/pagination/pagination.component';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { AgePipe, HmsDatePipe } from '../../shared/pipes/hms-pipes';
import {
  toOrdering,
  type CellContext,
  type ColumnDef,
  type SortState,
} from '../../shared/ui/data-table/data-table.model';
import { GENDER_LABELS, PATIENT_TYPE_LABELS, type Patient, type PatientType, type Gender } from '../../shared/models/patient.model';

/** Plain-text fallback used before the cell templates resolve. */
function statusLabel(patient: Patient): string {
  switch (patient.admission.status) {
    case 'admitted':
      return `${patient.admission.wardName} · ${patient.admission.bedNumber}`;
    case 'discharged':
      return 'Discharged';
    default:
      return PATIENT_TYPE_LABELS[patient.type];
  }
}

@Component({
  selector: 'hms-patient-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CardComponent,
    PageHeaderComponent,
    ButtonComponent,
    BadgeComponent,
    DataTableComponent,
    PaginationComponent,
    IconComponent,
  ],
  template: `
    <hms-page-header
      heading="Patients"
      description="Registered patients across outpatient and inpatient care."
    >
      @if (canManage()) {
        <hms-button (pressed)="register()">Register patient</hms-button>
      }
    </hms-page-header>

    <!-- Cell templates, referenced by the column definitions below. -->
    <ng-template #nameCell let-patient>
      <div class="min-w-0">
        <p class="truncate font-medium text-surface-fg">{{ patient.fullName }}</p>
        <p class="truncate font-mono text-xs text-surface-fg-muted">{{ patient.mrn }}</p>
      </div>
    </ng-template>

    <ng-template #typeCell let-patient>
      @switch (patient.admission.status) {
        @case ('admitted') {
          <hms-badge tone="info">
            {{ patient.admission.wardName }} · {{ patient.admission.bedNumber }}
          </hms-badge>
        }
        @case ('discharged') {
          <hms-badge tone="neutral">Discharged</hms-badge>
        }
        @default {
          <hms-badge tone="neutral">Outpatient</hms-badge>
        }
      }
    </ng-template>

    <ng-template #bloodCell let-patient>
      @if (patient.bloodGroup !== null) {
        <span class="font-mono text-xs font-semibold text-status-critical-strong">
          {{ patient.bloodGroup }}
        </span>
      } @else {
        <span class="text-surface-fg-muted">—</span>
      }
    </ng-template>

    <hms-card [padded]="false">
      <div
        class="flex flex-wrap items-center gap-2 border-b border-surface-border p-3"
        role="search"
      >
        <label class="relative min-w-0 flex-1 sm:max-w-xs">
          <span class="sr-only-focusable">Search patients</span>
          <span
            class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-surface-fg-muted"
          >
            <hms-icon name="search" [size]="16" />
          </span>
          <input
            type="search"
            placeholder="Name, MRN, phone or NID"
            class="h-9 w-full rounded-control bg-surface pl-9 pr-3 text-sm text-surface-fg ring-1 ring-inset ring-surface-border placeholder:text-surface-fg-muted focus:ring-2 focus:ring-brand-500"
            [value]="query().search"
            (input)="onSearch($event)"
          />
        </label>

        <label class="flex items-center gap-1.5">
          <span class="sr-only-focusable">Filter by patient type</span>
          <select
            class="h-9 rounded-control bg-surface px-2 text-sm text-surface-fg ring-1 ring-inset ring-surface-border focus:ring-2 focus:ring-brand-500"
            [value]="query().type"
            (change)="onTypeChange($event)"
          >
            <option value="">All types</option>
            <option value="opd">Outpatient</option>
            <option value="ipd">Inpatient</option>
          </select>
        </label>

        <label class="flex items-center gap-1.5">
          <span class="sr-only-focusable">Filter by gender</span>
          <select
            class="h-9 rounded-control bg-surface px-2 text-sm text-surface-fg ring-1 ring-inset ring-surface-border focus:ring-2 focus:ring-brand-500"
            [value]="query().gender"
            (change)="onGenderChange($event)"
          >
            <option value="">All genders</option>
            @for (entry of genderOptions; track entry.value) {
              <option [value]="entry.value">{{ entry.label }}</option>
            }
          </select>
        </label>

        <label class="flex items-center gap-1.5">
          <span class="sr-only-focusable">Filter by ward</span>
          <select
            class="h-9 rounded-control bg-surface px-2 text-sm text-surface-fg ring-1 ring-inset ring-surface-border focus:ring-2 focus:ring-brand-500"
            [value]="query().ward"
            (change)="onWardChange($event)"
          >
            <option value="">All wards</option>
            @for (ward of wards(); track ward.id) {
              <option [value]="ward.id">{{ ward.name }}</option>
            }
          </select>
        </label>

        @if (hasFilters()) {
          <hms-button variant="ghost" size="sm" (pressed)="patients.resetQuery()">
            Clear
          </hms-button>
        }
      </div>

      <hms-data-table
        [rows]="rows()"
        [columns]="columns()"
        [trackBy]="trackById"
        [loading]="patients.isLoading()"
        [ordering]="query().ordering"
        [selectable]="true"
        [rowLabel]="rowLabel"
        caption="Patient records"
        emptyTitle="No patients match these filters"
        (sortChanged)="onSort($event)"
        (rowActivated)="openPatient($event)"
      />

      @if (page(); as currentPage) {
        <hms-pagination
          [page]="currentPage.page"
          [totalPages]="currentPage.totalPages"
          [total]="currentPage.total"
          [pageSize]="currentPage.pageSize"
          (pageChanged)="patients.setPage($event)"
        />
      }
    </hms-card>
  `,
})
export class PatientListComponent {
  protected readonly patients = inject(PatientService);
  private readonly wardService = inject(WardService);
  private readonly permissions = inject(PermissionService);
  private readonly router = inject(Router);
  private readonly agePipe = new AgePipe();
  private readonly datePipe = new HmsDatePipe();

  // Not `.required`: the columns computed is read during the same change
  // detection pass that resolves these queries, so each column also carries a
  // plain-text `cell` fallback for the first render.
  private readonly nameCell = viewChild<TemplateRef<CellContext<Patient>>>('nameCell');
  private readonly typeCell = viewChild<TemplateRef<CellContext<Patient>>>('typeCell');
  private readonly bloodCell = viewChild<TemplateRef<CellContext<Patient>>>('bloodCell');

  protected readonly query = this.patients.query;
  protected readonly page = this.patients.patients;
  protected readonly wards = this.wardService.wards;
  protected readonly canManage = this.permissions.hasPermission('patients.manage');

  protected readonly genderOptions = Object.entries(GENDER_LABELS).map(([value, label]) => ({
    value,
    label,
  }));

  protected readonly rows = computed<readonly Patient[]>(() => this.page()?.items ?? []);

  protected readonly hasFilters = computed(() => {
    const current = this.query();
    return (
      current.search !== '' || current.type !== '' || current.gender !== '' || current.ward !== ''
    );
  });

  protected readonly columns = computed<readonly ColumnDef<Patient>[]>(() => [
    {
      key: 'name',
      header: 'Patient',
      template: this.nameCell(),
      cell: (patient) => patient.fullName,
      sortField: 'full_name',
    },
    {
      key: 'age',
      header: 'Age',
      cell: (patient) => this.agePipe.transform(patient.dateOfBirth),
      sortField: 'date_of_birth',
      align: 'right',
      width: '5rem',
    },
    {
      key: 'gender',
      header: 'Gender',
      cell: (patient) => GENDER_LABELS[patient.gender],
      hideOnMobile: true,
      width: '7rem',
    },
    {
      key: 'blood',
      header: 'Blood',
      template: this.bloodCell(),
      cell: (patient) => patient.bloodGroup ?? '—',
      align: 'center',
      hideOnMobile: true,
      width: '6rem',
    },
    { key: 'phone', header: 'Phone', cell: (patient) => patient.phone, hideOnMobile: true },
    {
      key: 'status',
      header: 'Status',
      template: this.typeCell(),
      cell: (patient) => statusLabel(patient),
    },
    {
      key: 'registered',
      header: 'Registered',
      cell: (patient) => this.datePipe.transform(patient.registeredAt),
      sortField: 'registered_at',
      hideOnMobile: true,
      align: 'right',
    },
  ]);

  protected readonly trackById = (patient: Patient): number => patient.id;
  protected readonly rowLabel = (patient: Patient): string => `Open ${patient.fullName}`;

  protected onSearch(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.patients.patchQuery({ search: input.value });
  }

  protected onTypeChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.patients.patchQuery({ type: value === '' ? '' : (value as PatientType) });
  }

  protected onGenderChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.patients.patchQuery({ gender: value === '' ? '' : (value as Gender) });
  }

  protected onWardChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.patients.patchQuery({ ward: value === '' ? '' : Number(value) });
  }

  protected onSort(sort: SortState): void {
    this.patients.patchQuery({ ordering: toOrdering(sort) });
  }

  protected async openPatient(patient: Patient): Promise<void> {
    await this.router.navigate(['/patients', patient.id]);
  }

  protected async register(): Promise<void> {
    await this.router.navigate(['/patients', 'new']);
  }
}
