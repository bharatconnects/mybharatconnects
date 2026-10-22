import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CheckpointsService, PaymentPolicy } from '../../../core/services/checkpoints.service';
import { ToastService } from '../../../core/services/toast.service';
import { extractApiError } from '../../../core/services/api-error';
import { PageTitleService } from '../../../core/services/page-title.service';

@Component({
  selector: 'app-admin-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="max-w-3xl">
      <p class="text-sm text-base-content/60 mb-5">
        These rules apply to every case. Changing them takes effect immediately and does not touch cases that were
        already accepted under an earlier advance. Each change is recorded.
      </p>

      @if (loading) {
        <div class="bb-skeleton bb-skeleton-text" style="width: 60%"></div>
      } @else if (loadError) {
        <div role="alert" class="px-4 py-2.5 rounded-lg bg-error/10 text-error border border-error/20 text-sm">
          {{ loadError }}
        </div>
      } @else {
        <section class="bb-card mb-5" aria-labelledby="policy-title">
          <div class="bb-card-body">
            <h3 id="policy-title" class="bb-section-title">Payment rules</h3>

            <div class="mb-5">
              <label class="bb-label" for="advance-percent">Advance before a case opens (%)</label>
              <input
                id="advance-percent"
                type="number"
                min="0"
                max="100"
                step="1"
                class="bb-input w-32"
                [(ngModel)]="form.advancePercent"
                [attr.aria-invalid]="advanceInvalid ? 'true' : null"
              />
              <p class="text-xs text-base-content/60 mt-1">
                Share of the accepted quote the client must pay before the case can reach Case Open. 0 means no
                advance is needed. The client is asked to pay it as soon as they accept the quote.
              </p>
              @if (advanceInvalid) {
                <p class="text-xs text-error mt-1" role="alert">Enter a whole number from 0 to 100.</p>
              }
            </div>

            <div class="mb-4">
              <label class="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" class="checkbox checkbox-sm mt-0.5" [(ngModel)]="form.finalPaymentGateEnabled" />
                <span>
                  <span class="font-medium text-sm">Require full payment before a case can be closed</span>
                  <span class="block text-xs text-base-content/60"
                    >The whole accepted quote must be received, through Stripe or an approved off-platform payment.</span
                  >
                </span>
              </label>
            </div>

            <div class="mb-5">
              <label class="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" class="checkbox checkbox-sm mt-0.5" [(ngModel)]="form.deliveryGateEnabled" />
                <span>
                  <span class="font-medium text-sm">Require all milestones to be delivered before a case can be closed</span>
                  <span class="block text-xs text-base-content/60"
                    >A milestone counts as delivered once the vendor has marked it complete.</span
                  >
                </span>
              </label>
            </div>

            <div class="mb-5">
              <label class="bb-label" for="close-window">Time the client has to raise an issue after closure is requested (hours)</label>
              <input
                id="close-window"
                type="number"
                min="1"
                max="720"
                step="1"
                class="bb-input w-32"
                [(ngModel)]="form.closeWindowHours"
                [attr.aria-invalid]="windowInvalid ? 'true' : null"
              />
              @if (windowInvalid) {
                <p class="text-xs text-error mt-1" role="alert">Enter a whole number from 1 to 720.</p>
              }
            </div>

            <div class="mb-5">
              <label class="bb-label" for="policy-note">Reason for this change (optional)</label>
              <input id="policy-note" type="text" maxlength="500" class="bb-input" [(ngModel)]="note" />
            </div>

            <div class="flex items-center gap-3">
              <button
                type="button"
                class="bb-btn bb-btn-primary"
                (click)="save()"
                [disabled]="saving || !dirty || advanceInvalid || windowInvalid"
              >
                {{ saving ? 'Saving…' : 'Save changes' }}
              </button>
              @if (dirty) {
                <button type="button" class="bb-btn bb-btn-ghost" (click)="reset()" [disabled]="saving">Discard</button>
              }
              @if (saved?.updatedAt; as at) {
                <span class="text-xs text-base-content/50">Last saved {{ at | date: 'medium' }}</span>
              }
            </div>
          </div>
        </section>
      }
    </div>
  `,
})
export class AdminSettingsComponent implements OnInit {
  loading = true;
  loadError = '';
  saving = false;
  saved: PaymentPolicy | null = null;
  note = '';
  form = { advancePercent: 0, finalPaymentGateEnabled: true, deliveryGateEnabled: true, closeWindowHours: 72 };

  constructor(
    private checkpoints: CheckpointsService,
    private toast: ToastService,
    private pageTitle: PageTitleService,
  ) {}

  ngOnInit(): void {
    this.pageTitle.set('Settings');
    this.checkpoints.getPaymentPolicy().subscribe({
      next: (policy) => {
        this.apply(policy);
        this.loading = false;
      },
      error: (err: unknown) => {
        this.loadError = extractApiError(err, 'Could not load the payment rules').message;
        this.loading = false;
      },
    });
  }

  private apply(policy: PaymentPolicy): void {
    this.saved = policy;
    this.form = {
      advancePercent: policy.advancePercent,
      finalPaymentGateEnabled: policy.finalPaymentGateEnabled,
      deliveryGateEnabled: policy.deliveryGateEnabled,
      closeWindowHours: policy.closeWindowHours,
    };
  }

  get advanceInvalid(): boolean {
    const v = this.form.advancePercent;
    return !Number.isInteger(v) || v < 0 || v > 100;
  }

  get windowInvalid(): boolean {
    const v = this.form.closeWindowHours;
    return !Number.isInteger(v) || v < 1 || v > 720;
  }

  get dirty(): boolean {
    const s = this.saved;
    if (!s) return false;
    return (
      s.advancePercent !== this.form.advancePercent ||
      s.finalPaymentGateEnabled !== this.form.finalPaymentGateEnabled ||
      s.deliveryGateEnabled !== this.form.deliveryGateEnabled ||
      s.closeWindowHours !== this.form.closeWindowHours
    );
  }

  reset(): void {
    if (this.saved) this.apply(this.saved);
    this.note = '';
  }

  save(): void {
    if (this.saving || !this.dirty || this.advanceInvalid || this.windowInvalid) return;
    this.saving = true;
    this.checkpoints.updatePaymentPolicy({ ...this.form, note: this.note.trim() || undefined }).subscribe({
      next: (policy) => {
        this.apply(policy);
        this.note = '';
        this.saving = false;
        this.toast.success('Payment rules saved');
      },
      error: (err: unknown) => {
        this.saving = false;
        this.toast.error(extractApiError(err, 'Could not save the payment rules').message);
      },
    });
  }
}
