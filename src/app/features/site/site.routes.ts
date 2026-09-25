import type { Routes } from '@angular/router';
import { guestGuard, roleGuard, toLogin } from '../../core/auth/auth.guards';

/**
 * Public website, rendered inside `PublicShellComponent`. Page titles are set
 * by `SeoService` from each page (they depend on the language), not here.
 */
const siteRoutes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'doctors',
    loadComponent: () => import('./doctors/doctor-list.component').then((m) => m.DoctorListComponent),
  },
  {
    path: 'doctors/:id',
    loadComponent: () => import('./doctors/doctor-profile.component').then((m) => m.DoctorProfileComponent),
  },
  {
    path: 'departments',
    loadComponent: () => import('./departments/department-list.component').then((m) => m.DepartmentListComponent),
  },
  {
    path: 'departments/:slug',
    loadComponent: () => import('./departments/department-detail.component').then((m) => m.DepartmentDetailComponent),
  },
  {
    path: 'services',
    loadComponent: () => import('./services/service-list.component').then((m) => m.ServiceListComponent),
  },
  {
    path: 'services/:slug',
    loadComponent: () => import('./services/service-detail.component').then((m) => m.ServiceDetailComponent),
  },
  {
    path: 'book',
    loadComponent: () => import('./booking/booking.component').then((m) => m.BookingComponent),
  },
  {
    path: 'book/confirmation/:reference',
    loadComponent: () =>
      import('./booking/booking-confirmation.component').then((m) => m.BookingConfirmationComponent),
  },
  {
    path: 'about',
    loadComponent: () => import('./info/about.component').then((m) => m.AboutComponent),
  },
  {
    path: 'contact',
    loadComponent: () => import('./info/contact.component').then((m) => m.ContactComponent),
  },

  /* ------------------------------------------------ patient area */

  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./auth/login.component').then((m) => m.LoginComponent),
  },
  { path: 'patient/login', redirectTo: toLogin },
  {
    path: 'patient',
    // An anonymous visitor is sent to /login with a returnUrl; a signed-in
    // staff member gets /forbidden. See `loginUrlTree`.
    canMatch: [roleGuard('patient')],
    loadComponent: () => import('./patient/patient-area.component').then((m) => m.PatientAreaComponent),
    loadChildren: () => import('../patient-portal/patient-portal.routes'),
  },
];

export default siteRoutes;
