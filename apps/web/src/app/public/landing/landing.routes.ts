import { Routes } from '@angular/router';
import { guestGuard } from '../../core/guards/guest.guard';

export const LANDING_ROUTES: Routes = [
  {
    path: '',
    title: 'MyBharatConnects — NRI Real Estate Platform',
    canActivate: [guestGuard],
    loadComponent: () => import('./landing.component').then(m => m.LandingComponent),
  },
];

