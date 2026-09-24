import type { Routes } from '@angular/router';
import { permissionGuard } from '../../core/auth/auth.guards';

const routes: Routes = [
  {
    path: '',
    title: 'Inventory · HMS',
    loadComponent: () => import('./item-list.component').then((m) => m.ItemListComponent),
  },
  {
    path: 'suppliers',
    title: 'Suppliers · HMS',
    loadComponent: () => import('./supplier-list.component').then((m) => m.SupplierListComponent),
  },
  {
    path: 'new',
    title: 'Add item · HMS',
    canActivate: [permissionGuard('inventory.manage')],
    loadComponent: () => import('./item-form.component').then((m) => m.ItemFormComponent),
  },
  {
    path: ':id',
    title: 'Item · HMS',
    loadComponent: () => import('./item-detail.component').then((m) => m.ItemDetailComponent),
  },
  {
    path: ':id/edit',
    title: 'Edit item · HMS',
    canActivate: [permissionGuard('inventory.manage')],
    loadComponent: () => import('./item-form.component').then((m) => m.ItemFormComponent),
  },
];

export default routes;
