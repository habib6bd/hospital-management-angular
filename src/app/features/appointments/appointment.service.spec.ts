import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import {
  AppointmentService,
  DoctorService,
  addDays,
  startOfWeek,
  todayIso,
} from './appointment.service';
import { AuthService } from '../../core/auth/auth.service';
import { provideAppConfig } from '../../core/config/app-config';
import { authInterceptor } from '../../core/interceptors/auth.interceptor';
import { errorInterceptor } from '../../core/interceptors/error.interceptor';
import { mockApiInterceptor } from '../../core/interceptors/mock-api.interceptor';
import { toTimeSlot } from '../../shared/models/appointment.dto';

async function setup(): Promise<{ appointments: AppointmentService; doctors: DoctorService }> {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: 'auth/login', children: [] }]),
      provideAppConfig({ mockLatencyMs: [0, 0], pageSize: 10 }),
      provideHttpClient(withInterceptors([errorInterceptor, authInterceptor, mockApiInterceptor])),
    ],
  });
  await TestBed.inject(AuthService).login({ username: 'reception', password: 'demo1234' });
  return {
    appointments: TestBed.inject(AppointmentService),
    doctors: TestBed.inject(DoctorService),
  };
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

describe('date helpers', () => {
  it('starts weeks on Sunday', () => {
    // 2026-03-25 is a Wednesday.
    expect(startOfWeek('2026-03-25')).toBe('2026-03-22');
    expect(startOfWeek('2026-03-22')).toBe('2026-03-22');
  });

  it('adds days across month boundaries', () => {
    expect(addDays('2026-01-30', 3)).toBe('2026-02-02');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('AppointmentService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('loads a week of appointments grouped by day', async () => {
    const { appointments } = await setup();
    await settle(appointments.isWeekLoading);

    const days = appointments.weekDays();
    expect(days.length).toBe(7);
    expect(appointments.weekAppointments().length).toBeGreaterThan(0);

    const byDay = appointments.weekByDay();
    expect([...byDay.keys()]).toEqual([...days]);
    // Every appointment must land in its own day's bucket.
    for (const [date, items] of byDay) {
      expect(items.every((appointment) => appointment.date === date)).toBe(true);
    }
  });

  it('splits today’s queue into the three board columns', async () => {
    const { appointments } = await setup();
    await settle(appointments.isQueueLoading);

    expect(appointments.notArrived().every((a) => a.status === 'booked')).toBe(true);
    expect(appointments.waiting().every((a) => a.status === 'checked_in')).toBe(true);
    expect(appointments.inConsultation().every((a) => a.status === 'in_consultation')).toBe(true);

    // Nothing resolved should ever appear on the board.
    expect(
      appointments.queue().some((a) => ['completed', 'cancelled', 'no_show'].includes(a.status)),
    ).toBe(false);
    expect(appointments.queue().every((a) => a.date === todayIso())).toBe(true);
  });

  it('returns slots for a doctor, marking taken ones unavailable', async () => {
    const { appointments, doctors } = await setup();
    await settle(doctors.isLoading);

    const doctorId = doctors.doctors()[0]!.id;
    // Look a week ahead so the "already passed today" rule does not interfere.
    const date = findClinicDate(doctorId);

    const resource = TestBed.runInInjectionContext(() =>
      appointments.slotsFor(
        () => doctorId,
        () => date,
      ),
    );
    await settle(resource.isLoading);

    const slots = appointments.mapSlots(resource.value());
    expect(slots.length).toBeGreaterThan(0);
    expect(slots.every((slot) => /^\d{2}:\d{2}$/.test(slot.startTime))).toBe(true);
    // A taken slot always names who holds it.
    expect(slots.filter((slot) => !slot.isAvailable).every((slot) => slot.takenBy !== null)).toBe(
      true,
    );
  });

  it('books an open slot and assigns the next token', async () => {
    const { appointments, doctors } = await setup();
    await settle(doctors.isLoading);

    const doctorId = doctors.doctors()[0]!.id;
    const date = findClinicDate(doctorId);

    const resource = TestBed.runInInjectionContext(() =>
      appointments.slotsFor(
        () => doctorId,
        () => date,
      ),
    );
    await settle(resource.isLoading);

    const openSlot = appointments.mapSlots(resource.value()).find((slot) => slot.isAvailable)!;

    const booked = await appointments.book({
      patientId: 1,
      doctorId,
      date,
      startTime: openSlot.startTime,
      reason: 'Follow-up',
    });

    expect(booked.status).toBe('booked');
    expect(booked.startTime).toBe(openSlot.startTime);
    expect(booked.tokenNumber).toBeGreaterThan(0);

    // The slot must now be gone.
    resource.reload();
    await settle(resource.isLoading);
    const after = appointments
      .mapSlots(resource.value())
      .find((slot) => slot.startTime === openSlot.startTime)!;
    expect(after.isAvailable).toBe(false);
    expect(after.takenBy).toBeTruthy();
  });

  it('rejects a double booking of the same slot', async () => {
    const { appointments, doctors } = await setup();
    await settle(doctors.isLoading);

    const doctorId = doctors.doctors()[1]!.id;
    const date = findClinicDate(doctorId);
    const resource = TestBed.runInInjectionContext(() =>
      appointments.slotsFor(
        () => doctorId,
        () => date,
      ),
    );
    await settle(resource.isLoading);

    const slot = appointments.mapSlots(resource.value()).find((entry) => entry.isAvailable)!;
    await appointments.book({
      patientId: 1,
      doctorId,
      date,
      startTime: slot.startTime,
      reason: 'First',
    });

    try {
      await appointments.book({
        patientId: 2,
        doctorId,
        date,
        startTime: slot.startTime,
        reason: 'Second',
      });
      throw new Error('expected the double booking to be rejected');
    } catch (error: unknown) {
      const apiError = error as { status?: number; fieldErrors?: Record<string, string[]> };
      expect(apiError.status).toBe(400);
      expect(apiError.fieldErrors?.['start_time']?.[0]).toContain('taken');
    }
  });

  it('walks an appointment through the queue state machine', async () => {
    const { appointments, doctors } = await setup();
    await settle(doctors.isLoading);

    const doctorId = doctors.doctors()[2]!.id;
    const date = findClinicDate(doctorId);
    const resource = TestBed.runInInjectionContext(() =>
      appointments.slotsFor(
        () => doctorId,
        () => date,
      ),
    );
    await settle(resource.isLoading);

    const slot = appointments.mapSlots(resource.value()).find((entry) => entry.isAvailable)!;
    const booked = await appointments.book({
      patientId: 3,
      doctorId,
      date,
      startTime: slot.startTime,
      reason: 'Review',
    });

    const checkedIn = await appointments.transition(booked.id, 'check-in');
    expect(checkedIn.status).toBe('checked_in');
    expect(checkedIn.checkedInAt).not.toBeNull();

    const started = await appointments.transition(booked.id, 'start');
    expect(started.status).toBe('in_consultation');

    const completed = await appointments.transition(booked.id, 'complete');
    expect(completed.status).toBe('completed');
  });

  it('refuses an illegal transition rather than trusting the client', async () => {
    const { appointments, doctors } = await setup();
    await settle(doctors.isLoading);

    const doctorId = doctors.doctors()[3]!.id;
    const date = findClinicDate(doctorId);
    const resource = TestBed.runInInjectionContext(() =>
      appointments.slotsFor(
        () => doctorId,
        () => date,
      ),
    );
    await settle(resource.isLoading);

    const slot = appointments.mapSlots(resource.value()).find((entry) => entry.isAvailable)!;
    const booked = await appointments.book({
      patientId: 4,
      doctorId,
      date,
      startTime: slot.startTime,
      reason: 'Review',
    });

    // 'start' is only legal from 'checked_in'.
    try {
      await appointments.transition(booked.id, 'start');
      throw new Error('expected the transition to be rejected');
    } catch (error: unknown) {
      expect((error as { status?: number }).status).toBe(409);
    }
  });
});

/** First upcoming date on which the doctor actually sits a clinic. */
function findClinicDate(doctorId: number): string {
  for (let offset = 1; offset <= 8; offset++) {
    const date = addDays(todayIso(), offset);
    const weekday = new Date(`${date}T00:00:00`).getDay();
    // Schedules run Sunday–Thursday, minus each doctor's day off.
    if (weekday <= 4 && weekday !== doctorId % 5) {
      return date;
    }
  }
  throw new Error('no clinic date found');
}

describe('toTimeSlot', () => {
  it('maps the DTO without reinterpreting availability', () => {
    const slot = toTimeSlot({
      start_time: '09:20',
      end_time: '09:40',
      is_available: false,
      taken_by: 'Nasrin Akter',
    });
    expect(slot).toEqual({
      startTime: '09:20',
      endTime: '09:40',
      isAvailable: false,
      takenBy: 'Nasrin Akter',
    });
  });
});
