import type { Routes } from '@angular/router';
import { permissionGuard } from '../../core/auth/auth.guards';

const routes: Routes = [
  {
    path: '',
    title: 'Lab & Diagnostics · HMS',
    loadComponent: () => import('./order-list.component').then((m) => m.OrderListComponent),
  },
  {
    path: 'new',
    title: 'New lab order · HMS',
    canActivate: [permissionGuard('lab.order')],
    loadComponent: () => import('./order-form.component').then((m) => m.OrderFormComponent),
  },
  {
    path: ':id',
    title: 'Lab order · HMS',
    loadComponent: () => import('./order-detail.component').then((m) => m.OrderDetailComponent),
  },
];

export default routes;
