import type { Routes } from '@angular/router';
import { guestGuard } from '../../core/auth/auth.guards';

const authRoutes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    title: 'Sign in · HMS',
    loadComponent: () => import('./login.component').then((m) => m.LoginComponent),
  },
  { path: '', pathMatch: 'full', redirectTo: 'login' },
];

export default authRoutes;
