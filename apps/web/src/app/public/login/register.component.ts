import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { extractApiError } from '../../core/services/api-error';
import { BrandLogoComponent } from '../../shared/components/brand-logo/brand-logo.component';
import { RecaptchaService } from '../../core/services/recaptcha.service';

function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;
  return password === confirmPassword ? null : { passwordMismatch: true };
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, BrandLogoComponent],
  template: `
    <main class="h-screen overflow-hidden grid lg:grid-cols-2 bg-base-100">
      <!-- ── Brand panel (desktop only — mobile gets a compact back-to-home link instead) ── -->
      <aside
        class="hidden lg:flex lg:flex-col lg:justify-between lg:p-12 bg-neutral text-neutral-content overflow-y-auto"
      >
        <a routerLink="/" class="inline-flex items-center" aria-label="MyBharatConnects home">
          <app-brand-logo variant="lockup" [size]="38" [onDark]="true"></app-brand-logo>
        </a>

        <div class="hidden lg:block max-w-md">
          <p class="font-mono text-[10px] tracking-widest text-accent mb-3">CREATE YOUR ACCOUNT</p>
          <h2 class="font-serif text-4xl xl:text-5xl font-light leading-[1.1] mb-6">
            Get started in<br />
            <em class="italic text-accent">60 seconds.</em>
          </h2>
          <ul class="space-y-3 text-sm mb-8">
            <li class="flex items-start gap-3 opacity-90">
              <i class="material-icons-outlined text-accent mt-0.5" aria-hidden="true"
                >verified_user</i
              >
              <span>Free 30-min discovery call with your dedicated advisor</span>
            </li>
            <li class="flex items-start gap-3 opacity-90">
              <i class="material-icons-outlined text-accent mt-0.5" aria-hidden="true"
                >handshake</i
              >
              <span>Empanelled CAs, lawyers, agents — auto-routed by language &amp; city</span>
            </li>
            <li class="flex items-start gap-3 opacity-90">
              <i class="material-icons-outlined text-accent mt-0.5" aria-hidden="true">lock</i>
              <span>Bank-grade document vault, escrow payments, transparent pricing</span>
            </li>
          </ul>
        </div>

        <p class="hidden lg:block text-xs opacity-50">
          © 2026 MyBharatConnects. All rights reserved.
        </p>
      </aside>

      <!-- Fixed top-left on mobile/tablet — desktop already has the logo link in the aside -->
      <a
        routerLink="/"
        class="lg:hidden fixed top-4 left-4 z-20 bb-btn bb-btn-ghost bb-btn-sm"
        aria-label="Back to home"
      >
        <i class="material-icons-outlined text-base">arrow_back</i>
        <span>Home</span>
      </a>

      <!-- ── Form panel ── -->
      <section
        class="flex flex-col justify-start lg:justify-center px-6 sm:px-12 lg:px-16 pt-16 sm:pt-8 lg:pt-10 pb-6 sm:pb-8 lg:pb-10 max-w-2xl w-full mx-auto lg:mx-0 lg:max-w-none overflow-y-auto scrollbar-none"
      >
        <div class="w-full max-w-lg sm:max-w-2xl lg:max-w-lg mx-auto lg:mx-0">
          <p class="text-sm sm:text-base font-medium text-base-content/80 mb-3 sm:mb-6">
            Already have an account?
            <a routerLink="/auth/login" class="text-primary font-bold hover:underline">Sign in</a>
          </p>

          @if (successMessage) {
            <div role="status" class="alert alert-success text-sm mb-5">
              <i class="material-icons-outlined" aria-hidden="true">check_circle</i>
              <span>{{ successMessage }}</span>
            </div>
          }
          @if (errorMessage) {
            <div role="alert" class="alert alert-error text-sm mb-5 flex-col items-start">
              <div class="flex gap-2 items-center">
                <i class="material-icons-outlined" aria-hidden="true">error_outline</i>
                <span>{{ errorMessage }}</span>
              </div>
              @if (errorList && errorList.length > 1) {
                <ul class="list-disc ml-8 mt-2 text-xs space-y-1">
                  @for (e of errorList; track e) {
                    <li>{{ e }}</li>
                  }
                </ul>
              }
            </div>
          }

          <form [formGroup]="registerForm" (ngSubmit)="onSubmit()" class="flex flex-col gap-3 sm:gap-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3 sm:gap-4">
              <label class="form-control w-full">
                <div class="label pb-1">
                  <span class="label-text font-semibold text-xs uppercase tracking-wide"
                    >Full Name</span
                  >
                </div>
                <input
                  id="reg-name"
                  class="input input-bordered w-full h-12"
                  [class.input-error]="f['name'].invalid && f['name'].touched"
                  formControlName="name"
                  placeholder="e.g. Priya Sharma"
                  autocomplete="name"
                />
                @if (f['name'].invalid && f['name'].touched) {
                  <div class="label py-1">
                    <span class="label-text-alt text-error">Required</span>
                  </div>
                }
              </label>

              <label class="form-control w-full">
                <div class="label pb-1">
                  <span class="label-text font-semibold text-xs uppercase tracking-wide"
                    >Email Address</span
                  >
                </div>
                <input
                  id="reg-email"
                  class="input input-bordered w-full h-12"
                  [class.input-error]="f['email'].invalid && f['email'].touched"
                  type="email"
                  formControlName="email"
                  placeholder="you@example.com"
                  autocomplete="email"
                />
                @if (f['email'].invalid && f['email'].touched) {
                  <div class="label py-1">
                    <span class="label-text-alt text-error">Enter a valid email address</span>
                  </div>
                }
              </label>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3 sm:gap-4">
              <label class="form-control w-full">
                <div class="label pb-1">
                  <span class="label-text font-semibold text-xs uppercase tracking-wide"
                    >Password</span
                  >
                </div>
                <div class="relative">
                  <input
                    id="reg-password"
                    class="input input-bordered w-full h-12 pr-11"
                    [class.input-error]="f['password'].invalid && f['password'].touched"
                    [type]="showPassword ? 'text' : 'password'"
                    formControlName="password"
                    placeholder="Min. 8 characters"
                    autocomplete="new-password"
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
                @if (f['password'].hasError('minlength') && f['password'].touched) {
                  <div class="label py-1">
                    <span class="label-text-alt text-error">Minimum 8 characters</span>
                  </div>
                }
              </label>

              <label class="form-control w-full">
                <div class="label pb-1">
                  <span class="label-text font-semibold text-xs uppercase tracking-wide"
                    >Confirm Password</span
                  >
                </div>
                <input
                  id="reg-confirm-password"
                  class="input input-bordered w-full h-12"
                  [class.input-error]="
                    registerForm.hasError('passwordMismatch') && f['confirmPassword'].touched
                  "
                  type="password"
                  formControlName="confirmPassword"
                  placeholder="Repeat password"
                  autocomplete="new-password"
                />
                @if (registerForm.hasError('passwordMismatch') && f['confirmPassword'].touched) {
                  <div class="label py-1">
                    <span class="label-text-alt text-error">Passwords do not match</span>
                  </div>
                }
              </label>
            </div>

            <div class="form-control">
              <label class="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  class="checkbox checkbox-primary shrink-0"
                  formControlName="termsAccepted"
                  id="reg-terms"
                />
                <span class="text-sm text-base-content/70 select-none">
                  I agree to the
                  <a routerLink="/terms" class="text-primary hover:underline"
                    >Terms &amp; Conditions</a
                  >
                  and
                  <a routerLink="/privacy" class="text-primary hover:underline">Privacy Policy</a>.
                </span>
              </label>
              @if (f['termsAccepted'].invalid && f['termsAccepted'].touched) {
                <p class="text-xs text-error mt-1 ml-7">You must accept the terms to continue.</p>
              }
            </div>

            <button
              class="bb-btn bb-btn-primary w-full h-12 mt-2"
              type="submit"
              [disabled]="loading"
            >
              @if (loading) {
                <span class="loading loading-spinner loading-sm" aria-label="Loading"></span>
              } @else {
                <span>Create Account</span>
                <i class="material-icons-outlined" aria-hidden="true">arrow_forward</i>
              }
            </button>

            <div class="divider text-xs text-base-content/50 my-1">OR</div>

            <button
              type="button"
              class="bb-btn bb-btn-outline bb-btn-google w-full h-11 sm:h-12 gap-3"
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
          </form>
        </div>
      </section>
    </main>
  `,
  styles: [
    `
      section::-webkit-scrollbar {
        display: none;
      }
      section {
        scrollbar-width: none;
      }
    `,
  ],
})
export class RegisterComponent implements OnInit {
  registerForm!: FormGroup;
  loading = false;
  errorMessage = '';
  errorList: string[] | undefined;
  successMessage = '';
  showPassword = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private recaptcha: RecaptchaService,
  ) {}

  get f() {
    return this.registerForm.controls;
  }

  ngOnInit(): void {
    this.registerForm = this.fb.group(
      {
        name: ['', Validators.required],
        email: ['', [Validators.required, Validators.email]],
        password: ['', [Validators.required, Validators.minLength(8)]],
        confirmPassword: ['', Validators.required],
        termsAccepted: [false, Validators.requiredTrue],
      },
      { validators: passwordMatchValidator },
    );
  }

  continueWithGoogle(): void {
    // Same as login — fetch a state token, redirect to Google. New Google
    // accounts get auto-created with role CLIENT in handleGoogleLogin.
    this.authService.startGoogleLogin().subscribe({
      error: (err) => {
        this.errorMessage = extractApiError(
          err,
          'Could not start Google sign-in. Please try again.',
        ).message;
      },
    });
  }

  async onSubmit(): Promise<void> {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }
    this.loading = true;
    this.errorMessage = '';
    this.errorList = undefined;
    const { name, email, password } = this.registerForm.value;
    const recaptchaToken = await this.recaptcha.execute('register');
    this.authService.register({ name, email, password, recaptchaToken }).subscribe({
      next: () => {
        this.loading = false;
        this.successMessage = 'Account created! Redirecting to sign in...';
        setTimeout(() => this.router.navigate(['/auth/login']), 2000);
      },
      error: (err) => {
        this.loading = false;
        const e = extractApiError(err, 'Registration failed. Please try again.');
        this.errorMessage = e.message;
        this.errorList = e.errors;
      },
    });
  }
}
