import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { extractApiError } from '../../core/services/api-error';

/**
 * Google OAuth callback (frontend-mediated authorization-code flow).
 *
 * Lifecycle:
 *   1. User completes Google consent → Google redirects browser here with
 *      ?code=… &state=…  (or ?error=… if the user clicked "Cancel")
 *   2. We read code + state from query params, plus the redirectUri we
 *      stashed in sessionStorage before kicking off the auth.
 *   3. POST /auth/google/exchange { code, state, redirectUri } → JWT response
 *   4. authService stores tokens, we route to the user's portal.
 *
 * Tokens NEVER appear in the URL — they come back in the POST response body.
 */
@Component({
  selector: 'app-oauth-callback',
  standalone: true,
  imports: [CommonModule],
  template: `
    <main class="min-h-screen bg-base-100 flex flex-col items-center justify-center p-4 sm:p-8">
      <div class="flex flex-col items-center gap-4 max-w-md text-center">
        @if (!errorMessage) {
          <span class="loading loading-spinner loading-lg text-primary" aria-label="Signing you in"></span>
          <p class="font-serif text-lg text-base-content m-0">{{ message }}</p>
        } @else {
          <div class="w-12 h-12 rounded-full bg-error/10 flex items-center justify-center text-error">
            <i class="material-icons-outlined text-3xl">error_outline</i>
          </div>
          <p class="font-serif text-lg text-base-content m-0">Sign-in failed</p>
          <p class="text-sm text-base-content/70 m-0">{{ errorMessage }}</p>
          <button class="bb-btn bb-btn-primary mt-2" (click)="backToLogin()">
            <i class="material-icons-outlined text-base">arrow_back</i>
            Back to sign in
          </button>
        }
      </div>
    </main>
  `,
})
export class OauthCallbackComponent implements OnInit {
  message = 'Signing you in…';
  errorMessage = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;

    // Google sends ?error=access_denied if the user clicks Cancel on consent.
    const oauthError = params.get('error');
    if (oauthError) {
      this.errorMessage =
        oauthError === 'access_denied'
          ? 'You cancelled the Google sign-in.'
          : `Google reported an error: ${oauthError}`;
      return;
    }

    const code = params.get('code');
    const state = params.get('state');
    const redirectUri = sessionStorage.getItem('bb_oauth_redirect_uri');

    if (!code || !state || !redirectUri) {
      this.errorMessage =
        'Incomplete OAuth response. Please start the sign-in process again.';
      return;
    }

    // One-shot — clear the stashed redirectUri so a stale value can't be
    // reused for a different attempt.
    sessionStorage.removeItem('bb_oauth_redirect_uri');

    this.authService.exchangeGoogleCode(code, state, redirectUri).subscribe({
      next: () => {
        const target = this.authService.getPortalRoute();
        this.router.navigate([target ?? '/']);
      },
      error: (err) => {
        this.errorMessage = extractApiError(
          err,
          'Could not complete sign-in. Please try again.',
        ).message;
      },
    });
  }

  backToLogin(): void {
    this.router.navigate(['/auth/login']);
  }
}
