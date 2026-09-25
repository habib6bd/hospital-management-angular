import type { Routes } from '@angular/router';

const routes: Routes = [
  {
    path: '',
    title: 'Dashboard · HMS',
    loadComponent: () => import('./dashboard.component').then((m) => m.DashboardComponent),
  },
];

export default routes;
