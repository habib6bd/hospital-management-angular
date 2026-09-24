import type { Routes } from '@angular/router';
import { FeaturePlaceholderComponent } from '../../shared/ui/placeholder/feature-placeholder.component';

const routes: Routes = [
  {
    path: '',
    title: 'Dashboard · HMS',
    component: FeaturePlaceholderComponent,
    data: { heading: 'Dashboard', description: 'Analytics across patients, beds, revenue and inventory.' },
  },
];

export default routes;
