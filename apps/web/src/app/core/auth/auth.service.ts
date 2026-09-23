import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { ApiService } from '../services/api.service';
import { User, RegisterData, Role } from '../models/user.model';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  currentUser$ = this.currentUserSubject.asObservable();
  private readonly isBrowser: boolean;

  constructor(
    private api: ApiService,
    private router: Router,
    @Inject(PLATFORM_ID) platformId: object,
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
    const stored = this.getItem('bb_user');
    if (stored) {
      try {
        this.currentUserSubject.next(JSON.parse(stored));
      } catch {
        /* ignore */
      }
    }
  }

  // localStorage/sessionStorage don't exist during SSR — every access in
  // this service goes through these so a server render just behaves as
  // "logged out" instead of throwing.
  private getItem(key: string): string | null {
    return this.isBrowser ? localStorage.getItem(key) : null;
  }

  private setItem(key: string, value: string): void {
    if (this.isBrowser) localStorage.setItem(key, value);
  }

  private removeItem(key: string): void {
    if (this.isBrowser) localStorage.removeItem(key);
  }

  login(email: string, password: string): Observable<{ message: string }> {
    return this.api.post<{ message: string }>('/auth/login', { email, password });
  }

  verifyOtp(
    email: string,
    otp: string,
  ): Observable<{ accessToken: string; refreshToken: string; user: User }> {
    return this.api
      .post<{
        accessToken: string;
        refreshToken: string;
        user: User;
      }>('/auth/verify-otp', { email, otp })
      .pipe(
        tap((res) => {
          this.setItem('bb_token', res.accessToken);
          this.setItem('bb_refresh', res.refreshToken);
          this.setItem('bb_user', JSON.stringify(res.user));
          this.currentUserSubject.next(res.user);
        }),
      );
  }

  register(data: RegisterData): Observable<User> {
    return this.api.post<User>('/auth/register', data);
  }

  requestPasswordReset(email: string): Observable<{ message: string }> {
    return this.api.post<{ message: string }>('/auth/forgot-password', { email });
  }

  resetPassword(
    email: string,
    token: string,
    newPassword: string,
  ): Observable<{ message: string }> {
    return this.api.post<{ message: string }>('/auth/reset-password', {
      email,
      token,
      newPassword,
    });
  }

  applyOauthSession(accessToken: string, refreshToken: string, user: User): void {
    this.setItem('bb_token', accessToken);
    this.setItem('bb_refresh', refreshToken);
    this.setItem('bb_user', JSON.stringify(user));
    this.currentUserSubject.next(user);
  }

  /** Build the URL the SPA uses to redirect the user to Google's consent
   *  screen. The state token is fetched from the backend so we can verify
   *  it on the round-trip (CSRF protection); Google echoes it back in the
   *  callback URL and we forward it to /auth/google/exchange.
   *
   *  Pattern: frontend-mediated authorization-code flow.
   *  Browser → Google → frontend `/auth/google/callback` → POST exchange → JWT */
  startGoogleLogin(): Observable<void> {
    return new Observable<void>((subscriber) => {
      this.api.get<{ state: string }>('/auth/google/state').subscribe({
        next: ({ state }) => {
          const redirectUri = `${window.location.origin}/auth/google/callback`;
          const params = new URLSearchParams({
            client_id: environment.googleClientId,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope: 'openid email profile',
            access_type: 'online',
            include_granted_scopes: 'true',
            state,
            prompt: 'select_account',
          });
          // Stash redirectUri so the callback component can reuse the exact
          // same value when POSTing to /auth/google/exchange. (Google rejects
          // mismatched redirect URIs at the token endpoint.)
          sessionStorage.setItem('bb_oauth_redirect_uri', redirectUri);
          window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
          subscriber.next();
          subscriber.complete();
        },
        error: (err) => subscriber.error(err),
      });
    });
  }

  /** Exchange a Google authorization code (+ state) for our app JWTs. Called
   *  by the OAuth callback component once Google redirects the user back. */
  exchangeGoogleCode(
    code: string,
    state: string,
    redirectUri: string,
  ): Observable<{ accessToken: string; refreshToken: string; user: User }> {
    return this.api
      .post<{
        accessToken: string;
        refreshToken: string;
        user: User;
      }>('/auth/google/exchange', { code, state, redirectUri })
      .pipe(
        tap((res) => {
          this.setItem('bb_token', res.accessToken);
          this.setItem('bb_refresh', res.refreshToken);
          this.setItem('bb_user', JSON.stringify(res.user));
          this.currentUserSubject.next(res.user);
        }),
      );
  }

  logout(): void {
    // Fire-and-forget server-side session revocation. The bearer token is
    // still in localStorage at this point so the interceptor attaches it.
    // If it has expired the server returns 401 — the interceptor now
    // recognises /auth/logout as an auth endpoint and does NOT trigger a
    // refresh-retry loop. Errors are swallowed regardless.
    this.api.post<void>('/auth/logout', {}).subscribe({
      error: () => {
        /* ignore */
      },
    });

    this.removeItem('bb_token');
    this.removeItem('bb_refresh');
    this.removeItem('bb_user');
    this.currentUserSubject.next(null);
    this.router.navigate(['/auth/login']);
  }

  refreshToken(): Observable<{ accessToken: string }> {
    const refreshToken = this.getItem('bb_refresh') || '';
    return this.api
      .post<{ accessToken: string }>('/auth/refresh', { refreshToken })
      .pipe(tap((res) => this.setItem('bb_token', res.accessToken)));
  }

  getMe(): Observable<User> {
    return this.api.get<User>('/auth/me').pipe(
      tap((user) => {
        this.setItem('bb_user', JSON.stringify(user));
        this.currentUserSubject.next(user);
      }),
    );
  }

  /** Patch the cached user after a successful profile edit so navbar etc.
   *  reflect the new name immediately without a full /auth/me refetch. */
  patchCurrentUser(patch: Partial<User>): void {
    const current = this.currentUserSubject.value;
    if (!current) return;
    const merged: User = { ...current, ...patch };
    this.setItem('bb_user', JSON.stringify(merged));
    this.currentUserSubject.next(merged);
  }

  get isLoggedIn(): boolean {
    return !!this.getItem('bb_token');
  }

  get currentUser(): User | null {
    return this.currentUserSubject.value;
  }

  get accessToken(): string | null {
    return this.getItem('bb_token');
  }

  get role(): Role | null {
    return this.currentUser?.role ?? null;
  }

  isRole(...roles: Role[]): boolean {
    return roles.includes(this.role as Role);
  }

  getPortalRoute(): string {
    switch (this.role) {
      case Role.CLIENT:
        return '/client';
      case Role.CASE_MANAGER:
        return '/case-manager';
      case Role.VENDOR:
        return '/vendor';
      case Role.QA:
        return '/qa';
      case Role.OPS_FINANCE:
        return '/ops-finance';
      case Role.ADMIN:
      default:
        return '/admin';
    }
  }
}
