import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';

// Guards routes meant only for logged-out visitors (homepage, login,
// register) — an already-authenticated user hitting one of these is bounced
// straight to their own portal instead of seeing a "sign in" page while
// already signed in.
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isLoggedIn ? router.createUrlTree([auth.getPortalRoute()]) : true;
};
