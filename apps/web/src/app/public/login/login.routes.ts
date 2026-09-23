import { Routes } from '@angular/router';
import { guestGuard } from '../../core/guards/guest.guard';

export const LOGIN_ROUTES: Routes = [
  {
    path: 'login',
    title: 'Sign In | MyBharatConnects',
    canActivate: [guestGuard],
    loadComponent: () => import('./login.component').then(m => m.LoginComponent),
  },
  {
    path: 'register',
    title: 'Create Account | MyBharatConnects',
    canActivate: [guestGuard],
    loadComponent: () => import('./register.component').then(m => m.RegisterComponent),
  },
  {
    // Frontend-mediated OAuth callback. Google redirects here with
    // ?code=…&state=…; the component POSTs them to /auth/google/exchange.
    path: 'google/callback',
    title: 'Signing In | MyBharatConnects',
    loadComponent: () => import('./oauth-callback.component').then(m => m.OauthCallbackComponent),
  },
  {
    path: 'forgot-password',
    title: 'Forgot Password | MyBharatConnects',
    loadComponent: () => import('./forgot-password.component').then(m => m.ForgotPasswordComponent),
  },
  {
    path: 'reset-password',
    title: 'Reset Password | MyBharatConnects',
    loadComponent: () => import('./reset-password.component').then(m => m.ResetPasswordComponent),
  },
  { path: '', redirectTo: 'login', pathMatch: 'full' },
];

