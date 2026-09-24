import type { Routes } from '@angular/router';
import { permissionGuard } from '../../core/auth/auth.guards';

const routes: Routes = [
  {
    path: '',
    title: 'Appointments · HMS',
    loadComponent: () =>
      import('./appointment-calendar.component').then((m) => m.AppointmentCalendarComponent),
  },
  {
    path: 'queue',
    title: 'OPD queue · HMS',
    canActivate: [permissionGuard('appointments.queue')],
    loadComponent: () => import('./opd-queue.component').then((m) => m.OpdQueueComponent),
  },
  {
    path: 'book',
    title: 'Book appointment · HMS',
    canActivate: [permissionGuard('appointments.manage')],
    loadComponent: () => import('./slot-booking.component').then((m) => m.SlotBookingComponent),
  },
  {
    path: 'schedules',
    title: 'Doctor schedules · HMS',
    loadComponent: () =>
      import('./doctor-schedule.component').then((m) => m.DoctorScheduleComponent),
  },
];

export default routes;
