import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { extractApiError } from '../../../core/services/api-error';
import { PageTitleService } from '../../../core/services/page-title.service';
import { ToastService } from '../../../core/services/toast.service';
import { TagMultiselectComponent } from '../../../shared/components/tag-multiselect/tag-multiselect.component';
import { CITY_OPTIONS } from '../../../shared/data/cities';
import { LANGUAGE_OPTIONS } from '../../../shared/data/languages';
import { VERTICAL_NAMES } from '../../../shared/data/service-catalog';

interface VendorUserRef {
  _id: string;
  name?: string;
  email?: string;
}

interface AdminVendor {
  _id: string;
  userId: VendorUserRef | string;
  businessName: string;
  serviceTypes: string[];
  cities: string[];
  languages?: string[];
  rating: number;
  totalJobs?: number;
  completedJobs?: number;
  currentJobs?: number;
  maxConcurrentJobs?: number;
  isAvailable: boolean;
  isVerified: boolean;
  bankDetails?: { accountNumber?: string; ifsc?: string; accountName?: string };
}

interface UnregisteredUser {
  _id: string;
  name: string;
  email: string;
  isActive: boolean;
}

interface VendorForm {
  userId: string;
  businessName: string;
  serviceTypes: string[];
  cities: string[];
  languages: string[];
  maxConcurrentJobs: number;
  isVerified: boolean;
  accountName: string;
  accountNumber: string;
  ifsc: string;
}

@Component({
  selector: 'app-admin-vendors',
  standalone: true,
  imports: [CommonModule, FormsModule, TagMultiselectComponent],
  template: `
    <div class="flex items-center justify-between gap-3 mb-5">
      <p class="text-sm text-base-content/60">
        Business profiles for vendors: what they offer, where, and whether they can receive jobs.
      </p>
      <span class="bb-page-count">{{ vendors.length }} total</span>
    </div>

    @if (loadError) {
      <div
        role="alert"
        class="flex items-center gap-2 px-4 py-2.5 rounded-lg mb-4 text-sm bg-error/10 text-error border border-error/20"
      >
        <i class="material-icons-outlined text-base">error_outline</i>
        <span class="flex-1">{{ loadError }}</span>
        <button class="bb-btn bb-btn-ghost bb-btn-sm" (click)="load()">Retry</button>
      </div>
    }

    @if (!loading && unregistered.length > 0) {
      <div class="bb-card mb-5 border border-warning/40">
        <div class="bb-card-body">
          <div class="flex items-start gap-3">
            <i class="material-icons-outlined text-warning">warning_amber</i>
            <div class="min-w-0">
              <h3 class="bb-section-title m-0">
                {{ unregistered.length }} vendor
                {{ unregistered.length === 1 ? 'login has' : 'logins have' }} no business profile
              </h3>
              <p class="text-sm text-base-content/70 mt-1">
                They can sign in but see "profile isn't set up" and cannot receive jobs until you
                add one. This also lists accounts whose role was changed to Vendor.
              </p>
            </div>
          </div>
          <div class="flex flex-col divide-y divide-base-200 mt-3">
            @for (u of unregistered; track u._id) {
              <div class="flex items-center justify-between gap-3 py-2">
                <div class="min-w-0">
                  <p class="font-medium truncate">
                    {{ u.name }}
                    @if (!u.isActive) {
                      <span class="bb-chip bb-chip-neutral ml-1">Inactive</span>
                    }
                  </p>
                  <p class="text-sm text-base-content/70 truncate">{{ u.email }}</p>
                </div>
                <button class="bb-btn bb-btn-primary bb-btn-sm shrink-0" (click)="openCreate(u)">
                  <i class="material-icons-outlined text-base">add_business</i>
                  Set up profile
                </button>
              </div>
            }
          </div>
        </div>
      </div>
    }

    @if (loading) {
      <div class="flex justify-center py-16">
        <span class="loading loading-spinner loading-md text-primary" aria-label="Loading"></span>
      </div>
    } @else if (vendors.length === 0) {
      <div class="bb-card">
        <div class="bb-empty">
          <div class="bb-empty-icon"><i class="material-icons-outlined">storefront</i></div>
          <p class="bb-empty-title">No vendor business profiles yet</p>
          <p class="max-w-md">
            Create a user with the Vendor role under Users. It will appear above so you can set up
            its business profile here.
          </p>
        </div>
      </div>
    } @else {
      <!-- Desktop table -->
      <div class="hidden md:block bb-table-wrap">
        <div class="overflow-y-auto max-h-[65vh]">
          <table class="bb-table">
            <thead>
              <tr>
                <th>Business</th>
                <th>Contact</th>
                <th>Services</th>
                <th>Cities</th>
                <th>Rating / jobs</th>
                <th>Available</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (v of vendors; track v._id) {
                <tr>
                  <td>
                    <div class="font-medium">{{ v.businessName }}</div>
                    <span
                      class="bb-chip mt-1"
                      [ngClass]="v.isVerified ? 'bb-chip-success' : 'bb-chip-warning'"
                    >
                      {{ v.isVerified ? 'Verified' : 'Not verified' }}
                    </span>
                  </td>
                  <td>
                    <div>{{ contactName(v) }}</div>
                    <div class="text-xs text-base-content/60">{{ contactEmail(v) }}</div>
                  </td>
                  <td>{{ list(v.serviceTypes) }}</td>
                  <td>{{ list(v.cities) }}</td>
                  <td class="whitespace-nowrap">
                    <div>{{ v.rating | number: '1.1-1' }} / 5</div>
                    <div class="text-xs text-base-content/60">
                      {{ v.currentJobs ?? 0 }} of {{ v.maxConcurrentJobs ?? '—' }} jobs
                    </div>
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      class="toggle toggle-primary toggle-sm"
                      [checked]="v.isAvailable"
                      (change)="toggleAvailability(v)"
                      [attr.aria-label]="'Toggle availability for ' + v.businessName"
                    />
                  </td>
                  <td>
                    <div class="flex items-center gap-1">
                      <button
                        class="bb-btn bb-btn-ghost bb-btn-icon"
                        title="Edit business profile"
                        (click)="openEdit(v)"
                      >
                        <i class="material-icons-outlined">edit</i>
                      </button>
                      <button
                        class="bb-btn bb-btn-ghost bb-btn-icon"
                        [title]="v.isVerified ? 'Remove verification' : 'Verify vendor'"
                        (click)="toggleVerified(v)"
                      >
                        <i class="material-icons-outlined">{{
                          v.isVerified ? 'verified' : 'new_releases'
                        }}</i>
                      </button>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- Mobile card list -->
      <div class="md:hidden flex flex-col gap-3">
        @for (v of vendors; track v._id) {
          <div class="bb-row-card">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="font-medium truncate">{{ v.businessName }}</p>
                <p class="text-sm text-base-content/70 truncate">
                  {{ contactName(v) }} · {{ contactEmail(v) }}
                </p>
              </div>
              <span class="bb-chip" [ngClass]="v.isVerified ? 'bb-chip-success' : 'bb-chip-warning'">
                {{ v.isVerified ? 'Verified' : 'Not verified' }}
              </span>
            </div>
            <p class="text-xs text-base-content/60 mt-2">{{ list(v.serviceTypes) }}</p>
            <p class="text-xs text-base-content/60">{{ list(v.cities) }}</p>
            <div class="flex items-center justify-between mt-2 text-xs text-base-content/60">
              <span>{{ v.rating | number: '1.1-1' }} / 5 · {{ v.currentJobs ?? 0 }} /
                {{ v.maxConcurrentJobs ?? '—' }} jobs</span>
              <label class="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  class="toggle toggle-primary toggle-sm"
                  [checked]="v.isAvailable"
                  (change)="toggleAvailability(v)"
                />
                Available
              </label>
            </div>
            <div class="flex items-center gap-2 mt-2">
              <button class="bb-btn bb-btn-ghost bb-btn-sm" (click)="openEdit(v)">
                <i class="material-icons-outlined">edit</i>
                Edit
              </button>
              <button class="bb-btn bb-btn-ghost bb-btn-sm" (click)="toggleVerified(v)">
                <i class="material-icons-outlined">{{ v.isVerified ? 'verified' : 'new_releases' }}</i>
                {{ v.isVerified ? 'Unverify' : 'Verify' }}
              </button>
            </div>
          </div>
        }
      </div>
    }

    @if (showForm) {
      <div class="modal modal-open">
        <div class="modal-box max-w-2xl relative">
          <h3 class="font-bold text-lg mb-1">
            {{ editingId ? 'Edit business profile' : 'Set up business profile' }}
          </h3>
          @if (formAccountLabel) {
            <p class="text-sm text-base-content/60 mb-3">For {{ formAccountLabel }}</p>
          }
          <button
            class="absolute top-3 right-3 bb-btn bb-btn-ghost bb-btn-icon"
            type="button"
            (click)="closeForm()"
            aria-label="Close"
          >
            <i class="material-icons-outlined">close</i>
          </button>

          @if (formError) {
            <div
              role="alert"
              class="flex items-center gap-2 px-3 py-2 rounded-lg mb-3 text-sm bg-error/10 text-error border border-error/20"
            >
              <i class="material-icons-outlined text-base">error_outline</i>
              {{ formError }}
            </div>
          }

          <div class="flex flex-col gap-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="bb-label" for="av-name">Business name</label>
                <input
                  id="av-name"
                  class="bb-input"
                  [(ngModel)]="form.businessName"
                  placeholder="e.g. Sharma Legal Associates"
                />
              </div>
              <div>
                <label class="bb-label" for="av-max">Max concurrent jobs</label>
                <input
                  id="av-max"
                  class="bb-input"
                  type="number"
                  min="1"
                  max="20"
                  [(ngModel)]="form.maxConcurrentJobs"
                />
              </div>
            </div>

            <div>
              <label class="bb-label">Services offered</label>
              <div class="flex flex-wrap gap-2 mt-1">
                @for (s of serviceOptions; track s) {
                  <button
                    type="button"
                    class="bb-chip"
                    [ngClass]="form.serviceTypes.includes(s) ? 'bb-chip-warning' : 'bb-chip-neutral'"
                    (click)="toggleService(s)"
                  >
                    <i class="material-icons-outlined text-sm leading-none">{{
                      form.serviceTypes.includes(s) ? 'check' : 'add'
                    }}</i>
                    {{ s }}
                  </button>
                }
              </div>
            </div>

            <div>
              <label class="bb-label" for="av-cities">Cities served</label>
              <app-tag-multiselect
                id="av-cities"
                [options]="cityOptions"
                [(ngModel)]="form.cities"
                placeholder="Search or add a city…"
              />
            </div>

            <div>
              <label class="bb-label" for="av-langs">Languages spoken</label>
              <app-tag-multiselect
                id="av-langs"
                [options]="languageOptions"
                [(ngModel)]="form.languages"
                placeholder="Search or add a language…"
              />
            </div>

            <div>
              <label class="bb-label">Bank details for payouts (optional)</label>
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input class="bb-input" placeholder="Account name" [(ngModel)]="form.accountName" />
                <input class="bb-input" placeholder="Account number" [(ngModel)]="form.accountNumber" />
                <input class="bb-input" placeholder="IFSC" [(ngModel)]="form.ifsc" />
              </div>
              <span class="bb-hint">Fill all three or leave all empty.</span>
            </div>

            <label class="flex items-center gap-2 cursor-pointer w-fit">
              <input type="checkbox" class="checkbox checkbox-sm" [(ngModel)]="form.isVerified" />
              <span class="text-sm">
                Verified (only verified, available vendors appear in case routing)
              </span>
            </label>
          </div>

          <div class="modal-action">
            <button class="bb-btn bb-btn-ghost" (click)="closeForm()">Cancel</button>
            <button class="bb-btn bb-btn-primary" [disabled]="saving" (click)="save()">
              @if (saving) {
                <span class="loading loading-spinner loading-xs"></span>
              } @else {
                {{ editingId ? 'Save changes' : 'Create profile' }}
              }
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      thead th {
        position: sticky;
        top: 0;
        z-index: 2;
        background: var(--ivory-soft);
      }
    `,
  ],
})
export class AdminVendorsComponent implements OnInit {
  vendors: AdminVendor[] = [];
  unregistered: UnregisteredUser[] = [];
  loading = true;
  loadError = '';

  serviceOptions = VERTICAL_NAMES;
  cityOptions = CITY_OPTIONS;
  languageOptions = LANGUAGE_OPTIONS;

  showForm = false;
  editingId: string | null = null;
  formAccountLabel = '';
  formError = '';
  saving = false;
  form: VendorForm = this.blankForm();

  constructor(
    private api: ApiService,
    private toast: ToastService,
    private pageTitleService: PageTitleService,
  ) {}

  ngOnInit(): void {
    this.pageTitleService.set('Vendors');
    this.load();
  }

  load(): void {
    this.loading = true;
    this.loadError = '';
    forkJoin({
      vendors: this.api.get<AdminVendor[]>('/vendors'),
      unregistered: this.api.get<UnregisteredUser[]>('/vendors/unregistered-users'),
    }).subscribe({
      next: ({ vendors, unregistered }) => {
        this.vendors = vendors ?? [];
        this.unregistered = unregistered ?? [];
        this.loading = false;
      },
      error: (err: unknown) => {
        this.loadError = extractApiError(err, 'Failed to load vendors').message;
        this.loading = false;
      },
    });
  }

  contactName(v: AdminVendor): string {
    return typeof v.userId === 'object' ? (v.userId.name ?? '—') : '—';
  }

  contactEmail(v: AdminVendor): string {
    return typeof v.userId === 'object' ? (v.userId.email ?? '') : '';
  }

  list(items: string[] | undefined): string {
    return (items ?? []).join(', ') || '—';
  }

  toggleAvailability(v: AdminVendor): void {
    const next = !v.isAvailable;
    this.api.patch<AdminVendor>(`/vendors/${v._id}/availability`, { available: next }).subscribe({
      next: () => {
        v.isAvailable = next;
        this.toast.success(`${v.businessName} is now ${next ? 'available' : 'unavailable'}`);
      },
      error: (err: unknown) => {
        this.toast.error(extractApiError(err, 'Failed to update availability').message);
        this.load();
      },
    });
  }

  toggleVerified(v: AdminVendor): void {
    const next = !v.isVerified;
    this.api.patch<AdminVendor>(`/vendors/${v._id}`, { isVerified: next }).subscribe({
      next: () => {
        v.isVerified = next;
        this.toast.success(
          next ? `${v.businessName} is verified` : `Verification removed for ${v.businessName}`,
        );
      },
      error: (err: unknown) =>
        this.toast.error(extractApiError(err, 'Failed to update verification').message),
    });
  }

  openCreate(user: UnregisteredUser): void {
    this.editingId = null;
    this.formAccountLabel = `${user.name} (${user.email})`;
    this.form = { ...this.blankForm(), userId: user._id, isVerified: true };
    this.formError = '';
    this.showForm = true;
  }

  openEdit(v: AdminVendor): void {
    this.editingId = v._id;
    this.formAccountLabel = `${this.contactName(v)} (${this.contactEmail(v)})`;
    this.form = {
      userId: typeof v.userId === 'object' ? v.userId._id : v.userId,
      businessName: v.businessName,
      serviceTypes: [...(v.serviceTypes ?? [])],
      cities: [...(v.cities ?? [])],
      languages: [...(v.languages ?? [])],
      maxConcurrentJobs: v.maxConcurrentJobs ?? 5,
      isVerified: v.isVerified,
      accountName: v.bankDetails?.accountName ?? '',
      accountNumber: v.bankDetails?.accountNumber ?? '',
      ifsc: v.bankDetails?.ifsc ?? '',
    };
    this.formError = '';
    this.showForm = true;
  }

  closeForm(): void {
    this.showForm = false;
    this.editingId = null;
  }

  toggleService(service: string): void {
    const idx = this.form.serviceTypes.indexOf(service);
    if (idx >= 0) this.form.serviceTypes.splice(idx, 1);
    else this.form.serviceTypes.push(service);
  }

  save(): void {
    if (this.saving) return;
    const f = this.form;
    const name = f.businessName.trim();
    const bank = [f.accountName.trim(), f.accountNumber.trim(), f.ifsc.trim()];
    const bankFilled = bank.filter(Boolean).length;
    const maxJobs = Number(f.maxConcurrentJobs);

    if (!name) return this.fail('Enter the business name.');
    if (f.serviceTypes.length === 0) return this.fail('Choose at least one service.');
    if (f.cities.length === 0) return this.fail('Choose at least one city.');
    if (!Number.isFinite(maxJobs) || maxJobs < 1) {
      return this.fail('Max concurrent jobs must be at least 1.');
    }
    if (bankFilled !== 0 && bankFilled !== 3) {
      return this.fail('Fill all three bank fields or leave all empty.');
    }

    const body: Record<string, unknown> = {
      businessName: name,
      serviceTypes: f.serviceTypes,
      cities: f.cities,
      languages: f.languages,
      maxConcurrentJobs: maxJobs,
    };
    if (bankFilled === 3) {
      body['bankDetails'] = { accountName: bank[0], accountNumber: bank[1], ifsc: bank[2] };
    }

    this.saving = true;
    this.formError = '';

    if (this.editingId) {
      body['isVerified'] = f.isVerified;
      this.api.patch<AdminVendor>(`/vendors/${this.editingId}`, body).subscribe({
        next: () => this.saved('Business profile saved'),
        error: (err: unknown) => this.failed(err, 'Failed to save the profile'),
      });
      return;
    }

    this.api.post<AdminVendor>('/vendors/register', { userId: f.userId, ...body }).subscribe({
      next: (created) => {
        if (!f.isVerified) return this.saved('Business profile created');
        this.api.patch<AdminVendor>(`/vendors/${created._id}/verify`, {}).subscribe({
          next: () => this.saved('Business profile created and verified'),
          error: () => {
            this.saved('Profile created, but verification failed. Verify it from the list.');
          },
        });
      },
      error: (err: unknown) => this.failed(err, 'Failed to create the profile'),
    });
  }

  private saved(message: string): void {
    this.saving = false;
    this.showForm = false;
    this.editingId = null;
    this.toast.success(message);
    this.load();
  }

  private failed(err: unknown, fallback: string): void {
    this.saving = false;
    this.formError = extractApiError(err, fallback).message;
  }

  private fail(message: string): void {
    this.formError = message;
  }

  private blankForm(): VendorForm {
    return {
      userId: '',
      businessName: '',
      serviceTypes: [],
      cities: [],
      languages: ['English', 'Hindi'],
      maxConcurrentJobs: 5,
      isVerified: true,
      accountName: '',
      accountNumber: '',
      ifsc: '',
    };
  }
}
