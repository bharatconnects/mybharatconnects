import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ClientCasesService, ServiceRequest } from '../../services/client-cases.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';
import { extractApiError } from '../../../../core/services/api-error';
import { PageTitleService } from '../../../../core/services/page-title.service';
import { PhoneInputComponent } from '../../../../shared/components/phone-input/phone-input.component';
import { BbSelectComponent } from '../../../../shared/components/bb-select/bb-select.component';
import { SERVICE_VERTICALS } from '../../../../shared/data/service-catalog';
import {
  OTHER_SERVICE_VALUE,
  COUNTRY_OPTIONS,
  INTENT_OPTIONS,
  timezonesForCountry,
  SelectOption,
} from '../../../../shared/data/lead-form-options';

// Grouped by vertical for the select; the service display name IS the stored value.
const SERVICE_GROUPS = SERVICE_VERTICALS.map((v) => ({
  label: v.name,
  options: v.services.map((s) => s.name),
}));

const STATUS_CHIP: Record<string, string> = {
  COLD: 'bb-chip-info',
  WARM: 'bb-chip-warning',
  HOT: 'bb-chip-danger',
  CANCELLED: 'bb-chip-neutral',
};

const STATUS_LABEL: Record<string, string> = {
  COLD: 'Submitted',
  WARM: 'In Review',
  HOT: 'In Review',
  CANCELLED: 'Cancelled',
};

@Component({
  selector: 'app-client-request-service',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, PhoneInputComponent, BbSelectComponent],
  template: `
    <div class="w-full">
      <a routerLink="/client/cases" class="bb-btn bb-btn-ghost bb-btn-sm gap-1 mb-4">
        <i class="material-icons-outlined">arrow_back</i>
        Back to My Cases
      </a>

      <p class="text-sm text-base-content/60 mb-5">
        Tell us what you need. A dedicated case manager will reach out within 24 hours to scope
        your case.
      </p>

      @if (editingId) {
        <div
          class="flex items-center gap-2 px-4 py-2.5 rounded-lg mb-4 text-sm bg-info/10 text-info border border-info/20"
        >
          <i class="material-icons-outlined text-base">edit</i>
          <span class="flex-1">Editing your request.</span>
          <button type="button" class="bb-btn bb-btn-ghost bb-btn-sm" (click)="cancelEdit()">
            Cancel edit
          </button>
        </div>
      }

      @if (success) {
        <div
          class="flex items-center gap-2 px-4 py-2.5 rounded-lg mb-4 text-sm bg-success/10 text-success border border-success/20"
        >
          <i class="material-icons-outlined text-base">check_circle</i>
          <span class="flex-1"
            >Request received — a case manager will email you within 24 hours to schedule a free
            30-minute discovery call.</span
          >
          <button type="button" class="bb-btn bb-btn-ghost bb-btn-sm" (click)="startAnother()">
            Submit another request
          </button>
        </div>
      } @else {
        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="bb-card">
          <div class="bb-card-body flex flex-col gap-6">
            @if (errorMessage) {
              <div
                class="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm bg-error/10 text-error border border-error/20"
              >
                <i class="material-icons-outlined text-base">error_outline</i>
                <span>{{ errorMessage }}</span>
              </div>
            }

            <!-- Contact info -->
            <section>
              <h2 class="bb-section-title mb-1">Your contact info</h2>
              <p class="bb-section-subtitle mb-4">
                So we can reach you to set up the discovery call.
              </p>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label class="bb-label" for="req-name">Full Name</label>
                  <input
                    id="req-name"
                    class="bb-input"
                    formControlName="name"
                    placeholder="Your name"
                    autocomplete="name"
                  />
                  @if (f['name'].invalid && f['name'].touched) {
                    <p class="bb-error-text">Required</p>
                  }
                </div>

                <div>
                  <label class="bb-label" for="req-email">Email</label>
                  <input
                    id="req-email"
                    class="bb-input"
                    type="email"
                    formControlName="email"
                    placeholder="you@example.com"
                    autocomplete="email"
                  />
                  @if (f['email'].invalid && f['email'].touched) {
                    <p class="bb-error-text">Enter a valid email</p>
                  }
                </div>

                <div class="sm:col-span-2">
                  <label class="bb-label" for="req-phone"
                    >Phone / WhatsApp
                    <span class="normal-case text-base-content/50">(optional)</span></label
                  >
                  <app-phone-input
                    inputId="req-phone"
                    formControlName="phone"
                    defaultCountryIso2="US"
                    placeholder="555 123 4567"
                  />
                </div>
              </div>
            </section>

            <hr class="border-base-300" />

            <!-- Service ask -->
            <section>
              <h2 class="bb-section-title mb-1">What do you need?</h2>
              <p class="bb-section-subtitle mb-4">
                Pick a service and add any details that help us prepare.
              </p>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="sm:col-span-2">
                  <label class="bb-label" for="req-service">Service</label>
                  <app-bb-select
                    id="req-service"
                    formControlName="service"
                    [options]="serviceSelectOptions()"
                    placeholder="Select a service…"
                  ></app-bb-select>
                  @if (f['service'].invalid && f['service'].touched) {
                    <p class="bb-error-text">Please pick a service</p>
                  }
                </div>

                <div>
                  <label class="bb-label" for="req-country">Country</label>
                  <app-bb-select
                    id="req-country"
                    formControlName="country"
                    [options]="countryOptions"
                    placeholder="Where are you based?"
                  ></app-bb-select>
                </div>

                <div>
                  <label class="bb-label" for="req-tz">Best time to call</label>
                  <app-bb-select
                    id="req-tz"
                    formControlName="timezone"
                    [options]="availableTimezoneOptions()"
                    placeholder="Pick a timezone"
                  ></app-bb-select>
                  <p class="bb-hint">For scheduling your discovery call</p>
                </div>

                <div class="sm:col-span-2">
                  <label class="bb-label" for="req-intent">
                    Urgency <span class="normal-case text-base-content/50">(optional)</span>
                  </label>
                  <app-bb-select
                    id="req-intent"
                    formControlName="intentTag"
                    [options]="intentOptions"
                    placeholder="Not sure yet"
                  ></app-bb-select>
                </div>

                @if (isOther) {
                  <div class="sm:col-span-2">
                    <label class="bb-label" for="req-notes">Tell us what you need</label>
                    <textarea
                      id="req-notes"
                      class="bb-textarea"
                      formControlName="notes"
                      placeholder="Describe what you need help with…"
                    ></textarea>
                    @if (f['notes'].invalid && f['notes'].touched) {
                      <p class="bb-error-text">Please describe what you need</p>
                    }
                  </div>
                }
              </div>
            </section>

            <div
              class="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-base-300"
            >
              <a routerLink="/client/cases" class="bb-btn bb-btn-ghost">Cancel</a>
              <button class="bb-btn bb-btn-primary bb-btn-lg" type="submit" [disabled]="loading">
                @if (loading) {
                  <span class="loading loading-spinner loading-sm"></span>
                } @else if (editingId) {
                  <span>Save Changes</span>
                  <i class="material-icons-outlined">check</i>
                } @else {
                  <span>Send Request</span>
                  <i class="material-icons-outlined">arrow_forward</i>
                }
              </button>
            </div>
          </div>
        </form>
      }

      <div class="bb-card mt-8">
        <div class="bb-card-body">
          <div class="flex items-center justify-between gap-3 mb-4">
            <h2 class="bb-section-title">Your Requests</h2>
            @if (!requestsLoading) {
              <span class="bb-page-count">{{ myRequests.length }}</span>
            }
          </div>

          @if (requestsLoading) {
            <div class="flex justify-center py-10">
              <span class="loading loading-spinner loading-md text-primary"></span>
            </div>
          } @else if (myRequests.length === 0) {
            <div class="bb-empty">
              <div class="bb-empty-icon"><i class="material-icons-outlined">inbox</i></div>
              <p class="bb-empty-title">No requests yet</p>
              <p>Submit the form above and it will show up here.</p>
            </div>
          } @else {
            <div class="bb-table-wrap">
              <div class="bb-table-scroll">
              <table class="bb-table">
                <thead>
                  <tr>
                    <th>Service</th>
                    <th>Status</th>
                    <th>Submitted</th>
                    <th>Case</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  @for (r of myRequests; track r._id) {
                    <tr>
                      <td>
                        <div>{{ r.serviceType || '—' }}</div>
                        @if (r.serviceType === otherServiceValue && r.message) {
                          <div class="text-xs text-base-content/50 mt-0.5">{{ r.message }}</div>
                        }
                      </td>
                      <td>
                        <span class="bb-chip" [ngClass]="statusChipClass(r.status)">{{
                          statusLabel(r)
                        }}</span>
                      </td>
                      <td class="whitespace-nowrap">{{ r.createdAt | date: 'mediumDate' }}</td>
                      <td class="whitespace-nowrap">
                        @if (caseNumberOf(r); as cn) {
                          <a
                            [routerLink]="['/client/cases', cn]"
                            class="font-mono text-xs text-[var(--saffron)] hover:underline"
                            >{{ cn }}</a
                          >
                        } @else {
                          <span class="text-base-content/40">—</span>
                        }
                      </td>
                      <td>
                        <div class="flex gap-2 justify-end">
                          @if (canEdit(r)) {
                            <button
                              type="button"
                              class="bb-btn bb-btn-outline bb-btn-sm"
                              [disabled]="actingId === r._id"
                              (click)="startEdit(r)"
                            >
                              Edit
                            </button>
                          }
                          @if (canCancel(r)) {
                            <button
                              type="button"
                              class="bb-btn bb-btn-ghost bb-btn-sm"
                              [disabled]="actingId === r._id"
                              (click)="cancelRequest(r)"
                            >
                              Cancel
                            </button>
                          }
                          @if (canDelete(r)) {
                            <button
                              type="button"
                              class="bb-btn bb-btn-danger bb-btn-sm"
                              [disabled]="actingId === r._id"
                              (click)="deleteRequest(r)"
                            >
                              Delete
                            </button>
                          }
                        </div>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
              </div>
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class ClientRequestServiceComponent implements OnInit {
  form!: FormGroup;
  serviceGroups = SERVICE_GROUPS;
  countryOptions = COUNTRY_OPTIONS;
  intentOptions = INTENT_OPTIONS;
  readonly otherServiceValue = OTHER_SERVICE_VALUE;

  serviceSelectOptions(): { value: string; label: string; group: string }[] {
    const grouped = this.serviceGroups.flatMap((g) =>
      g.options.map((s) => ({ value: s, label: s, group: g.label })),
    );
    return [...grouped, { value: this.otherServiceValue, label: 'Other (please specify)', group: 'Other' }];
  }
  loading = false;
  errorMessage = '';
  success = false;
  editingId: string | null = null;

  myRequests: ServiceRequest[] = [];
  requestsLoading = true;
  actingId: string | null = null;

  constructor(
    private fb: FormBuilder,
    private clientCasesService: ClientCasesService,
    private authService: AuthService,
    private toast: ToastService,
    private confirmDialog: ConfirmDialogService,
    private pageTitleService: PageTitleService,
  ) {
    this.form = this.fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: [''],
      service: ['', Validators.required],
      country: [''],
      timezone: [''],
      intentTag: [''],
      notes: [''],
    });

    this.form.get('service')!.valueChanges.subscribe((service) => {
      const notes = this.form.get('notes')!;
      if (service === this.otherServiceValue) {
        notes.setValidators([Validators.required]);
      } else {
        notes.clearValidators();
      }
      notes.updateValueAndValidity({ emitEvent: false });
    });

    this.form.get('country')!.valueChanges.subscribe(() => {
      // Clear a previously-picked timezone if it no longer fits the new
      // country (e.g. switched from US to India) rather than silently
      // submitting a mismatched selection.
      const timezone = this.form.get('timezone')!;
      const stillValid = this.availableTimezoneOptions().some((t) => t.value === timezone.value);
      if (!stillValid) {
        timezone.setValue('', { emitEvent: false });
      }
    });
  }

  get f() {
    return this.form.controls;
  }

  availableTimezoneOptions(): SelectOption[] {
    return timezonesForCountry(this.form.get('country')?.value);
  }

  get isOther(): boolean {
    return this.form.get('service')!.value === this.otherServiceValue;
  }

  ngOnInit(): void {
    this.pageTitleService.set('Request Service');
    const user = this.authService.currentUser;
    const fullName = user ? (user.name ?? '').trim() : '';
    this.form.patchValue({ name: fullName, email: user?.email ?? '' });
    this.loadRequests();
  }

  loadRequests(): void {
    this.requestsLoading = true;
    this.clientCasesService.getMyRequests().subscribe({
      next: (requests) => {
        this.myRequests = requests ?? [];
        this.requestsLoading = false;
      },
      error: () => {
        this.requestsLoading = false;
      },
    });
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading = true;
    this.errorMessage = '';
    const { service, notes, ...rest } = this.form.value;
    const payload = { ...rest, serviceType: service, message: notes };

    if (this.editingId) {
      this.clientCasesService.updateRequest(this.editingId, payload).subscribe({
        next: () => {
          this.loading = false;
          this.toast.success('Request updated');
          this.cancelEdit();
          this.loadRequests();
        },
        error: (err) => {
          this.loading = false;
          this.errorMessage = extractApiError(
            err,
            'Could not update your request. Please try again.',
          ).message;
        },
      });
      return;
    }

    this.clientCasesService.requestService(payload).subscribe({
      next: () => {
        this.loading = false;
        this.success = true;
        this.loadRequests();
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = extractApiError(
          err,
          'Could not submit your request. Please try again.',
        ).message;
      },
    });
  }

  canEdit(r: ServiceRequest): boolean {
    return r.status !== 'CANCELLED' && !r.caseId;
  }

  startEdit(r: ServiceRequest): void {
    this.editingId = r._id;
    this.success = false;
    this.errorMessage = '';
    this.form.reset({
      name: r.name,
      email: r.email,
      phone: r.phone ?? '',
      service: r.serviceType ?? '',
      country: r.country ?? '',
      timezone: r.timezone ?? '',
      intentTag: r.intentTag ?? '',
      notes: r.message ?? '',
    });
  }

  cancelEdit(): void {
    this.editingId = null;
    const user = this.authService.currentUser;
    const fullName = user ? (user.name ?? '').trim() : '';
    this.form.reset({
      name: fullName,
      email: user?.email ?? '',
      phone: '',
      service: '',
      country: '',
      timezone: '',
      intentTag: '',
      notes: '',
    });
  }

  startAnother(): void {
    const user = this.authService.currentUser;
    const fullName = user ? (user.name ?? '').trim() : '';
    this.form.reset({
      name: fullName,
      email: user?.email ?? '',
      phone: '',
      service: '',
      country: '',
      timezone: '',
      intentTag: '',
      notes: '',
    });
    this.success = false;
  }

  statusChipClass(status: string): string {
    return STATUS_CHIP[status] ?? 'bb-chip-neutral';
  }

  statusLabel(r: ServiceRequest): string {
    if (this.caseNumberOf(r)) return 'Converted to Case';
    return STATUS_LABEL[r.status] ?? r.status;
  }

  caseNumberOf(r: ServiceRequest): string | null {
    const c = r.caseId;
    if (!c || typeof c === 'string') return null;
    return c.caseNumber;
  }

  canCancel(r: ServiceRequest): boolean {
    return r.status !== 'CANCELLED' && !r.caseId;
  }

  canDelete(r: ServiceRequest): boolean {
    return !r.caseId;
  }

  cancelRequest(r: ServiceRequest): void {
    this.actingId = r._id;
    this.clientCasesService.cancelRequest(r._id).subscribe({
      next: (updated) => {
        this.actingId = null;
        const idx = this.myRequests.findIndex((x) => x._id === r._id);
        if (idx >= 0) this.myRequests[idx] = updated;
        this.toast.success('Request cancelled');
      },
      error: (err) => {
        this.actingId = null;
        this.toast.error(extractApiError(err, 'Could not cancel this request').message);
      },
    });
  }

  async deleteRequest(r: ServiceRequest): Promise<void> {
    const ok = await this.confirmDialog.confirm(
      `Delete this request for "${r.serviceType || 'service'}"? This cannot be undone.`,
      { title: 'Delete request', confirmText: 'Delete', danger: true },
    );
    if (!ok) return;
    this.actingId = r._id;
    this.clientCasesService.deleteRequest(r._id).subscribe({
      next: () => {
        this.actingId = null;
        this.myRequests = this.myRequests.filter((x) => x._id !== r._id);
        this.toast.success('Request deleted');
      },
      error: (err) => {
        this.actingId = null;
        this.toast.error(extractApiError(err, 'Could not delete this request').message);
      },
    });
  }
}
