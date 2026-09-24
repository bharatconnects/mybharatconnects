import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { extractApiError } from '../../core/services/api-error';
import { BrandLogoComponent } from '../../shared/components/brand-logo/brand-logo.component';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, BrandLogoComponent],
  template: `
    <main class="min-h-screen bg-base-100 flex flex-col items-center justify-center p-4 sm:p-8">
      <a class="mb-8 sm:mb-10 inline-flex" routerLink="/" aria-label="MyBharatConnects home">
        <app-brand-logo variant="lockup" [size]="38"></app-brand-logo>
      </a>

      <section class="card w-full max-w-md bg-base-100 shadow-sm border border-base-300">
        <header class="px-6 sm:px-9 pt-8 pb-6 border-b border-base-300">
          <p class="font-mono text-[13px] tracking-widest text-primary mb-2">PASSWORD RESET</p>
          <h1 class="font-serif text-2xl font-light text-base-content leading-tight">Forgot your password?</h1>
          <p class="text-sm text-base-content/70 mt-2">
            Enter your email and we'll send you a link to reset your password.
          </p>
        </header>

        <div class="card-body p-6 sm:p-9">
          @if (successMessage) {
            <div role="status" class="alert alert-success text-sm mb-4">
              <i class="material-icons-outlined" aria-hidden="true">check_circle</i>
              <span>{{ successMessage }}</span>
            </div>
          }

          <form [formGroup]="form" (ngSubmit)="onSubmit()" class="flex flex-col gap-4">
            <label class="form-control w-full">
              <div class="label">
                <span class="label-text font-semibold text-xs uppercase tracking-wide">Email Address</span>
              </div>
              <input
                id="fp-email"
                class="input input-bordered w-full"
                [class.input-error]="form.get('email')?.invalid && form.get('email')?.touched"
                type="email"
                formControlName="email"
                placeholder="you@example.com"
                autocomplete="email"
              />
              @if (form.get('email')?.invalid && form.get('email')?.touched) {
                <div class="label">
                  <span class="label-text-alt text-error">Enter a valid email address</span>
                </div>
              }
            </label>

            @if (errorMessage) {
              <div role="alert" class="alert alert-error text-sm">
                <i class="material-icons-outlined" aria-hidden="true">error_outline</i>
                <span>{{ errorMessage }}</span>
              </div>
            }

            <button class="bb-btn bb-btn-primary w-full h-12" type="submit" [disabled]="loading || !!successMessage">
              @if (loading) {
                <span class="loading loading-spinner loading-sm" aria-label="Loading"></span>
              } @else {
                <span>Send reset link</span>
                <i class="material-icons-outlined" aria-hidden="true">arrow_forward</i>
              }
            </button>
          </form>
        </div>

        <footer class="px-6 sm:px-9 py-5 border-t border-base-300 text-center text-sm text-base-content/70">
          Remembered your password?
          <a routerLink="/auth/login" class="text-primary font-semibold hover:underline">Back to sign in</a>
        </footer>
      </section>
    </main>
  `,
})
export class ForgotPasswordComponent implements OnInit {
  form!: FormGroup;
  loading = false;
  errorMessage = '';
  successMessage = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
    });
  }

  onSubmit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';
    const email = this.form.get('email')?.value;
    this.authService.requestPasswordReset(email).subscribe({
      next: () => {
        this.loading = false;
        this.successMessage = 'If the email exists, a reset link has been sent. Check your inbox.';
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = extractApiError(err, 'Unable to process the request. Please try again.').message;
      },
    });
  }
}

