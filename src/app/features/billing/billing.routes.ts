import type { Routes } from '@angular/router';
import { permissionGuard } from '../../core/auth/auth.guards';

const routes: Routes = [
  {
    path: '',
    title: 'Billing · HMS',
    loadComponent: () => import('./invoice-list.component').then((m) => m.InvoiceListComponent),
  },
  {
    path: 'new',
    title: 'New invoice · HMS',
    canActivate: [permissionGuard('billing.manage')],
    loadComponent: () => import('./invoice-form.component').then((m) => m.InvoiceFormComponent),
  },
  {
    path: ':id',
    title: 'Invoice · HMS',
    loadComponent: () => import('./invoice-detail.component').then((m) => m.InvoiceDetailComponent),
  },
];

export default routes;
