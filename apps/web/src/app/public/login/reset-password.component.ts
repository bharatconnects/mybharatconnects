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
    <main class="min-h-screen bg-base-100 flex flex-col items-center justify-center p-4 sm:p-8">
      <a class="mb-8 sm:mb-10 inline-flex" routerLink="/" aria-label="MyBharatConnects home">
        <app-brand-logo variant="lockup" [size]="38"></app-brand-logo>
      </a>

      <section class="card w-full max-w-md bg-base-100 shadow-sm border border-base-300">
        <header class="px-6 sm:px-9 pt-8 pb-6 border-b border-base-300">
          <p class="font-mono text-[10px] tracking-widest text-primary mb-2">PASSWORD RESET</p>
          <h1 class="font-serif text-2xl font-light text-base-content leading-tight">Set a new password</h1>
          <p class="text-sm text-base-content/70 mt-2">
            Choose a strong password with upper &amp; lower case, a number and a special character.
          </p>
        </header>

        <div class="card-body p-6 sm:p-9">
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

          <form [formGroup]="form" (ngSubmit)="onSubmit()" class="flex flex-col gap-4">
            <label class="form-control w-full">
              <div class="label">
                <span class="label-text font-semibold text-xs uppercase tracking-wide">New Password</span>
              </div>
              <div class="relative">
                <input
                  id="rp-new-password"
                  class="input input-bordered w-full pr-11"
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
                <div class="label"><span class="label-text-alt text-error">Minimum 8 characters</span></div>
              }
              @if (f['newPassword'].hasError('pattern') && f['newPassword'].touched) {
                <div class="label">
                  <span class="label-text-alt text-error">Must include upper, lower, number and a special character</span>
                </div>
              }
            </label>

            <label class="form-control w-full">
              <div class="label">
                <span class="label-text font-semibold text-xs uppercase tracking-wide">Confirm Password</span>
              </div>
              <div class="relative">
                <input
                  id="rp-confirm-password"
                  class="input input-bordered w-full pr-11"
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
                <div class="label"><span class="label-text-alt text-error">Passwords do not match</span></div>
              }
            </label>

            <button class="bb-btn bb-btn-primary w-full h-12" type="submit" [disabled]="loading || !!successMessage">
              @if (loading) {
                <span class="loading loading-spinner loading-sm" aria-label="Loading"></span>
              } @else {
                <span>Reset password</span>
                <i class="material-icons-outlined" aria-hidden="true">arrow_forward</i>
              }
            </button>
          </form>
        </div>

        <footer class="px-6 sm:px-9 py-5 border-t border-base-300 text-center text-sm text-base-content/70">
          <a routerLink="/auth/login" class="text-primary font-semibold hover:underline">Back to sign in</a>
        </footer>
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

