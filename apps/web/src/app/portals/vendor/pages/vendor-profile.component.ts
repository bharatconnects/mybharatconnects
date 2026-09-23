import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { extractApiError } from '../../../core/services/api-error';
import { PageTitleService } from '../../../core/services/page-title.service';
import { TagMultiselectComponent } from '../../../shared/components/tag-multiselect/tag-multiselect.component';
import { CITY_OPTIONS } from '../../../shared/data/cities';
import { LANGUAGE_OPTIONS } from '../../../shared/data/languages';
import { VERTICAL_NAMES } from '../../../shared/data/service-catalog';

interface VendorProfile {
  _id: string;
  businessName: string;
  serviceTypes: string[];
  cities: string[];
  rating: number;
  isAvailable: boolean;
  languages?: string[];
  totalJobs?: number;
  completedJobs?: number;
  currentJobs?: number;
  maxConcurrentJobs?: number;
  isVerified?: boolean;
}

// Vendors declare which service verticals they cover; case routing matches a
// case's vertical against this list. (Names come from the shared catalog.)
const SERVICE_TYPE_OPTIONS = VERTICAL_NAMES;

@Component({
  selector: 'app-vendor-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, TagMultiselectComponent],
  template: `
    <p class="text-sm text-base-content/60 mb-5">Your business details, services, and availability for case routing.</p>

    @if (loading) {
      <div class="flex justify-center py-12">
        <span class="loading loading-spinner loading-lg text-primary" aria-label="Loading profile"></span>
      </div>
    } @else if (notRegistered) {
      <div class="bb-card w-full">
        <div class="bb-card-body">
          <div class="bb-empty">
            <div class="bb-empty-icon"><i class="material-icons-outlined" aria-hidden="true">storefront</i></div>
            <p class="bb-empty-title">Your vendor profile isn't set up yet</p>
            <p class="max-w-md">
              We have your account but no vendor business profile. An administrator needs to register your business details, services, and cities before you can receive jobs.
            </p>
          </div>
          <div class="text-xs text-base-content/60 border-t border-base-200 pt-4 mt-2 max-w-2xl mx-auto">
            <p><strong class="text-base-content/80">What admins need from you:</strong> Business name, GST/PAN, service categories you offer, cities you serve, languages you speak.</p>
            <p class="mt-2">Once registered, this page will show your full profile and let you edit it.</p>
          </div>
        </div>
      </div>
    } @else if (errorMessage) {
      <div class="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-error/10 text-error border border-error/20 text-sm">
        <i class="material-icons-outlined text-base" aria-hidden="true">error_outline</i>
        <span class="flex-1">Could not load profile — {{ errorMessage }}</span>
        <button class="bb-btn bb-btn-ghost bb-btn-sm" (click)="reload()">Retry</button>
      </div>
    } @else if (profile && draft) {
      <div class="bb-card">
        <div class="bb-card-body">
          <!-- Identity -->
          <div class="flex items-center gap-4">
            <div class="w-14 h-14 rounded-full flex items-center justify-center bg-primary text-primary-content shrink-0">
              <i class="material-icons-outlined text-3xl">storefront</i>
            </div>
            <div class="min-w-0">
              <div class="font-semibold text-lg truncate m-0">{{ profile.businessName }}</div>
              <div class="flex items-center gap-1.5 text-sm text-base-content/70 mt-1">
                <i class="material-icons-outlined text-base leading-none text-primary">star</i>
                <span>{{ profile.rating | number:'1.1-1' }} / 5.0</span>
                @if (profile.isVerified) {
                  <span class="bb-chip bb-chip-success ml-2">Verified</span>
                }
              </div>
            </div>
          </div>

          <div class="divider my-3"></div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <h3 class="bb-label">Availability</h3>
              <label class="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  class="toggle toggle-primary"
                  [(ngModel)]="profile.isAvailable"
                  (ngModelChange)="toggleAvailability()"
                  aria-label="Toggle availability for jobs" />
                <span class="text-sm">{{ profile.isAvailable ? 'Available for jobs' : 'Not accepting jobs' }}</span>
              </label>
              <p class="text-xs text-base-content/60 mt-2">
                When you're available, your business appears in case-manager routing for matching cities and service types.
              </p>
            </div>

            <div>
              <h3 class="bb-label">Capacity</h3>
              <div class="grid grid-cols-2 gap-3">
                <div class="bg-base-200 rounded p-3">
                  <div class="bb-stat-value">{{ profile.currentJobs ?? 0 }}</div>
                  <div class="bb-stat-label">Active jobs</div>
                </div>
                <div class="bg-base-200 rounded p-3">
                  <div class="bb-stat-value">{{ profile.maxConcurrentJobs ?? '—' }}</div>
                  <div class="bb-stat-label">Max capacity</div>
                </div>
                <div class="bg-base-200 rounded p-3">
                  <div class="bb-stat-value">{{ profile.completedJobs ?? 0 }}</div>
                  <div class="bb-stat-label">Completed</div>
                </div>
                <div class="bg-base-200 rounded p-3">
                  <div class="bb-stat-value">{{ profile.totalJobs ?? 0 }}</div>
                  <div class="bb-stat-label">Total jobs</div>
                </div>
              </div>
            </div>
          </div>

          <div class="divider my-3"></div>

          <h3 class="bb-section-title">Edit business profile</h3>
          <p class="bb-section-subtitle">Changes apply immediately to vendor routing. Rating, verification status, and bank details are admin-only.</p>

          <div class="flex flex-col gap-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="bb-label" for="v-business-name">Business name</label>
                <input id="v-business-name"
                       class="bb-input"
                       [(ngModel)]="draft.businessName"
                       (ngModelChange)="markDirty()"
                       placeholder="e.g. Sharma Legal Associates" />
              </div>

              <div>
                <label class="bb-label" for="v-max-jobs">Max concurrent jobs</label>
                <input id="v-max-jobs"
                       class="bb-input"
                       type="number"
                       min="1"
                       max="20"
                       [(ngModel)]="draft.maxConcurrentJobs"
                       (ngModelChange)="markDirty()" />
                <span class="bb-hint">Cap how many active cases you can handle in parallel.</span>
              </div>
            </div>

            <div>
              <label class="bb-label">Services offered</label>
              <div class="flex flex-wrap gap-2 mt-1">
                @for (s of serviceOptions; track s) {
                  <button type="button"
                          class="bb-chip"
                          [ngClass]="draft.serviceTypes.includes(s) ? 'bb-chip-warning' : 'bb-chip-neutral'"
                          (click)="toggleService(s)">
                    <i class="material-icons-outlined text-sm leading-none">
                      {{ draft.serviceTypes.includes(s) ? 'check' : 'add' }}
                    </i>
                    {{ formatService(s) }}
                  </button>
                }
              </div>
            </div>

            <div>
              <label class="bb-label" for="v-cities">Cities served</label>
              <app-tag-multiselect
                id="v-cities"
                [options]="cityOptions"
                [ngModel]="draft.cities"
                (ngModelChange)="setCities($event)"
                placeholder="Search or add a city…"
              />
              <span class="bb-hint">Used by case routing to match clients to local vendors.</span>
            </div>

            <div>
              <label class="bb-label" for="v-languages">Languages spoken</label>
              <app-tag-multiselect
                id="v-languages"
                [options]="languageOptions"
                [ngModel]="draft.languages ?? []"
                (ngModelChange)="setLanguages($event)"
                placeholder="Search or add a language…"
              />
              <span class="bb-hint">Helps us route NRI clients comfortable in these languages.</span>
            </div>

            <div class="flex justify-end gap-2 pt-2 border-t border-base-300">
              <button type="button"
                      class="bb-btn bb-btn-ghost"
                      [disabled]="!dirty || saving"
                      (click)="resetDraft()">
                <i class="material-icons-outlined text-base">restart_alt</i>
                Discard
              </button>
              <button type="button"
                      class="bb-btn bb-btn-primary"
                      [disabled]="!dirty || saving"
                      (click)="save()">
                <i class="material-icons-outlined text-base">{{ saving ? 'hourglass_empty' : 'save' }}</i>
                {{ saving ? 'Saving…' : 'Save changes' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    }
  `,
})
export class VendorProfileComponent implements OnInit {
  profile: VendorProfile | null = null;
  draft: VendorProfile | null = null;
  loading = true;
  errorMessage = '';
  notRegistered = false;
  saving = false;
  dirty = false;
  serviceOptions = SERVICE_TYPE_OPTIONS;
  cityOptions = CITY_OPTIONS;
  languageOptions = LANGUAGE_OPTIONS;

  constructor(
    private api: ApiService,
    private toast: ToastService,
    private pageTitleService: PageTitleService,
  ) {}

  ngOnInit(): void {
    this.pageTitleService.set('My Profile');
    this.reload();
  }

  reload(): void {
    this.loading = true;
    this.errorMessage = '';
    this.notRegistered = false;
    this.api.get<VendorProfile>('/vendors/my').subscribe({
      next: (data) => {
        this.profile = data;
        this.draft = this.cloneDraft(data);
        this.dirty = false;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        if (err?.status === 404) {
          this.notRegistered = true;
        } else {
          this.errorMessage = extractApiError(err, 'Failed to load profile.').message;
        }
      },
    });
  }

  toggleAvailability(): void {
    if (!this.profile) return;
    this.api
      .patch<VendorProfile>(`/vendors/${this.profile._id}/availability`, {
        available: this.profile.isAvailable,
      })
      .subscribe({
        next: () => {
          this.toast.success(
            this.profile!.isAvailable
              ? 'You are now available for jobs'
              : 'You are now unavailable',
          );
        },
        error: (err) => {
          if (this.profile) this.profile.isAvailable = !this.profile.isAvailable;
          this.toast.error(extractApiError(err, 'Failed to update availability').message);
        },
      });
  }

  toggleService(service: string): void {
    if (!this.draft) return;
    const idx = this.draft.serviceTypes.indexOf(service);
    if (idx >= 0) this.draft.serviceTypes.splice(idx, 1);
    else this.draft.serviceTypes.push(service);
    this.markDirty();
  }

  setCities(cities: string[]): void {
    if (!this.draft) return;
    this.draft.cities = cities;
    this.markDirty();
  }

  setLanguages(languages: string[]): void {
    if (!this.draft) return;
    this.draft.languages = languages;
    this.markDirty();
  }

  markDirty(): void {
    this.dirty = true;
  }

  resetDraft(): void {
    if (!this.profile) return;
    this.draft = this.cloneDraft(this.profile);
    this.dirty = false;
  }

  save(): void {
    if (!this.draft || !this.dirty || this.saving) return;
    this.saving = true;
    const payload = {
      businessName: this.draft.businessName,
      serviceTypes: this.draft.serviceTypes,
      cities: this.draft.cities,
      languages: this.draft.languages,
      maxConcurrentJobs: this.draft.maxConcurrentJobs,
    };
    this.api.patch<VendorProfile>('/vendors/my', payload).subscribe({
      next: (updated) => {
        this.profile = updated;
        this.draft = this.cloneDraft(updated);
        this.dirty = false;
        this.saving = false;
        this.toast.success('Business profile saved');
      },
      error: (err) => {
        this.saving = false;
        this.toast.error(extractApiError(err, 'Failed to save').message);
      },
    });
  }

  formatService(s: string): string {
    return s.replace(/_/g, ' ');
  }

  private cloneDraft(src: VendorProfile): VendorProfile {
    return {
      ...src,
      serviceTypes: [...src.serviceTypes],
      cities: [...src.cities],
      languages: src.languages ? [...src.languages] : [],
    };
  }
}
