import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { Role } from '../models/user.model';

export const roleGuard = (allowedRoles: Role[]): CanActivateFn => () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const role = auth.role;
  if (role && allowedRoles.includes(role)) return true;
  // Logged in but hitting a route that isn't theirs — send them to their own
  // portal instead of the public homepage, never leave them on the wrong
  // role's layout. Not logged in at all — send to login as before.
  return router.createUrlTree([role ? auth.getPortalRoute() : '/auth/login']);
};
