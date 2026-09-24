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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { extractApiError } from '../../core/services/api-error';
import { BrandLogoComponent } from '../../shared/components/brand-logo/brand-logo.component';

function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const newPassword = control.get('newPassword')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;
  return newPassword === confirmPassword ? null : { passwordMismatch: true };
}

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

@Component({
  selector: 'app-reset-password',
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

      <!-- Fixed top-left on mobile/tablet — desktop gets its own copy inside the form panel below -->
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
        class="flex flex-col justify-center px-6 sm:px-12 lg:px-16 pt-16 sm:pt-10 lg:pt-14 pb-6 sm:pb-8 lg:pb-10 max-w-2xl w-full mx-auto lg:mx-0 lg:max-w-none overflow-y-auto scrollbar-none"
      >
        <div class="w-full max-w-lg mx-auto lg:mx-0">
          <div class="hidden lg:flex items-center mb-8 gap-4">
            <a
              routerLink="/"
              class="inline-flex bb-btn bb-btn-ghost bb-btn-sm shrink-0"
              aria-label="Back to home"
            >
              <i class="material-icons-outlined text-base">arrow_back</i>
              <span>Back</span>
            </a>
          </div>

          <header class="mb-6 sm:mb-8">
            <p class="font-mono text-[13px] font-semibold tracking-widest text-primary mb-2">
              PASSWORD RESET
            </p>
            <h1 class="font-serif text-2xl sm:text-4xl font-light leading-tight text-base-content">
              Set a new password
            </h1>
            <p class="text-sm text-base-content/80 mt-3">
              Choose a strong password with upper &amp; lower case, a number and a special character.
            </p>
          </header>

          @if (successMessage) {
            <div role="status" class="alert alert-success text-sm mb-4">
              <i class="material-icons-outlined" aria-hidden="true">check_circle</i>
              <span>{{ successMessage }}</span>
            </div>
          }
          @if (errorMessage) {
            <div role="alert" class="alert alert-error text-sm mb-4 flex-col items-start">
              <div class="flex gap-2 items-center">
                <i class="material-icons-outlined" aria-hidden="true">error_outline</i>
                <span>{{ errorMessage }}</span>
              </div>
              @if (errorList && errorList.length > 1) {
                <ul class="list-disc ml-8 mt-2 text-xs">
                  @for (e of errorList; track e) { <li>{{ e }}</li> }
                </ul>
              }
            </div>
          }

          <form [formGroup]="form" (ngSubmit)="onSubmit()" class="flex flex-col gap-3 sm:gap-4">
            <label class="form-control w-full">
              <div class="label pb-1 sm:pb-2">
                <span
                  class="label-text text-sm font-semibold text-base-content uppercase tracking-wide"
                  >New Password</span
                >
              </div>
              <div class="relative">
                <input
                  id="rp-new-password"
                  class="bb-input pr-11"
                  [class.input-error]="f['newPassword'].invalid && f['newPassword'].touched"
                  [type]="showNewPassword ? 'text' : 'password'"
                  formControlName="newPassword"
                  placeholder="Min. 8 chars with mixed case, number & symbol"
                  autocomplete="new-password"
                />
                <button
                  type="button"
                  class="absolute right-2 top-1/2 -translate-y-1/2 text-base-content/50 hover:text-base-content transition-colors"
                  (click)="showNewPassword = !showNewPassword"
                  [attr.aria-label]="showNewPassword ? 'Hide password' : 'Show password'"
                >
                  <i class="material-icons-outlined text-lg" aria-hidden="true">{{
                    showNewPassword ? 'visibility_off' : 'visibility'
                  }}</i>
                </button>
              </div>
              @if (f['newPassword'].hasError('minlength') && f['newPassword'].touched) {
                <div class="label py-1">
                  <span class="label-text-alt text-error text-xs">Minimum 8 characters</span>
                </div>
              }
              @if (f['newPassword'].hasError('pattern') && f['newPassword'].touched) {
                <div class="label py-1">
                  <span class="label-text-alt text-error text-xs"
                    >Must include upper, lower, number and a special character</span
                  >
                </div>
              }
            </label>

            <label class="form-control w-full">
              <div class="label pb-1 sm:pb-2">
                <span
                  class="label-text text-sm font-semibold text-base-content uppercase tracking-wide"
                  >Confirm Password</span
                >
              </div>
              <div class="relative">
                <input
                  id="rp-confirm-password"
                  class="bb-input pr-11"
                  [class.input-error]="form.hasError('passwordMismatch') && f['confirmPassword'].touched"
                  [type]="showConfirmPassword ? 'text' : 'password'"
                  formControlName="confirmPassword"
                  placeholder="Repeat new password"
                  autocomplete="new-password"
                />
                <button
                  type="button"
                  class="absolute right-2 top-1/2 -translate-y-1/2 text-base-content/50 hover:text-base-content transition-colors"
                  (click)="showConfirmPassword = !showConfirmPassword"
                  [attr.aria-label]="showConfirmPassword ? 'Hide password' : 'Show password'"
                >
                  <i class="material-icons-outlined text-lg" aria-hidden="true">{{
                    showConfirmPassword ? 'visibility_off' : 'visibility'
                  }}</i>
                </button>
              </div>
              @if (form.hasError('passwordMismatch') && f['confirmPassword'].touched) {
                <div class="label py-1">
                  <span class="label-text-alt text-error text-xs">Passwords do not match</span>
                </div>
              }
            </label>

            <button
              class="bb-btn bb-btn-primary w-full h-12 text-base font-semibold"
              type="submit"
              [disabled]="loading || !!successMessage"
            >
              @if (loading) {
                <span class="loading loading-spinner loading-sm" aria-label="Loading"></span>
              } @else {
                <span>Reset password</span>
                <i class="material-icons-outlined" aria-hidden="true">arrow_forward</i>
              }
            </button>

            <p class="lg:hidden text-center text-base font-medium text-base-content/80 mt-3">
              <a routerLink="/auth/login" class="text-primary font-bold hover:underline">Back to sign in</a>
            </p>
          </form>
        </div>
      </section>
    </main>
  `,
})
export class ResetPasswordComponent implements OnInit {
  form!: FormGroup;
  loading = false;
  errorMessage = '';
  errorList: string[] | undefined;
  successMessage = '';
  showNewPassword = false;
  showConfirmPassword = false;
  private token = '';
  private email = '';

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
  ) {}

  get f() { return this.form.controls; }

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    this.token = params.get('token') ?? '';
    this.email = params.get('email') ?? '';

    if (!this.token || !this.email) {
      this.router.navigate(['/auth/login'], { queryParams: { error: 'invalid_reset_link' } });
      return;
    }

    this.form = this.fb.group(
      {
        newPassword: ['', [Validators.required, Validators.minLength(8), Validators.pattern(PASSWORD_REGEX)]],
        confirmPassword: ['', Validators.required],
      },
      { validators: passwordMatchValidator },
    );
  }

  onSubmit(): void {
    if (!this.form || this.form.invalid) { this.form?.markAllAsTouched(); return; }
    this.loading = true;
    this.errorMessage = '';
    this.errorList = undefined;
    const newPassword = this.form.get('newPassword')?.value;
    this.authService.resetPassword(this.email, this.token, newPassword).subscribe({
      next: () => {
        this.loading = false;
        this.successMessage = 'Password reset successfully. Redirecting to sign in...';
        setTimeout(() => this.router.navigate(['/auth/login']), 2000);
      },
      error: (err) => {
        this.loading = false;
        const e = extractApiError(err, 'Unable to reset password. The link may have expired.');
        this.errorMessage = e.message;
        this.errorList = e.errors;
      },
    });
  }
}

