import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import type { Stripe, StripeElements } from '@stripe/stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { ApiService } from '../../../../core/services/api.service';
import { extractApiError } from '../../../../core/services/api-error';
import { PageTitleService } from '../../../../core/services/page-title.service';
import { environment } from '../../../../../environments/environment';

interface PaymentDetail {
  _id: string;
  caseId?: { caseNumber?: string; title?: string } | string;
  amount: number;
  currency: string;
  status: string;
  description?: string;
  purpose?: string;
}

@Component({
  selector: 'app-pay-payment',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="max-w-lg mx-auto">
      @if (loading) {
        <div class="flex justify-center py-16">
          <span class="loading loading-spinner loading-md text-primary"></span>
        </div>
      } @else if (loadError) {
        <div class="bb-card">
          <div class="bb-card-body bb-empty">
            <div class="bb-empty-icon"><i class="material-icons-outlined">error_outline</i></div>
            <p class="bb-empty-title">{{ loadError }}</p>
            <a routerLink="/client/payments" class="bb-btn bb-btn-outline bb-btn-sm mt-2">Back to Payments</a>
          </div>
        </div>
      } @else if (payment) {
        <div class="bb-card mb-6">
          <div class="bb-card-body">
            <h2 class="bb-section-title mb-3">Payment Request</h2>
            <div class="flex items-baseline justify-between mb-1">
              <span class="text-sm text-base-content/60">Amount</span>
              <span class="text-2xl font-bold">\${{ payment.amount / 100 | number: '1.2-2' }}</span>
            </div>
            @if (caseNumber) {
              <div class="flex items-center justify-between mb-1 text-sm">
                <span class="text-base-content/60">Case</span>
                <span class="font-mono">{{ caseNumber }}</span>
              </div>
            }
            @if (payment.description) {
              <div class="flex items-start justify-between mt-2 pt-2 border-t border-base-300 text-sm gap-3">
                <span class="text-base-content/60 shrink-0">Description</span>
                <span class="text-right">{{ payment.description }}</span>
              </div>
            }
          </div>
        </div>

        @if (payment.status !== 'PENDING') {
          <div class="bb-card">
            <div class="bb-card-body bb-empty">
              <div class="bb-empty-icon"><i class="material-icons-outlined">check_circle</i></div>
              <p class="bb-empty-title">
                {{ payment.status === 'AUTHORIZED' || payment.status === 'CAPTURED'
                  ? 'This payment has already been made.'
                  : 'This payment request is no longer payable (' + (payment.status | titlecase) + ').' }}
              </p>
              <a routerLink="/client/payments" class="bb-btn bb-btn-outline bb-btn-sm mt-2">Back to Payments</a>
            </div>
          </div>
        } @else if (paid) {
          <div class="bb-card">
            <div class="bb-card-body bb-empty">
              <div class="bb-empty-icon"><i class="material-icons-outlined">check_circle</i></div>
              <p class="bb-empty-title">Payment received. Thank you!</p>
              <p class="text-sm text-base-content/60 -mt-1">
                Your case manager will confirm and share a receipt shortly.
              </p>
              <a routerLink="/client/payments" class="bb-btn bb-btn-primary bb-btn-sm mt-2">Back to Payments</a>
            </div>
          </div>
        } @else {
          <div class="bb-card">
            <div class="bb-card-body">
              @if (payError) {
                <div
                  class="flex items-center gap-2 px-4 py-2.5 rounded-lg mb-4 text-sm bg-error/10 text-error border border-error/20"
                >
                  <i class="material-icons-outlined text-base">error_outline</i>
                  <span class="flex-1">{{ payError }}</span>
                </div>
              }
              @if (stripeLoading) {
                <div class="flex justify-center py-10">
                  <span class="loading loading-spinner loading-md text-primary"></span>
                </div>
              }
              <div #paymentElementHost [class.hidden]="stripeLoading"></div>
              <button
                type="button"
                class="bb-btn bb-btn-primary w-full mt-4"
                [class.hidden]="stripeLoading"
                (click)="submitPayment()"
                [disabled]="submitting"
              >
                {{ submitting ? 'Processing…' : 'Pay $' + (payment.amount / 100 | number: '1.2-2') }}
              </button>
            </div>
          </div>
        }
      }
    </div>
  `,
})
export class PayPaymentComponent implements OnInit, OnDestroy {
  @ViewChild('paymentElementHost') paymentElementHost?: ElementRef<HTMLDivElement>;

  payment: PaymentDetail | null = null;
  loading = true;
  loadError = '';
  stripeLoading = true;
  submitting = false;
  paid = false;
  payError = '';

  private stripe: Stripe | null = null;
  private elements: StripeElements | null = null;

  constructor(
    private route: ActivatedRoute,
    private api: ApiService,
    private pageTitleService: PageTitleService,
  ) {}

  get caseNumber(): string | null {
    const c = this.payment?.caseId;
    if (!c || typeof c === 'string') return null;
    return c.caseNumber ?? null;
  }

  ngOnInit(): void {
    this.pageTitleService.set('Pay');
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.api.get<PaymentDetail>(`/payments/${id}`).subscribe({
      next: (p) => {
        this.payment = p;
        this.loading = false;
        if (p.status === 'PENDING') {
          this.setupStripe(id);
        }
      },
      error: (err) => {
        this.loading = false;
        this.loadError = extractApiError(err, 'Could not load this payment request.').message;
      },
    });
  }

  private setupStripe(id: string): void {
    this.api.post<{ clientSecret: string }>(`/payments/${id}/create-intent`, {}).subscribe({
      next: async ({ clientSecret }) => {
        this.stripe = await loadStripe(environment.stripePublishableKey);
        if (!this.stripe) {
          this.payError = 'Could not load the payment form. Please try again.';
          this.stripeLoading = false;
          return;
        }
        this.elements = this.stripe.elements({ clientSecret });
        const paymentElement = this.elements.create('payment');
        // Deferred one tick so *ngIf-style hidden host div has rendered.
        setTimeout(() => {
          if (this.paymentElementHost) {
            paymentElement.mount(this.paymentElementHost.nativeElement);
          }
        });
        this.stripeLoading = false;
      },
      error: (err) => {
        this.stripeLoading = false;
        this.payError = extractApiError(err, 'Could not start the payment.').message;
      },
    });
  }

  async submitPayment(): Promise<void> {
    if (!this.stripe || !this.elements || this.submitting) return;
    this.submitting = true;
    this.payError = '';

    const { error, paymentIntent } = await this.stripe.confirmPayment({
      elements: this.elements,
      redirect: 'if_required',
    });

    this.submitting = false;

    if (error) {
      this.payError = error.message ?? 'Payment failed. Please check your card details and try again.';
      return;
    }

    // capture_method: manual — a successful confirm lands in
    // 'requires_capture', not 'succeeded'. Either means the hold went
    // through. Sync our own record right away rather than waiting on the
    // webhook, so the Payments tab reflects this the moment they look at it.
    if (paymentIntent?.status === 'requires_capture' || paymentIntent?.status === 'succeeded') {
      this.paid = true;
      const id = this.route.snapshot.paramMap.get('id') ?? '';
      this.api.post(`/payments/${id}/confirm`, {}).subscribe({ error: () => undefined });
    } else {
      this.payError = 'Payment could not be completed. Please try again.';
    }
  }

  ngOnDestroy(): void {
    this.elements = null;
    this.stripe = null;
  }
}
