import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { PatientService, WardService } from './patient.service';
import { AuthService } from '../../core/auth/auth.service';
import { provideAppConfig } from '../../core/config/app-config';
import { authInterceptor } from '../../core/interceptors/auth.interceptor';
import { errorInterceptor } from '../../core/interceptors/error.interceptor';
import { mockApiInterceptor } from '../../core/interceptors/mock-api.interceptor';

/**
 * Integration coverage for the patients vertical: the service's resources run
 * through the real interceptor chain against the mock backend, so these assert
 * on query serialisation, DRF pagination and the admit/discharge side effects
 * rather than on a hand-stubbed HTTP layer.
 */
async function setup(): Promise<{ patients: PatientService; wards: WardService }> {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: 'auth/login', children: [] }]),
      provideAppConfig({ mockLatencyMs: [0, 0], pageSize: 10 }),
      // Same order as the app, so failures arrive as normalised ApiErrors.
      provideHttpClient(
        withInterceptors([errorInterceptor, authInterceptor, mockApiInterceptor]),
      ),
    ],
  });

  // The patients endpoints require a session, exactly as Django would.
  await TestBed.inject(AuthService).login({ username: 'admin', password: 'demo1234' });

  return {
    patients: TestBed.inject(PatientService),
    wards: TestBed.inject(WardService),
  };
}

/**
 * Flushes the signal graph so `httpResource` schedules its request, then waits
 * for it to land.
 *
 * `httpResource` keeps the previous value while refetching, so waiting on
 * `whenStable` alone can observe stale data after a query change. Polling on
 * the resource's own `isLoading()` is what actually says the new data arrived.
 */
async function settle(isLoading?: () => boolean): Promise<void> {
  const appRef = TestBed.inject(ApplicationRef);
  for (let attempt = 0; attempt < 50; attempt++) {
    appRef.tick();
    await appRef.whenStable();
    // Let the mock's zero-length latency timer fire.
    await new Promise((resolve) => setTimeout(resolve, 0));
    // `attempt > 2` matters: a resource that has not started yet also reports
    // `isLoading() === false`, so returning on the first pass would read a
    // resource that never fetched.
    if (isLoading !== undefined && !isLoading() && attempt > 2) {
      return;
    }
    if (isLoading === undefined && attempt >= 2) {
      return;
    }
  }
}

describe('PatientService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('loads the first page of patients through DRF pagination', async () => {
    const { patients } = await setup();
    await settle();

    const page = patients.patients();
    expect(page).toBeDefined();
    expect(page!.items.length).toBe(10);
    expect(page!.total).toBeGreaterThan(10);
    expect(page!.page).toBe(1);
    expect(page!.hasPrevious).toBe(false);
    expect(page!.hasNext).toBe(true);
  });

  it('maps rows into domain models, not raw DTOs', async () => {
    const { patients } = await setup();
    await settle();

    const first = patients.patients()!.items[0]!;
    expect(first.fullName).toBeTruthy();
    expect(first.mrn).toMatch(/^HMS-2026-\d{4}$/);
    expect(first.admission.status).toMatch(/^(none|admitted|discharged)$/);
    // The snake_case key must not survive the mapper.
    expect((first as unknown as Record<string, unknown>)['full_name']).toBeUndefined();
  });

  it('filters by patient type server-side', async () => {
    const { patients } = await setup();
    await settle();

    patients.patchQuery({ type: 'ipd' });
    await settle(patients.isLoading);

    const items = patients.patients()!.items;
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((patient) => patient.type === 'ipd')).toBe(true);
  });

  it('resets to page 1 when a filter changes', async () => {
    const { patients } = await setup();
    await settle();

    patients.setPage(2);
    await settle(patients.isLoading);
    expect(patients.query().page).toBe(2);

    patients.patchQuery({ search: 'a' });
    expect(patients.query().page).toBe(1);
  });

  it('searches across name and MRN', async () => {
    const { patients } = await setup();
    await settle();

    const target = patients.patients()!.items[0]!;
    patients.patchQuery({ search: target.mrn });
    await settle(patients.isLoading);

    const results = patients.patients()!.items;
    expect(results.length).toBe(1);
    expect(results[0]!.id).toBe(target.id);
  });

  it('creates a patient and surfaces DRF field errors on invalid input', async () => {
    const { patients } = await setup();
    await settle();

    const created = await patients.create({
      fullName: 'Test Patient',
      gender: 'male',
      dateOfBirth: '1995-02-01',
      bloodGroup: 'O+',
      phone: '01712349999',
      email: '',
      nid: '',
      address: 'Uttara, Dhaka',
      type: 'opd',
      emergencyContactName: '',
      emergencyContactPhone: '',
      allergies: 'Latex, Iodine',
    });

    expect(created.id).toBeGreaterThan(0);
    expect(created.mrn).toMatch(/^HMS-2026-\d{4}$/);
    expect(created.allergies).toEqual(['Latex', 'Iodine']);

    await expectRejection(
      patients.create({
        fullName: '',
        gender: 'male',
        dateOfBirth: '',
        bloodGroup: '',
        phone: 'nope',
        email: '',
        nid: '',
        address: '',
        type: 'opd',
        emergencyContactName: '',
        emergencyContactPhone: '',
        allergies: '',
      }),
      ['full_name', 'date_of_birth', 'phone'],
    );
  });

  it('admitting occupies a bed and raises ward occupancy', async () => {
    const { patients, wards } = await setup();
    await settle();

    const outpatient = patients.patients()!.items.find((row) => row.admission.status === 'none')!;
    const wardId = wards.wards()[0]!.id;
    wards.selectWard(wardId);
    await settle(wards.isBedsLoading);

    const bed = wards.availableBeds()[0]!;
    const occupiedBefore = wards.wards().find((ward) => ward.id === wardId)!.occupiedBeds;

    const admitted = await patients.admit({
      patientId: outpatient.id,
      wardId,
      bedId: bed.id,
      attendingDoctorId: 0,
      attendingDoctorName: 'Dr. Test',
      reason: 'Observation',
    });

    expect(admitted.admission.status).toBe('admitted');
    expect(admitted.type).toBe('ipd');

    wards.reload();
    await settle(wards.isBedsLoading);

    expect(wards.wards().find((ward) => ward.id === wardId)!.occupiedBeds).toBe(occupiedBefore + 1);
    expect(wards.beds().find((row) => row.id === bed.id)!.status).toBe('occupied');
    expect(wards.availableBeds().some((row) => row.id === bed.id)).toBe(false);
  });

  it('refuses to admit a patient who is already admitted', async () => {
    const { patients, wards } = await setup();
    await settle();

    patients.patchQuery({ type: 'ipd' });
    await settle(patients.isLoading);

    const inpatient = patients.patients()!.items.find((row) => row.admission.status === 'admitted')!;
    wards.selectWard(wards.wards()[0]!.id);
    await settle(wards.isBedsLoading);

    await expectStatus(
      patients.admit({
        patientId: inpatient.id,
        wardId: wards.wards()[0]!.id,
        bedId: wards.availableBeds()[0]!.id,
        attendingDoctorId: 0,
        attendingDoctorName: 'Dr. Test',
        reason: 'Duplicate',
      }),
      409,
    );
  });

  it('discharging frees the bed for cleaning and lowers occupancy', async () => {
    const { patients, wards } = await setup();
    await settle();

    patients.patchQuery({ type: 'ipd' });
    await settle(patients.isLoading);

    const inpatient = patients.patients()!.items.find((row) => row.admission.status === 'admitted')!;
    if (inpatient.admission.status !== 'admitted') {
      throw new Error('expected an admitted patient');
    }
    const { admissionId, wardId, bedId } = inpatient.admission;

    wards.selectWard(wardId);
    await settle(wards.isBedsLoading);
    const occupiedBefore = wards.wards().find((ward) => ward.id === wardId)!.occupiedBeds;

    const discharged = await patients.discharge(inpatient.id, {
      admissionId,
      summary: 'Recovered well.',
      followUpDate: '',
    });

    expect(discharged.admission.status).toBe('discharged');
    expect(discharged.type).toBe('opd');

    wards.reload();
    await settle(wards.isBedsLoading);

    expect(wards.wards().find((ward) => ward.id === wardId)!.occupiedBeds).toBe(occupiedBefore - 1);
    // Cleaning, not straight back to available.
    expect(wards.beds().find((row) => row.id === bedId)!.status).toBe('cleaning');
  });
});

async function expectRejection(promise: Promise<unknown>, fields: readonly string[]): Promise<void> {
  try {
    await promise;
    throw new Error('expected the request to be rejected');
  } catch (error: unknown) {
    const apiError = error as { status?: number; fieldErrors?: Record<string, string[]> };
    expect(apiError.status).toBe(400);
    for (const field of fields) {
      expect(apiError.fieldErrors?.[field]).toBeDefined();
    }
  }
}

async function expectStatus(promise: Promise<unknown>, status: number): Promise<void> {
  try {
    await promise;
    throw new Error('expected the request to be rejected');
  } catch (error: unknown) {
    expect((error as { status?: number }).status).toBe(status);
  }
}
