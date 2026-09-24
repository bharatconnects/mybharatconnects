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
          <div class="hidden lg:flex items-center justify-between mb-8 gap-4">
            <a
              routerLink="/"
              class="inline-flex bb-btn bb-btn-ghost bb-btn-sm shrink-0"
              aria-label="Back to home"
            >
              <i class="material-icons-outlined text-base">arrow_back</i>
              <span>Back</span>
            </a>

            <p class="text-sm font-medium text-base-content/80">
              Remembered your password?
              <a routerLink="/auth/login" class="text-primary font-bold hover:underline">Sign in</a>
            </p>
          </div>

          <header class="mb-6 sm:mb-8">
            <p class="font-mono text-[13px] font-semibold tracking-widest text-primary mb-2">
              PASSWORD RESET
            </p>
            <h1 class="font-serif text-2xl sm:text-4xl font-light leading-tight text-base-content">
              Forgot your password?
            </h1>
            <p class="text-sm text-base-content/80 mt-3">
              Enter your email and we'll send you a link to reset your password.
            </p>
          </header>

          @if (successMessage) {
            <div role="status" class="alert alert-success text-sm mb-4">
              <i class="material-icons-outlined" aria-hidden="true">check_circle</i>
              <span>{{ successMessage }}</span>
            </div>
          }

          <form [formGroup]="form" (ngSubmit)="onSubmit()" class="flex flex-col gap-3 sm:gap-4">
            <label class="form-control w-full">
              <div class="label pb-1 sm:pb-2">
                <span
                  class="label-text text-sm font-semibold text-base-content uppercase tracking-wide"
                  >Email Address</span
                >
              </div>
              <input
                id="fp-email"
                class="bb-input"
                [class.input-error]="form.get('email')?.invalid && form.get('email')?.touched"
                type="email"
                formControlName="email"
                placeholder="you@example.com"
                autocomplete="email"
              />
              @if (form.get('email')?.invalid && form.get('email')?.touched) {
                <div class="label py-1">
                  <span class="label-text-alt text-error text-xs">Enter a valid email address</span>
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
              [disabled]="loading || !!successMessage"
            >
              @if (loading) {
                <span class="loading loading-spinner loading-sm" aria-label="Loading"></span>
              } @else {
                <span>Send reset link</span>
                <i class="material-icons-outlined" aria-hidden="true">arrow_forward</i>
              }
            </button>

            <p class="lg:hidden text-center text-base font-medium text-base-content/80 mt-3">
              Remembered your password?
              <a routerLink="/auth/login" class="text-primary font-bold hover:underline">Sign in</a>
            </p>
          </form>
        </div>
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

