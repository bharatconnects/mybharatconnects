import { Routes } from '@angular/router';
import { guestGuard } from '../../core/guards/guest.guard';

export const LANDING_ROUTES: Routes = [
  {
    path: '',
    title: 'MyBharatConnects | Trusted NRI Services in India',
    canActivate: [guestGuard],
    loadComponent: () => import('./landing.component').then(m => m.LandingComponent),
  },
];

