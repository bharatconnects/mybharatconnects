import {
  HttpEvent,
  HttpInterceptorFn,
  HttpRequest,
  HttpHandlerFn,
  HttpErrorResponse,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { BehaviorSubject, Observable, catchError, filter, switchMap, take, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';

/**
 * Auth interceptor with refresh-token rotation.
 *
 * — Skips ALL `/auth/*` endpoints when deciding whether to refresh. Earlier
 *   versions only excluded `/auth/refresh`, which caused an infinite loop:
 *   a 401 on `/auth/logout` would trigger another refresh + logout cycle.
 *
 * — Single-flight refresh: if many requests 401 at once, only ONE
 *   `/auth/refresh` call goes out; the others wait for its result and then
 *   retry with the fresh token.
 */

const AUTH_ENDPOINTS = [
  '/auth/login',
  '/auth/register',
  '/auth/verify-otp',
  '/auth/refresh',
  '/auth/logout',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/google',
];

function isAuthEndpoint(url: string): boolean {
  return AUTH_ENDPOINTS.some((path) => url.includes(path));
}

// Module-scoped state for single-flight refresh.
let isRefreshing = false;
const refreshSubject = new BehaviorSubject<string | null>(null);

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
) => {
  const authService = inject(AuthService);
  const token = authService.accessToken;

  const authReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // Don't try to refresh for non-401 errors or for auth endpoints
      // themselves — those would create a logout → refresh → logout loop.
      if (error.status !== 401 || isAuthEndpoint(req.url)) {
        return throwError(() => error);
      }

      return handleUnauthorized(req, next, authService);
    }),
  );
};

function handleUnauthorized(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  authService: AuthService,
): Observable<HttpEvent<unknown>> {
  if (isRefreshing) {
    // A refresh is already in flight — wait for it, then retry this request.
    return refreshSubject.pipe(
      filter((newToken): newToken is string => newToken !== null),
      take(1),
      switchMap((newToken) =>
        next(req.clone({ setHeaders: { Authorization: `Bearer ${newToken}` } })),
      ),
    );
  }

  isRefreshing = true;
  refreshSubject.next(null);

  return authService.refreshToken().pipe(
    switchMap((res) => {
      isRefreshing = false;
      refreshSubject.next(res.accessToken);
      return next(
        req.clone({ setHeaders: { Authorization: `Bearer ${res.accessToken}` } }),
      );
    }),
    catchError((refreshError) => {
      // Refresh itself failed — refresh token is expired/invalid. Clear local
      // session and route to /auth/login. authService.logout() is safe to call
      // here because /auth/logout is now excluded from refresh-retry.
      isRefreshing = false;
      refreshSubject.next(null);
      authService.logout();
      return throwError(() => refreshError);
    }),
  );
}
