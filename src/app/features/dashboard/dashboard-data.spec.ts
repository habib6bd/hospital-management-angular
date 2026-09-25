import { countVisitsByDay, dayLabel, percent, trailingDays } from './dashboard-data';
import type { Appointment, AppointmentStatus } from '../../shared/models/appointment.model';

function appointment(date: string, status: AppointmentStatus = 'completed'): Appointment {
  return {
    id: 1,
    patientId: 1,
    patientName: 'Rafiqul Islam',
    patientMrn: 'MRN-0001',
    doctorId: 1,
    doctorName: 'Dr. Imran Hossain',
    specialty: 'Cardiology',
    date,
    startTime: '09:00',
    endTime: '09:15',
    status,
    tokenNumber: 1,
    reason: '',
    checkedInAt: null,
    createdAt: `${date}T08:00:00Z`,
  };
}

describe('trailingDays', () => {
  it('returns the window ending today, oldest first', () => {
    expect(trailingDays('2026-03-02', 3)).toEqual(['2026-02-28', '2026-03-01', '2026-03-02']);
  });
});

describe('countVisitsByDay', () => {
  const days = ['2026-03-01', '2026-03-02'];

  it('counts per day and keeps empty days at zero', () => {
    const rows = [appointment('2026-03-02'), appointment('2026-03-02', 'no_show')];
    expect(countVisitsByDay(rows, days)).toEqual([0, 2]);
  });

  it('ignores cancelled bookings and dates outside the window', () => {
    const rows = [appointment('2026-03-01', 'cancelled'), appointment('2026-02-20')];
    expect(countVisitsByDay(rows, days)).toEqual([0, 0]);
  });
});

describe('formatting', () => {
  it('labels a day with weekday and date', () => {
    expect(dayLabel('2026-03-02')).toBe('Mon 2');
  });

  it('rounds a ratio to a whole percentage', () => {
    expect(percent(0.876)).toBe('88%');
  });
});
