import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { LabService } from './lab.service';
import { PatientPortalFacade } from '../patient-portal/patient-portal.facade';
import { AuthService } from '../../core/auth/auth.service';
import { provideAppConfig } from '../../core/config/app-config';
import { authInterceptor } from '../../core/interceptors/auth.interceptor';
import { errorInterceptor } from '../../core/interceptors/error.interceptor';
import { mockApiInterceptor } from '../../core/interceptors/mock-api.interceptor';
import { flagFor } from '../../shared/models/lab.model';

function configure(): void {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: 'auth/login', children: [] }]),
      provideAppConfig({ mockLatencyMs: [0, 0], pageSize: 20 }),
      provideHttpClient(withInterceptors([errorInterceptor, authInterceptor, mockApiInterceptor])),
    ],
  });
}

async function setup(username = 'lab'): Promise<LabService> {
  configure();
  await TestBed.inject(AuthService).login({ username, password: 'demo1234' });
  return TestBed.inject(LabService);
}

async function settle(isLoading?: () => boolean): Promise<void> {
  const appRef = TestBed.inject(ApplicationRef);
  for (let attempt = 0; attempt < 50; attempt++) {
    appRef.tick();
    await appRef.whenStable();
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

describe('flagFor', () => {
  it('flags values against the reference interval', () => {
    expect(flagFor('12.0', 13, 17)).toBe('low');
    expect(flagFor('18.5', 13, 17)).toBe('high');
    expect(flagFor('15', 13, 17)).toBe('normal');
  });

  it('treats a one-sided range correctly', () => {
    // Cholesterol has an upper bound only.
    expect(flagFor('250', null, 200)).toBe('high');
    expect(flagFor('150', null, 200)).toBe('normal');
    // Vitamin D has a lower bound that matters clinically.
    expect(flagFor('12', 30, null)).toBe('low');
  });

  it('reports non-numeric results rather than guessing', () => {
    expect(flagFor('Trace protein', null, null)).toBe('non_numeric');
    expect(flagFor('', 13, 17)).toBe('non_numeric');
  });

  it('uses inclusive bounds', () => {
    expect(flagFor('13', 13, 17)).toBe('normal');
    expect(flagFor('17', 13, 17)).toBe('normal');
  });
});

describe('LabService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('splits the work queue by stage', async () => {
    const lab = await setup();
    await settle(lab.isPendingLoading);

    expect(lab.awaitingSample().every((order) => order.status === 'ordered')).toBe(true);
    expect(lab.awaitingAnalysis().every((order) => order.status === 'sample_collected')).toBe(true);
    expect(lab.inProgress().every((order) => order.status === 'in_progress')).toBe(true);
    expect(lab.urgentPending().every((order) => order.priority === 'urgent')).toBe(true);
    expect(lab.pendingCount()).toBeGreaterThan(0);
  });

  it('derives result flags from the reference range rather than the wire', async () => {
    const lab = await setup();
    await settle(lab.isLoading);

    lab.patchQuery({ status: 'completed' });
    await settle(lab.isLoading);

    const completed = lab.orders()!.items.find((order) => order.results.length > 0)!;
    for (const result of completed.results) {
      expect(result.flag).toBe(flagFor(result.value, result.referenceLow, result.referenceHigh));
    }
  });

  it('walks an order through collection, analysis and results', async () => {
    const lab = await setup();
    await settle(lab.isPendingLoading);

    const order = lab.awaitingSample()[0]!;

    const collected = await lab.transition(order.id, 'collect-sample');
    expect(collected.status).toBe('sample_collected');
    expect(collected.sampleId).toMatch(/^S-\d{5}$/);
    expect(collected.sampleCollectedAt).not.toBeNull();

    const started = await lab.transition(order.id, 'start');
    expect(started.status).toBe('in_progress');

    const completed = await lab.enterResults(
      order.id,
      started.tests.map((test) => ({ testId: test.id, value: '12.5', notes: '' })),
    );

    expect(completed.status).toBe('completed');
    expect(completed.results.length).toBe(started.tests.length);
    expect(completed.completedAt).not.toBeNull();
    // Completing the order issues the patient-facing report.
    expect(completed.reportId).not.toBeNull();
  });

  it('refuses to start analysis before the sample is collected', async () => {
    const lab = await setup();
    await settle(lab.isPendingLoading);

    const order = lab.awaitingSample()[0]!;
    try {
      await lab.transition(order.id, 'start');
      throw new Error('expected the transition to be refused');
    } catch (error: unknown) {
      expect((error as { status?: number }).status).toBe(409);
    }
  });

  it('rejects a partial result set rather than releasing an incomplete report', async () => {
    const lab = await setup();
    await settle(lab.isPendingLoading);

    // Find an order with more than one test so a partial set is possible.
    const order = lab.awaitingAnalysis().find((row) => row.tests.length > 1)!;

    try {
      await lab.enterResults(order.id, [
        { testId: order.tests[0]!.id, value: '10', notes: '' },
      ]);
      throw new Error('expected the save to be rejected');
    } catch (error: unknown) {
      const apiError = error as { status?: number; fieldErrors?: Record<string, string[]> };
      expect(apiError.status).toBe(400);
      expect(apiError.fieldErrors?.[`results.${order.tests[1]!.id}`]).toBeDefined();
    }
  });

  it('will not accept results on a cancelled order', async () => {
    const lab = await setup();
    await settle(lab.isPendingLoading);

    const order = lab.awaitingAnalysis()[0]!;
    await lab.transition(order.id, 'cancel');

    try {
      await lab.enterResults(
        order.id,
        order.tests.map((test) => ({ testId: test.id, value: '1', notes: '' })),
      );
      throw new Error('expected the save to be rejected');
    } catch (error: unknown) {
      expect((error as { status?: number }).status).toBe(409);
    }
  });
});

/**
 * The prompt's key flow, end to end: a technician releasing results must make
 * the report retrievable by that patient — and only that patient.
 */
describe('lab results reach the patient portal', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('issues a downloadable report to the right patient', async () => {
    const lab = await setup();
    await settle(lab.isPendingLoading);

    // Work on an order belonging to the demo patient (record #1).
    lab.patchQuery({ status: 'sample_collected' });
    await settle(lab.isLoading);

    let target = lab.orders()!.items.find((order) => order.patientId === 1);
    if (target === undefined) {
      // Otherwise create one for that patient and advance it.
      const created = await lab.order({
        patientId: 1,
        testIds: [1, 4],
        priority: 'routine',
        clinicalNotes: 'End-to-end check',
      });
      target = await lab.transition(created.id, 'collect-sample');
    }

    const released = await lab.enterResults(
      target.id,
      target.tests.map((test) => ({ testId: test.id, value: '11.2', notes: '' })),
    );
    expect(released.reportId).not.toBeNull();

    // Now sign in as that patient and confirm the report is retrievable.
    TestBed.resetTestingModule();
    configure();
    await TestBed.inject(AuthService).login({ username: 'patient', password: 'demo1234' });
    const portal = TestBed.inject(PatientPortalFacade);
    await settle(portal.isReportsLoading);

    const report = portal.reports()!.items.find((row) => row.id === released.reportId);
    expect(report).toBeDefined();
    expect(report!.status).toBe('ready');
    expect(report!.relatedOrderNumber).toBe(released.orderNumber);

    const ticket = await portal.requestDownloadUrl(report!.id);
    expect(ticket.url).toBeTruthy();
  });
});
