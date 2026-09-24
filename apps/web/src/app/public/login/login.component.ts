import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { extractApiError } from '../../core/services/api-error';
import { BrandLogoComponent } from '../../shared/components/brand-logo/brand-logo.component';

const RESEND_COOLDOWN_SECONDS = 30;

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, BrandLogoComponent],
  template: `
    <main class="h-screen overflow-hidden grid lg:grid-cols-2 bg-base-100">
      <!-- ── Brand panel (desktop only — mobile gets a compact back-to-home link instead) ── -->
      <aside
        class="hidden lg:flex lg:flex-col lg:justify-between lg:p-12 lg:h-screen bg-neutral text-neutral-content"
      >
        <a routerLink="/" class="inline-flex items-center" aria-label="MyBharatConnects home">
          <app-brand-logo variant="lockup" [size]="38" [onDark]="true"></app-brand-logo>
        </a>

        <div class="hidden lg:block max-w-md">
          <p class="font-mono text-[13px] tracking-widest text-accent mb-4">
            TRUSTED NRI REAL ESTATE PLATFORM
          </p>
          <h2 class="font-serif text-4xl xl:text-5xl font-light leading-[1.1] mb-6">
            Your Property.<br />
            <em class="italic text-accent">Our Expertise.</em><br />
            Your Peace of Mind.
          </h2>
          <ul class="space-y-3 text-sm">
            <li class="flex items-center gap-3 opacity-90">
              <i class="material-icons-outlined text-accent" aria-hidden="true">check_circle</i>
              <span>500+ NRI clients across 10+ Indian cities</span>
            </li>
            <li class="flex items-center gap-3 opacity-90">
              <i class="material-icons-outlined text-accent" aria-hidden="true">check_circle</i>
              <span>&#8377;500Cr+ in property managed end-to-end</span>
            </li>
            <li class="flex items-center gap-3 opacity-90">
              <i class="material-icons-outlined text-accent" aria-hidden="true">check_circle</i>
              <span>Dedicated advisor from day one</span>
            </li>
          </ul>
        </div>

        <p class="hidden lg:block text-xs opacity-50">
          © 2026 MyBharatConnects. All rights reserved.
        </p>
      </aside>

      <!-- Fixed top-left on mobile/tablet — desktop gets its own copy inside the form panel below (the aside's logo sits in the same corner, so this can't also render there without overlapping it) -->
      <a
        routerLink="/"
        class="lg:hidden fixed top-4 left-4 z-20 bb-btn bb-btn-ghost bb-btn-sm"
        aria-label="Back to home"
      >
        <i class="material-icons-outlined text-base">arrow_back</i>
        <span>Back</span>
      </a>

      <!-- ── Form panel (right on desktop, below on mobile) ── -->
      <section
        class="flex flex-col justify-start px-6 sm:px-12 lg:px-16 pt-16 sm:pt-10 lg:pt-14 pb-6 sm:pb-8 lg:pb-10 max-w-2xl w-full mx-auto lg:mx-0 lg:max-w-none overflow-y-auto scrollbar-none"
      >
        <div class="w-full max-w-lg mx-auto lg:mx-0">
          <div class="hidden lg:flex items-center justify-between mb-8 gap-4">
            <a
              routerLink="/"
              class="inline-flex bb-btn bb-btn-ghost bb-btn-sm shrink-0"
              aria-label="Back to home"
            >
              <i class="material-icons-outlined text-base">arrow_back</i>
              <span>Back</span>
            </a>

            @if (step === 'credentials') {
              <p class="text-sm font-medium text-base-content/80">
                Don't have an account?
                <a routerLink="/auth/register" class="text-primary font-bold hover:underline"
                  >Create one</a
                >
              </p>
            }
          </div>

          <header class="mb-6 sm:mb-8">
            <p class="font-mono text-[13px] font-semibold tracking-widest text-primary mb-2">
              {{ step === 'credentials' ? 'WELCOME BACK' : 'VERIFY IDENTITY' }}
            </p>
            <h1 class="font-serif text-2xl sm:text-4xl font-light leading-tight text-base-content">
              {{ step === 'credentials' ? 'Sign in to your account' : 'Enter your OTP' }}
            </h1>
            @if (step === 'otp') {
              <p class="text-sm text-base-content/80 mt-3">
                We sent a 6-digit code to
                <strong class="text-base-content font-semibold">{{
                  credentialsForm.get('email')?.value
                }}</strong>
              </p>
            }
          </header>

          @if (step === 'credentials') {
            <form
              [formGroup]="credentialsForm"
              (ngSubmit)="onSendOtp()"
              class="flex flex-col gap-3 sm:gap-4"
            >
              <label class="form-control w-full">
                <div class="label pb-1 sm:pb-2">
                  <span
                    class="label-text text-sm font-semibold text-base-content uppercase tracking-wide"
                    >Email Address</span
                  >
                </div>
                <input
                  id="login-email"
                  class="bb-input"
                  [class.input-error]="
                    credentialsForm.get('email')?.invalid && credentialsForm.get('email')?.touched
                  "
                  type="email"
                  formControlName="email"
                  placeholder="you@example.com"
                  autocomplete="email"
                />
                @if (
                  credentialsForm.get('email')?.invalid && credentialsForm.get('email')?.touched
                ) {
                  <div class="label py-1">
                    <span class="label-text-alt text-error text-xs"
                      >Enter a valid email address</span
                    >
                  </div>
                }
              </label>

              <label class="form-control w-full">
                <div class="label pb-1 sm:pb-2 flex items-center justify-between">
                  <span
                    class="label-text text-sm font-semibold text-base-content uppercase tracking-wide"
                    >Password</span
                  >
                  <a
                    routerLink="/auth/forgot-password"
                    class="label-text-alt text-primary text-xs hover:underline font-medium"
                    >Forgot password?</a
                  >
                </div>
                <div class="relative">
                  <input
                    id="login-password"
                    class="bb-input pr-11"
                    [class.input-error]="
                      credentialsForm.get('password')?.invalid &&
                      credentialsForm.get('password')?.touched
                    "
                    [type]="showPassword ? 'text' : 'password'"
                    formControlName="password"
                    placeholder="Your password"
                    autocomplete="current-password"
                  />
                  <button
                    type="button"
                    class="absolute right-2 top-1/2 -translate-y-1/2 text-base-content/50 hover:text-base-content transition-colors"
                    (click)="showPassword = !showPassword"
                    [attr.aria-label]="showPassword ? 'Hide password' : 'Show password'"
                  >
                    <i class="material-icons-outlined text-lg" aria-hidden="true">{{
                      showPassword ? 'visibility_off' : 'visibility'
                    }}</i>
                  </button>
                </div>
                @if (
                  credentialsForm.get('password')?.invalid &&
                  credentialsForm.get('password')?.touched
                ) {
                  <div class="label py-1">
                    <span class="label-text-alt text-error text-xs">Password is required</span>
                  </div>
                }
              </label>

              @if (errorMessage) {
                <div role="alert" class="alert alert-error text-sm">
                  <i class="material-icons-outlined" aria-hidden="true">error_outline</i>
                  <span>{{ errorMessage }}</span>
                </div>
              }

              <button
                class="bb-btn bb-btn-primary w-full h-12 text-base font-semibold"
                type="submit"
                [disabled]="loading"
              >
                @if (loading) {
                  <span class="loading loading-spinner loading-sm" aria-label="Loading"></span>
                } @else {
                  <span>Send OTP</span>
                  <i class="material-icons-outlined" aria-hidden="true">arrow_forward</i>
                }
              </button>

              <div class="divider text-xs text-base-content/60 my-0">OR</div>

              <button
                type="button"
                class="bb-btn bb-btn-outline bb-btn-google w-full h-11 sm:h-12 gap-3 text-base"
                (click)="continueWithGoogle()"
              >
                <svg
                  class="w-5 h-5"
                  viewBox="0 0 48 48"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    fill="#FFC107"
                    d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.2 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"
                  />
                  <path
                    fill="#FF3D00"
                    d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.2 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
                  />
                  <path
                    fill="#4CAF50"
                    d="M24 44c5.4 0 10.3-2.1 14-5.4l-6.4-5.4c-2 1.4-4.6 2.3-7.6 2.3-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
                  />
                  <path
                    fill="#1976D2"
                    d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.3 5.7l6.4 5.4C41.5 35.5 44 30.1 44 24c0-1.3-.1-2.3-.4-3.5z"
                  />
                </svg>
                Continue with Google
              </button>

              <p class="lg:hidden text-center text-base font-medium text-base-content/80 mt-3">
                Don't have an account?
                <a routerLink="/auth/register" class="text-primary font-bold hover:underline"
                  >Create one</a
                >
              </p>
            </form>
          }

          @if (step === 'otp') {
            <form [formGroup]="otpForm" (ngSubmit)="onVerifyOtp()" class="flex flex-col gap-3 sm:gap-4">
              <label class="form-control w-full">
                <div class="label pb-1 sm:pb-2">
                  <span
                    class="label-text text-sm font-semibold text-base-content uppercase tracking-wide"
                    >One-Time Password</span
                  >
                </div>
                <input
                  id="login-otp"
                  class="bb-input h-14 text-center text-2xl tracking-[0.5em] font-mono"
                  [class.input-error]="otpForm.get('otp')?.invalid && otpForm.get('otp')?.touched"
                  type="text"
                  formControlName="otp"
                  placeholder="------"
                  maxlength="6"
                  inputmode="numeric"
                  autocomplete="one-time-code"
                />
                @if (otpForm.get('otp')?.invalid && otpForm.get('otp')?.touched) {
                  <div class="label py-1">
                    <span class="label-text-alt text-error text-xs">Enter the 6-digit code</span>
                  </div>
                }
              </label>

              @if (errorMessage) {
                <div role="alert" class="alert alert-error text-sm">
                  <i class="material-icons-outlined" aria-hidden="true">error_outline</i>
                  <span>{{ errorMessage }}</span>
                </div>
              }

              <button
                class="bb-btn bb-btn-primary w-full h-12 text-base font-semibold"
                type="submit"
                [disabled]="loading"
              >
                @if (loading) {
                  <span class="loading loading-spinner loading-sm" aria-label="Loading"></span>
                } @else {
                  <span>Verify &amp; Sign In</span>
                  <i class="material-icons-outlined" aria-hidden="true">arrow_forward</i>
                }
              </button>

              <!-- Resend OTP — cooldown prevents abuse without a separate backend route -->
              <div class="text-center text-sm text-base-content/80">
                Didn't get the code?
                @if (resendCountdown > 0) {
                  <span class="ml-1 text-base-content/70">Resend in {{ resendCountdown }}s</span>
                } @else {
                  <button
                    type="button"
                    class="ml-1 text-primary font-semibold hover:underline disabled:opacity-50 disabled:no-underline"
                    [disabled]="resending"
                    (click)="resendOtp()"
                  >
                    @if (resending) {
                      <span class="loading loading-spinner loading-xs align-middle"></span>
                      <span class="ml-1">Sending…</span>
                    } @else {
                      <span>Resend code</span>
                    }
                  </button>
                }
              </div>

              <button
                class="bb-btn bb-btn-ghost w-full h-12 text-base"
                type="button"
                (click)="goBackToCredentials()"
              >
                <i class="material-icons-outlined" aria-hidden="true">arrow_back</i>
                Use a different email
              </button>
            </form>
          }
        </div>
      </section>
    </main>
  `,
})
export class LoginComponent implements OnInit, OnDestroy {
  step: 'credentials' | 'otp' = 'credentials';
  loading = false;
  errorMessage = '';
  showPassword = false;

  credentialsForm!: FormGroup;
  otpForm!: FormGroup;

  // Resend-OTP cooldown state. Re-uses the existing /auth/login endpoint
  // rather than a new backend route — we already cache email+password in
  // credentialsForm during the OTP step. Cooldown stops button-mashing and
  // complements the server-side 5/min throttle on /auth/login.
  resending = false;
  resendCountdown = 0;
  private resendTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.credentialsForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
    });
    this.otpForm = this.fb.group({
      otp: ['', Validators.required],
    });
  }

  ngOnDestroy(): void {
    this.clearResendTimer();
  }

  onSendOtp(): void {
    if (this.credentialsForm.invalid) {
      this.credentialsForm.markAllAsTouched();
      return;
    }
    this.loading = true;
    this.errorMessage = '';
    const { email, password } = this.credentialsForm.value;
    this.authService.login(email, password).subscribe({
      next: () => {
        this.loading = false;
        this.step = 'otp';
        this.startResendCooldown();
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = extractApiError(err, 'Login failed. Please try again.').message;
      },
    });
  }

  onVerifyOtp(): void {
    if (this.otpForm.invalid) {
      this.otpForm.markAllAsTouched();
      return;
    }
    this.loading = true;
    this.errorMessage = '';
    const email = this.credentialsForm.get('email')?.value;
    const otp = this.otpForm.get('otp')?.value;
    this.authService.verifyOtp(email, otp).subscribe({
      next: (res) => {
        this.loading = false;
        this.navigateByRole(res.user.role);
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = extractApiError(err, 'Invalid OTP. Please try again.').message;
      },
    });
  }

  resendOtp(): void {
    if (this.resending || this.resendCountdown > 0) return;
    const { email, password } = this.credentialsForm.value;
    if (!email || !password) {
      // Defensive — shouldn't happen since we only show resend inside the OTP step
      this.toast.error('Please re-enter your email and password');
      this.step = 'credentials';
      return;
    }
    this.resending = true;
    this.errorMessage = '';
    this.authService.login(email, password).subscribe({
      next: () => {
        this.resending = false;
        this.otpForm.reset();
        this.startResendCooldown();
        this.toast.success('New code sent to your email');
      },
      error: (err) => {
        this.resending = false;
        const apiErr = extractApiError(err, 'Could not send a new code. Please try again.');
        this.toast.error(apiErr.message);
        // 429 means throttler tripped — still start a cooldown so the user
        // doesn't immediately spam-click.
        if (err?.status === 429) this.startResendCooldown();
      },
    });
  }

  goBackToCredentials(): void {
    this.step = 'credentials';
    this.errorMessage = '';
    this.otpForm.reset();
    this.clearResendTimer();
    this.resendCountdown = 0;
  }

  continueWithGoogle(): void {
    // Fetches a one-time CSRF state token from /auth/google/state and then
    // redirects the browser to Google's consent screen. The user is sent
    // back to /auth/google/callback (frontend), which POSTs to exchange.
    this.authService.startGoogleLogin().subscribe({
      error: (err) => {
        this.errorMessage = extractApiError(
          err,
          'Could not start Google sign-in. Please try again.',
        ).message;
      },
    });
  }

  private startResendCooldown(): void {
    this.clearResendTimer();
    this.resendCountdown = RESEND_COOLDOWN_SECONDS;
    this.resendTimer = setInterval(() => {
      this.resendCountdown--;
      if (this.resendCountdown <= 0) this.clearResendTimer();
    }, 1000);
  }

  private clearResendTimer(): void {
    if (this.resendTimer !== null) {
      clearInterval(this.resendTimer);
      this.resendTimer = null;
    }
  }

  private navigateByRole(role: string): void {
    const roleRoutes: Record<string, string> = {
      CLIENT: '/client',
      CASE_MANAGER: '/case-manager',
      VENDOR: '/vendor',
      QA: '/qa',
      OPS_FINANCE: '/ops-finance',
      ADMIN: '/admin',
    };
    this.router.navigate([roleRoutes[role] ?? '/']);
  }
}
