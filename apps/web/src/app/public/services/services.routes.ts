import { Routes } from '@angular/router';

export const SERVICES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./services-list.component').then((m) => m.ServicesListComponent),
  },
  {
    path: ':slug',
    loadComponent: () => import('./service-detail.component').then((m) => m.ServiceDetailComponent),
  },
];
