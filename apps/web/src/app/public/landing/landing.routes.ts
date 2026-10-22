import { Routes } from '@angular/router';

// No guestGuard here: a signed-in user can still open the public site. Only
// login/register stay guest-only (see login.routes.ts).
export const LANDING_ROUTES: Routes = [
  {
    path: '',
    title: 'MyBharatConnects | Trusted NRI Services in India',
    loadComponent: () => import('./landing.component').then(m => m.LandingComponent),
  },
];

