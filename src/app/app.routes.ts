import { inject } from '@angular/core';
import { Router, type Routes } from '@angular/router';
import { authGuard, roleGuard } from './core/auth/auth.guards';
import { PermissionService } from './core/auth/permission.service';

/**
 * Feature areas are lazy and gated on `canMatch`, so a role that cannot use a
 * feature never downloads its chunk. `canActivate: [authGuard]` on the shell
 * covers the session check once for every child.
 */
export const routes: Routes = [
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes'),
  },

  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell.component').then((m) => m.ShellComponent),
    children: [
      {
        path: '',
        pathMatch: 'full',
        // Each role lands somewhere different; the strategy decides where.
        redirectTo: () => inject(Router).parseUrl(inject(PermissionService).landingRoute()),
      },
      {
        path: 'dashboard',
        canMatch: [
          roleGuard('admin', 'doctor', 'nurse', 'receptionist', 'lab_technician', 'pharmacist'),
        ],
        loadChildren: () => import('./features/dashboard/dashboard.routes'),
      },
      {
        path: 'patients',
        canMatch: [roleGuard('admin', 'doctor', 'nurse', 'receptionist', 'lab_technician')],
        loadChildren: () => import('./features/patients/patients.routes'),
      },
      {
        path: 'appointments',
        canMatch: [roleGuard('admin', 'doctor', 'nurse', 'receptionist')],
        loadChildren: () => import('./features/appointments/appointments.routes'),
      },
      {
        path: 'inventory',
        canMatch: [roleGuard('admin', 'nurse', 'pharmacist')],
        loadChildren: () => import('./features/inventory/inventory.routes'),
      },
      {
        path: 'lab',
        canMatch: [roleGuard('admin', 'doctor', 'nurse', 'lab_technician')],
        loadChildren: () => import('./features/lab-reports/lab-reports.routes'),
      },
      {
        path: 'billing',
        canMatch: [roleGuard('admin', 'receptionist', 'pharmacist')],
        loadChildren: () => import('./features/billing/billing.routes'),
      },
      {
        path: 'portal',
        canMatch: [roleGuard('patient')],
        loadChildren: () => import('./features/patient-portal/patient-portal.routes'),
      },
    ],
  },

  {
    path: 'forbidden',
    title: 'Access denied · HMS',
    loadComponent: () => import('./layout/error-page.component').then((m) => m.ErrorPageComponent),
    data: {
      code: '403',
      heading: 'Access denied',
      message: 'Your role does not have permission to view this page.',
    },
  },

  {
    path: '**',
    title: 'Not found · HMS',
    loadComponent: () => import('./layout/error-page.component').then((m) => m.ErrorPageComponent),
  },
];
