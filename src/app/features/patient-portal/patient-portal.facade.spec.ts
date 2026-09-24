import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { PatientPortalFacade } from './patient-portal.facade';
import { AuthService } from '../../core/auth/auth.service';
import { provideAppConfig } from '../../core/config/app-config';
import { authInterceptor } from '../../core/interceptors/auth.interceptor';
import { errorInterceptor } from '../../core/interceptors/error.interceptor';
import { mockApiInterceptor } from '../../core/interceptors/mock-api.interceptor';
import { db } from '../../core/mock/db';

async function setup(username = 'patient'): Promise<PatientPortalFacade> {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: 'auth/login', children: [] }]),
      provideAppConfig({ mockLatencyMs: [0, 0], pageSize: 50 }),
      provideHttpClient(withInterceptors([errorInterceptor, authInterceptor, mockApiInterceptor])),
    ],
  });
  await TestBed.inject(AuthService).login({ username, password: 'demo1234' });
  return TestBed.inject(PatientPortalFacade);
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

/** The signed-in demo patient is linked to patient record #1. */
const OWN_PATIENT_ID = 1;

describe('PatientPortalFacade', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('lists only the signed-in patient’s own reports', async () => {
    const portal = await setup();
    await settle(portal.isReportsLoading);

    const reports = portal.reports()!.items;
    expect(reports.length).toBeGreaterThan(0);
    expect(reports.every((report) => report.patientId === OWN_PATIENT_ID)).toBe(true);

    // Sanity check the fixture actually contains other patients' reports, so
    // the assertion above is not passing vacuously.
    expect(db.reports.some((row) => row.patient !== OWN_PATIENT_ID)).toBe(true);
  });

  it('refuses a download URL for another patient’s report, without revealing it exists', async () => {
    const portal = await setup();
    await settle(portal.isReportsLoading);

    const someoneElse = db.reports.find((row) => row.patient !== OWN_PATIENT_ID)!;

    try {
      await portal.requestDownloadUrl(someoneElse.id);
      throw new Error('expected the request to be refused');
    } catch (error: unknown) {
      // 404, not 403: a 403 would confirm the id belongs to a real report.
      expect((error as { status?: number }).status).toBe(404);
    }
  });

  it('blocks staff roles from the portal endpoints entirely', async () => {
    await setup('doctor');
    const http = TestBed.inject(HttpClient);

    try {
      await firstValueFrom(http.get('/api/portal/reports/'));
      throw new Error('expected the request to be refused');
    } catch (error: unknown) {
      expect((error as { status?: number }).status).toBe(403);
    }
  });

  it('mints a short-lived download ticket only at request time', async () => {
    const portal = await setup();
    await settle(portal.isReportsLoading);

    const ready = portal.reports()!.items.find((report) => report.status === 'ready')!;
    const ticket = await portal.requestDownloadUrl(ready.id);

    expect(ticket.url).toContain(`/portal/reports/${ready.id}/`);
    expect(ticket.url).toContain('sig=');
    expect(ticket.filename).toMatch(/\.pdf$/);
    expect(new Date(ticket.expiresAt).getTime()).toBeGreaterThan(Date.now());

    // Each request is signed afresh, so a leaked URL cannot be replayed forever.
    const second = await portal.requestDownloadUrl(ready.id);
    expect(second.url).not.toBe(ticket.url);
  });

  it('records a ReportDownloaded audit event and flips the status', async () => {
    const portal = await setup();
    await settle(portal.isReportsLoading);

    const ready = portal.reports()!.items.find((report) => report.status === 'ready')!;
    const auditBefore = db.reportDownloads.length;

    await portal.download(ready);
    await settle(portal.isReportsLoading);

    expect(db.reportDownloads.length).toBe(auditBefore + 1);
    const entry = db.reportDownloads[0]!;
    expect(entry.report).toBe(ready.id);
    expect(entry.patient).toBe(OWN_PATIENT_ID);
    expect(Date.parse(entry.downloaded_at)).not.toBeNaN();

    const refreshed = portal.reports()!.items.find((report) => report.id === ready.id)!;
    expect(refreshed.status).toBe('downloaded');
    expect(refreshed.downloadedAt).not.toBeNull();
  });

  it('refuses a download URL for a report that is not ready', async () => {
    const portal = await setup();
    await settle(portal.isReportsLoading);

    // Force one of the patient's own reports back to pending.
    const index = db.reports.findIndex((row) => row.patient === OWN_PATIENT_ID);
    const original = db.reports[index]!;
    db.reports[index] = { ...original, status: 'pending' };

    try {
      await portal.requestDownloadUrl(original.id);
      throw new Error('expected the request to be refused');
    } catch (error: unknown) {
      expect((error as { status?: number }).status).toBe(409);
    } finally {
      db.reports[index] = original;
    }
  });

  it('aggregates reports, appointments and profile into one summary', async () => {
    const portal = await setup();
    await settle(portal.isAppointmentsLoading);
    await settle(portal.isReportsLoading);

    const summary = portal.summary();
    expect(summary.patientName).toBeTruthy();
    expect(summary.totalReports).toBeGreaterThan(0);
    expect(summary.readyCount + summary.pendingCount).toBeLessThanOrEqual(summary.totalReports);

    // Upcoming appointments are the patient's own and sorted soonest-first.
    const upcoming = portal.upcomingAppointments();
    expect(upcoming.every((appointment) => appointment.patientId === OWN_PATIENT_ID)).toBe(true);
    const keys = upcoming.map((a) => `${a.date}${a.startTime}`);
    expect([...keys].sort()).toEqual(keys);
  });

  it('does not fetch portal data at all when the session is not a patient', async () => {
    const portal = await setup('nurse');
    await settle();

    // The resources are skipped rather than issuing a request that would 403.
    expect(portal.reports()).toBeUndefined();
    expect(portal.appointments()).toEqual([]);
  });
});
