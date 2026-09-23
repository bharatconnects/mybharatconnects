import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/auth/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { User } from '../../../core/models/user.model';
import { extractApiError } from '../../../core/services/api-error';
import { PageTitleService } from '../../../core/services/page-title.service';
import { PhoneInputComponent } from '../phone-input/phone-input.component';
import { BbSelectComponent } from '../bb-select/bb-select.component';

function strongPassword(control: AbstractControl): ValidationErrors | null {
  const v = (control.value ?? '') as string;
  if (!v) return null;
  const hasUpper = /[A-Z]/.test(v);
  const hasLower = /[a-z]/.test(v);
  const hasDigit = /\d/.test(v);
  const hasSpecial = /[\W_]/.test(v);
  return hasUpper && hasLower && hasDigit && hasSpecial ? null : { weakPassword: true };
}

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const a = group.get('newPassword')?.value;
  const b = group.get('confirmPassword')?.value;
  return a && b && a !== b ? { passwordMismatch: true } : null;
}

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Admin',
  OPS_FINANCE: 'Ops & Finance',
  QA: 'QA',
  CASE_MANAGER: 'Case Manager',
  VENDOR: 'Vendor',
  CLIENT: 'Client',
};

@Component({
  selector: 'app-my-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, PhoneInputComponent, BbSelectComponent],
  template: `
    @if (loading) {
      <div class="flex justify-center py-16">
        <span
          class="loading loading-spinner loading-md text-primary"
          aria-label="Loading profile"
        ></span>
      </div>
    } @else if (loadError) {
      <div role="alert" class="alert alert-error">
        <i class="material-icons-outlined">error_outline</i>
        <div class="flex-1">
          <h3 class="font-bold">Could not load profile</h3>
          <p class="text-sm">{{ loadError }}</p>
        </div>
        <button class="bb-btn bb-btn-ghost bb-btn-sm" (click)="loadProfile()">Retry</button>
      </div>
    } @else {
      <div class="flex flex-col gap-4 lg:gap-6">
        <!-- Personal details -->
        <div class="bb-card">
          <div class="bb-card-body">
            <div class="flex items-start justify-between gap-3 mb-1">
              <h3 class="bb-section-title !mb-0">Personal details</h3>
              @if (user?.createdAt) {
                <span class="text-xs text-base-content/50 mt-1 whitespace-nowrap">
                  Joined {{ user!.createdAt | date: 'mediumDate' }}
                </span>
              }
            </div>
            <p class="bb-section-subtitle">
              Your name and contact info, visible to your case manager and team.
            </p>

            <form [formGroup]="profileForm" (ngSubmit)="saveProfile()" class="flex flex-col gap-4">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label class="bb-label" for="prof-name">Name</label>
                  <input
                    id="prof-name"
                    class="bb-input"
                    formControlName="name"
                    autocomplete="name"
                    placeholder="Your full name"
                  />
                  @if (profileForm.get('name')?.invalid && profileForm.get('name')?.touched) {
                    <span class="bb-error-text">Name is required</span>
                  }
                </div>
                <div>
                  <label class="bb-label" for="prof-email">Email</label>
                  <input
                    id="prof-email"
                    class="bb-input"
                    type="email"
                    [value]="user?.email"
                    disabled
                    autocomplete="email"
                  />
                  <span class="bb-hint">Contact support to change.</span>
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label class="bb-label" for="prof-phone"
                    >Phone <span class="font-normal text-base-content/60">(optional)</span></label
                  >
                  <app-phone-input
                    inputId="prof-phone"
                    formControlName="phone"
                    defaultCountryIso2="IN"
                    placeholder="98765 43210"
                  />
                </div>
                <div>
                  <label class="bb-label" for="prof-presence">Availability</label>
                  <app-bb-select
                    id="prof-presence"
                    formControlName="presence"
                    [options]="presenceOptions"
                  ></app-bb-select>
                </div>
                <div>
                  <label class="bb-label" for="prof-status"
                    >Status message
                    <span class="font-normal text-base-content/60">(optional)</span></label
                  >
                  <input
                    id="prof-status"
                    class="bb-input"
                    formControlName="statusMessage"
                    maxlength="160"
                    placeholder="In meetings until 4 PM"
                  />
                </div>
              </div>

              <div class="flex justify-end pt-2 border-t border-base-300">
                <button
                  type="submit"
                  class="bb-btn bb-btn-primary"
                  [disabled]="profileSaving || profileForm.invalid || !profileForm.dirty"
                >
                  <i class="material-icons-outlined text-base">{{
                    profileSaving ? 'hourglass_empty' : 'save'
                  }}</i>
                  {{ profileSaving ? 'Saving…' : 'Save changes' }}
                </button>
              </div>
            </form>
          </div>
        </div>


        <!-- Change password -->
        <div class="bb-card">
          <div class="bb-card-body">
            <h3 class="bb-section-title">Change password</h3>
            <p class="bb-section-subtitle">
              Strong passwords have upper + lower + number + symbol, min 8 characters.
            </p>

            <form
              [formGroup]="passwordForm"
              (ngSubmit)="changePassword()"
              class="flex flex-col gap-4"
            >
              <div>
                <label class="bb-label" for="pw-current">Current password</label>
                <div class="relative">
                  <input
                    id="pw-current"
                    class="bb-input pr-11"
                    [type]="showCurrentPassword ? 'text' : 'password'"
                    formControlName="currentPassword"
                    autocomplete="current-password"
                  />
                  <button
                    type="button"
                    class="absolute right-2 top-1/2 -translate-y-1/2 text-base-content/50 hover:text-base-content transition-colors"
                    (click)="showCurrentPassword = !showCurrentPassword"
                    [attr.aria-label]="showCurrentPassword ? 'Hide password' : 'Show password'"
                  >
                    <i class="material-icons-outlined text-lg" aria-hidden="true">{{
                      showCurrentPassword ? 'visibility_off' : 'visibility'
                    }}</i>
                  </button>
                </div>
                @if (
                  passwordForm.get('currentPassword')?.invalid &&
                  passwordForm.get('currentPassword')?.touched
                ) {
                  <span class="bb-error-text">Current password is required</span>
                }
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label class="bb-label" for="pw-new">New password</label>
                  <div class="relative">
                    <input
                      id="pw-new"
                      class="bb-input pr-11"
                      [type]="showNewPassword ? 'text' : 'password'"
                      formControlName="newPassword"
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
                  @if (
                    passwordForm.get('newPassword')?.touched &&
                    passwordForm.get('newPassword')?.hasError('required')
                  ) {
                    <span class="bb-error-text">New password is required</span>
                  } @else if (
                    passwordForm.get('newPassword')?.touched &&
                    passwordForm.get('newPassword')?.hasError('minlength')
                  ) {
                    <span class="bb-error-text">At least 8 characters</span>
                  } @else if (
                    passwordForm.get('newPassword')?.touched &&
                    passwordForm.get('newPassword')?.hasError('weakPassword')
                  ) {
                    <span class="bb-error-text">Add upper + lower + number + symbol</span>
                  }
                </div>
                <div>
                  <label class="bb-label" for="pw-confirm">Confirm new password</label>
                  <div class="relative">
                    <input
                      id="pw-confirm"
                      class="bb-input pr-11"
                      [type]="showConfirmPassword ? 'text' : 'password'"
                      formControlName="confirmPassword"
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
                  @if (
                    passwordForm.hasError('passwordMismatch') &&
                    passwordForm.get('confirmPassword')?.touched
                  ) {
                    <span class="bb-error-text">Passwords don't match</span>
                  }
                </div>
              </div>

              <div class="flex justify-end pt-2 border-t border-base-300">
                <button
                  type="submit"
                  class="bb-btn bb-btn-primary"
                  [disabled]="passwordSaving || passwordForm.invalid"
                >
                  <i class="material-icons-outlined text-base">{{
                    passwordSaving ? 'hourglass_empty' : 'lock_reset'
                  }}</i>
                  {{ passwordSaving ? 'Updating…' : 'Update password' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    }
  `,
  styles: [],
})
export class MyProfileComponent implements OnInit {
  loading = true;
  loadError = '';
  user: User | null = null;
  readonly presenceOptions = [
    { value: 'ONLINE', label: 'Online' },
    { value: 'AWAY', label: 'Away' },
  ];

  profileForm!: FormGroup;
  passwordForm!: FormGroup;
  showCurrentPassword = false;
  showNewPassword = false;
  showConfirmPassword = false;
  profileSaving = false;
  passwordSaving = false;

  get isClient(): boolean {
    return this.user?.role === 'CLIENT';
  }

  constructor(
    private fb: FormBuilder,
    private api: ApiService,
    private auth: AuthService,
    private toast: ToastService,
    private pageTitleService: PageTitleService,
  ) {}

  ngOnInit(): void {
    this.pageTitleService.set('My Profile');
    this.profileForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(96)]],
      phone: [''],
      presence: ['ONLINE', [Validators.required]],
      statusMessage: ['', [Validators.maxLength(160)]],
    });

    this.passwordForm = this.fb.group(
      {
        currentPassword: ['', [Validators.required]],
        newPassword: ['', [Validators.required, Validators.minLength(8), strongPassword]],
        confirmPassword: ['', [Validators.required]],
      },
      { validators: passwordsMatch },
    );

    this.loadProfile();
  }

  get initials(): string {
    const parts = (this.user?.name || '').trim().split(/\s+/).filter(Boolean);
    const a = (parts[0]?.[0] || '').toUpperCase();
    const b = (parts.length > 1 ? parts[parts.length - 1][0] : '').toUpperCase();
    return `${a}${b}` || '?';
  }

  get fullName(): string {
    return (this.user?.name ?? '').trim() || '—';
  }

  get roleLabel(): string {
    return this.user?.role ? (ROLE_LABEL[this.user.role] ?? this.user.role) : '';
  }

  loadProfile(): void {
    this.loading = true;
    this.loadError = '';
    this.api.get<User>('/users/me').subscribe({
      next: (u) => {
        this.user = u;
        this.profileForm.patchValue(
          {
            name: u.name ?? '',
            phone: u.phone ?? '',
            presence: u.presence ?? 'ONLINE',
            statusMessage: u.statusMessage ?? '',
          },
          { emitEvent: false },
        );
        this.profileForm.markAsPristine();
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.loadError = extractApiError(err, 'Failed to load profile').message;
      },
    });
  }

  saveProfile(): void {
    if (this.profileForm.invalid || this.profileSaving) {
      this.profileForm.markAllAsTouched();
      return;
    }
    this.profileSaving = true;
    const { name, phone, presence, statusMessage } = this.profileForm.value;
    this.api
      .patch<User>('/users/me', { name, phone, presence, statusMessage })
      .subscribe({
        next: (u) => {
          this.user = u;
          this.profileForm.markAsPristine();
          this.profileSaving = false;
          this.auth.patchCurrentUser({
            name: u.name,
            phone: u.phone,
            presence: u.presence,
            statusMessage: u.statusMessage,
          });
          this.toast.success('Profile updated');
        },
        error: (err) => {
          this.profileSaving = false;
          this.toast.error(extractApiError(err, 'Failed to save profile').message);
        },
      });
  }

  changePassword(): void {
    if (this.passwordForm.invalid || this.passwordSaving) {
      this.passwordForm.markAllAsTouched();
      return;
    }
    this.passwordSaving = true;
    const { currentPassword, newPassword } = this.passwordForm.value;
    this.api
      .patch<{ message: string }>('/users/me/password', { currentPassword, newPassword })
      .subscribe({
        next: () => {
          this.passwordSaving = false;
          this.passwordForm.reset();
          this.toast.success('Password updated');
        },
        error: (err) => {
          this.passwordSaving = false;
          this.toast.error(extractApiError(err, 'Failed to change password').message);
        },
      });
  }
}
