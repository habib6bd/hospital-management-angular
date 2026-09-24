import { Injectable, computed, inject, linkedSignal, signal } from '@angular/core';
import { HttpClient, httpResource } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { APP_CONFIG } from '../../core/config/app-config';
import { mapPage, toQueryParams, type Page, type PaginatedDto } from '../../core/http/paginated';
import {
  toBed,
  toMedicalHistoryEntry,
  toPatient,
  toPatientWriteDto,
  toWard,
  type BedDto,
  type MedicalHistoryEntryDto,
  type PatientDto,
  type WardDto,
} from '../../shared/models/patient.dto';
import type {
  AdmissionInput,
  Bed,
  DischargeInput,
  Gender,
  MedicalHistoryEntry,
  Patient,
  PatientInput,
  PatientType,
  Ward,
} from '../../shared/models/patient.model';

export interface PatientListQuery {
  readonly page: number;
  readonly pageSize: number;
  readonly search: string;
  readonly type: PatientType | '';
  readonly gender: Gender | '';
  readonly ward: number | '';
  readonly ordering: string;
}

/**
 * Repository contract. Components depend on this, never on `PatientService`
 * directly, so a test can supply a fake and a future backend swap is local.
 */
export interface PatientRepository {
  readonly patients: () => Page<Patient> | undefined;
  readonly isLoading: () => boolean;
  create(input: PatientInput): Promise<Patient>;
  update(id: number, input: PatientInput): Promise<Patient>;
  admit(input: AdmissionInput & { attendingDoctorName: string }): Promise<Patient>;
  discharge(patientId: number, input: DischargeInput): Promise<Patient>;
}

/**
 * Explicit UI-query → DRF-param mapping. Spreading the query object directly
 * would silently drop any field whose UI name differs from the API's (`type`
 * vs `patient_type`), and the filter would just appear not to work.
 */
function toPatientParams(query: PatientListQuery): Record<string, string> {
  return toQueryParams({
    page: query.page,
    page_size: query.pageSize,
    search: query.search,
    patient_type: query.type,
    gender: query.gender,
    ward: query.ward,
    ordering: query.ordering,
  });
}

function defaultQuery(pageSize: number): PatientListQuery {
  return {
    page: 1,
    pageSize,
    search: '',
    type: '',
    gender: '',
    ward: '',
    ordering: '-registered_at',
  };
}

@Injectable({ providedIn: 'root' })
export class PatientService implements PatientRepository {
  private readonly http = inject(HttpClient);
  private readonly config = inject(APP_CONFIG);
  private readonly baseUrl = `${this.config.apiBaseUrl}/patients`;

  private readonly queryState = signal<PatientListQuery>(defaultQuery(this.config.pageSize));

  readonly query = this.queryState.asReadonly();

  /**
   * The list resource re-fetches whenever the query signal changes. No manual
   * subscribe/unsubscribe, and no `isLoading` boolean of our own.
   */
  private readonly listResource = httpResource<PaginatedDto<PatientDto>>(() => ({
    url: `${this.baseUrl}/`,
    params: toPatientParams(this.queryState()),
  }));

  readonly patients = computed<Page<Patient> | undefined>(() => {
    const value = this.listResource.value();
    if (value === undefined) {
      return undefined;
    }
    const { page, pageSize } = this.queryState();
    return mapPage(value, toPatient, page, pageSize);
  });

  readonly isLoading = this.listResource.isLoading;
  readonly listError = this.listResource.error;

  /**
   * Selected patient id drives the detail resource. `linkedSignal` so that
   * changing the selection resets any local detail state derived from it.
   */
  private readonly selectedId = signal<number | null>(null);

  private readonly detailResource = httpResource<PatientDto>(() => {
    const id = this.selectedId();
    return id === null ? undefined : { url: `${this.baseUrl}/${id}/` };
  });

  readonly selectedPatient = computed<Patient | undefined>(() => {
    const value = this.detailResource.value();
    return value === undefined ? undefined : toPatient(value);
  });

  readonly isDetailLoading = this.detailResource.isLoading;
  readonly detailError = this.detailResource.error;

  private readonly historyResource = httpResource<PaginatedDto<MedicalHistoryEntryDto>>(() => {
    const id = this.selectedId();
    return id === null ? undefined : { url: `${this.baseUrl}/${id}/history/` };
  });

  readonly history = computed<readonly MedicalHistoryEntry[]>(
    () => this.historyResource.value()?.results.map(toMedicalHistoryEntry) ?? [],
  );

  readonly isHistoryLoading = this.historyResource.isLoading;

  /* ------------------------------------------------------------- queries */

  select(id: number | null): void {
    this.selectedId.set(id);
  }

  /** Patching the query always resets to page 1 unless the page itself changed. */
  patchQuery(changes: Partial<PatientListQuery>): void {
    this.queryState.update((current) => ({
      ...current,
      ...changes,
      page: changes.page ?? 1,
    }));
  }

  setPage(page: number): void {
    this.queryState.update((current) => ({ ...current, page }));
  }

  resetQuery(): void {
    this.queryState.set(defaultQuery(this.config.pageSize));
  }

  reload(): void {
    this.listResource.reload();
  }

  /* -------------------------------------------------------------- writes */

  async create(input: PatientInput): Promise<Patient> {
    const dto = await firstValueFrom(
      this.http.post<PatientDto>(`${this.baseUrl}/`, toPatientWriteDto(input)),
    );
    this.listResource.reload();
    return toPatient(dto);
  }

  async update(id: number, input: PatientInput): Promise<Patient> {
    const dto = await firstValueFrom(
      this.http.patch<PatientDto>(`${this.baseUrl}/${id}/`, toPatientWriteDto(input)),
    );
    this.listResource.reload();
    if (this.selectedId() === id) {
      this.detailResource.reload();
    }
    return toPatient(dto);
  }

  async admit(input: AdmissionInput & { attendingDoctorName: string }): Promise<Patient> {
    const dto = await firstValueFrom(
      this.http.post<PatientDto>(`${this.baseUrl}/${input.patientId}/admit/`, {
        ward: input.wardId,
        bed: input.bedId,
        attending_doctor_name: input.attendingDoctorName,
        reason: input.reason,
      }),
    );
    this.afterAdmissionChange(input.patientId);
    return toPatient(dto);
  }

  async discharge(patientId: number, input: DischargeInput): Promise<Patient> {
    const dto = await firstValueFrom(
      this.http.post<PatientDto>(`${this.baseUrl}/${patientId}/discharge/`, {
        admission: input.admissionId,
        summary: input.summary,
        follow_up_date: input.followUpDate === '' ? null : input.followUpDate,
      }),
    );
    this.afterAdmissionChange(patientId);
    return toPatient(dto);
  }

  async addHistoryEntry(
    patientId: number,
    entry: { category: MedicalHistoryEntry['category']; title: string; details: string },
  ): Promise<MedicalHistoryEntry> {
    const dto = await firstValueFrom(
      this.http.post<MedicalHistoryEntryDto>(`${this.baseUrl}/${patientId}/history/`, entry),
    );
    this.historyResource.reload();
    return toMedicalHistoryEntry(dto);
  }

  /** Admission changes move a bed and a ward count, so both views are stale. */
  private afterAdmissionChange(patientId: number): void {
    this.listResource.reload();
    if (this.selectedId() === patientId) {
      this.detailResource.reload();
    }
  }
}

/** Wards and beds change rarely and are read by several features, so they sit apart. */
@Injectable({ providedIn: 'root' })
export class WardService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(APP_CONFIG);
  private readonly baseUrl = `${this.config.apiBaseUrl}/wards`;

  private readonly wardsResource = httpResource<PaginatedDto<WardDto>>(() => `${this.baseUrl}/`);

  readonly wards = computed<readonly Ward[]>(
    () => this.wardsResource.value()?.results.map(toWard) ?? [],
  );
  readonly isLoading = this.wardsResource.isLoading;

  readonly totalBeds = computed(() =>
    this.wards().reduce((sum, ward) => sum + ward.totalBeds, 0),
  );
  readonly occupiedBeds = computed(() =>
    this.wards().reduce((sum, ward) => sum + ward.occupiedBeds, 0),
  );
  readonly occupancyRate = computed(() => {
    const total = this.totalBeds();
    return total === 0 ? 0 : this.occupiedBeds() / total;
  });

  /** Selected ward drives the bed grid. */
  private readonly selectedWardId = signal<number | null>(null);

  /** Defaults to the first ward once the list loads, but a user choice wins. */
  readonly activeWardId = linkedSignal<readonly Ward[], number | null>({
    source: this.wards,
    computation: (wards, previous) => {
      const explicit = this.selectedWardId();
      if (explicit !== null && wards.some((ward) => ward.id === explicit)) {
        return explicit;
      }
      const previousId = previous?.value ?? null;
      if (previousId !== null && wards.some((ward) => ward.id === previousId)) {
        return previousId;
      }
      return wards[0]?.id ?? null;
    },
  });

  private readonly bedsResource = httpResource<PaginatedDto<BedDto>>(() => {
    const wardId = this.activeWardId();
    return wardId === null ? undefined : { url: `${this.baseUrl}/${wardId}/beds/` };
  });

  readonly beds = computed<readonly Bed[]>(
    () => this.bedsResource.value()?.results.map(toBed) ?? [],
  );
  readonly isBedsLoading = this.bedsResource.isLoading;

  readonly availableBeds = computed(() => this.beds().filter((bed) => bed.status === 'available'));

  selectWard(wardId: number): void {
    this.selectedWardId.set(wardId);
  }

  reload(): void {
    this.wardsResource.reload();
    this.bedsResource.reload();
  }

  async releaseBed(wardId: number, bedId: number): Promise<void> {
    await firstValueFrom(
      this.http.post(`${this.baseUrl}/${wardId}/beds/${bedId}/release/`, {}),
    );
    this.reload();
  }
}
