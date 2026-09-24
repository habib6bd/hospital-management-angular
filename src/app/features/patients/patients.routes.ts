import type { Routes } from '@angular/router';
import { permissionGuard } from '../../core/auth/auth.guards';

/**
 * `new` is declared before `:id` so it is not swallowed as an id, and the
 * write routes carry `patients.manage` on top of the feature-level role gate.
 */
const routes: Routes = [
  {
    path: '',
    title: 'Patients · HMS',
    loadComponent: () => import('./patient-list.component').then((m) => m.PatientListComponent),
  },
  {
    path: 'beds',
    title: 'Ward & beds · HMS',
    loadComponent: () => import('./bed-allocation.component').then((m) => m.BedAllocationComponent),
  },
  {
    path: 'new',
    title: 'Register patient · HMS',
    canActivate: [permissionGuard('patients.manage')],
    loadComponent: () => import('./patient-form.component').then((m) => m.PatientFormComponent),
  },
  {
    path: ':id',
    title: 'Patient · HMS',
    loadComponent: () => import('./patient-detail.component').then((m) => m.PatientDetailComponent),
  },
  {
    path: ':id/edit',
    title: 'Edit patient · HMS',
    canActivate: [permissionGuard('patients.manage')],
    loadComponent: () => import('./patient-form.component').then((m) => m.PatientFormComponent),
  },
];

export default routes;
