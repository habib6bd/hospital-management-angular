import type { Routes } from '@angular/router';

/**
 * Portal routes. The role gate lives on the parent `canMatch` in app.routes;
 * every endpoint behind these screens is additionally scoped server-side to the
 * patient the access token belongs to.
 */
const routes: Routes = [
  {
    path: '',
    title: 'My health · HMS',
    loadComponent: () => import('./portal-home.component').then((m) => m.PortalHomeComponent),
  },
  {
    path: 'reports',
    title: 'My reports · HMS',
    loadComponent: () => import('./report-list.component').then((m) => m.ReportListComponent),
  },
  {
    path: 'appointments',
    title: 'My appointments · HMS',
    loadComponent: () =>
      import('./portal-appointments.component').then((m) => m.PortalAppointmentsComponent),
  },
  {
    path: 'billing',
    title: 'My bills · HMS',
    loadComponent: () => import('./portal-billing.component').then((m) => m.PortalBillingComponent),
  },
];

export default routes;
