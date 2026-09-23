import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ApiService } from '../../../../core/services/api.service';
import { PaymentsService, Payment } from '../../../../core/services/payments.service';
import { extractApiError } from '../../../../core/services/api-error';
import { PageTitleService } from '../../../../core/services/page-title.service';
import { DateSortOrder, sortByDate } from '../../../../shared/utils/sort-by-date.util';

@Component({
  selector: 'app-client-payments',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <p class="text-sm text-base-content/60 mb-5">
      Payments your case manager has requested, and your full payment history. Pay a request
      online below — once it's received, a receipt appears here for download.
    </p>

    @if (errorMessage) {
      <div
        class="flex items-center gap-2 px-4 py-2.5 rounded-lg mb-4 text-sm bg-error/10 text-error border border-error/20"
      >
        <i class="material-icons-outlined text-base">error_outline</i>
        <span class="flex-1">{{ errorMessage }}</span>
      </div>
    }

    @if (pendingPayments.length > 0) {
      <section class="bb-card mb-6">
        <div class="bb-card-body">
          <h2 class="bb-section-title mb-3">Payment Requests</h2>
          <ul class="divide-y divide-base-300">
            @for (payment of pendingPayments; track payment._id) {
              <li class="py-3 flex flex-wrap items-center justify-between gap-2">
                <div class="min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="font-semibold">\${{ payment.amountInPaise / 100 | number: '1.2-2' }}</span>
                    <span class="bb-chip bb-chip-warning">{{ purposeLabel(payment.purpose) }}</span>
                  </div>
                  <p class="text-sm text-base-content/70 mt-0.5">{{ payment.description }}</p>
                  @if (payment.caseNumber) {
                    <p class="text-xs text-base-content/50 mt-0.5">Case {{ payment.caseNumber }}</p>
                  }
                  <span class="text-xs text-base-content/50"
                    >Requested {{ (payment.requestedAt || payment.createdAt) | date: 'mediumDate' }}</span
                  >
                </div>
                <a [routerLink]="['/client/payments', payment._id, 'pay']" class="bb-btn bb-btn-primary bb-btn-sm shrink-0">
                  Pay now
                </a>
              </li>
            }
          </ul>
        </div>
      </section>
    }

    <section class="bb-card">
      <div class="bb-card-body">
        <div class="mb-4 flex items-center justify-between gap-3">
          <h2 class="bb-section-title">Payment History</h2>
          <div class="flex items-center gap-2">
            <select
              class="bb-select bb-select-sm"
              [formControl]="sortOrder"
              aria-label="Sort by last update date"
            >
              <option value="desc">Newest first</option>
              <option value="asc">Oldest first</option>
            </select>
            <button class="bb-btn bb-btn-ghost bb-btn-sm" (click)="loadPayments()">
              <i class="material-icons-outlined text-base">refresh</i>
            </button>
          </div>
        </div>

        @if (historyLoading) {
          <div class="flex justify-center py-10">
            <span class="loading loading-spinner loading-md text-primary"></span>
          </div>
        } @else if (payments.length === 0) {
          <div class="bb-empty">
            <div class="bb-empty-icon"><i class="material-icons-outlined">receipt_long</i></div>
            <p class="bb-empty-title">No payments yet.</p>
          </div>
        } @else {
          <div class="bb-table-wrap">
            <div class="bb-table-scroll">
              <table class="bb-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Case</th>
                    <th>Amount</th>
                    <th>Purpose</th>
                    <th>Status</th>
                    <th>Description</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  @for (payment of payments; track payment._id) {
                    <tr>
                      <td class="text-xs">{{ payment.createdAt | date: 'mediumDate' }}</td>
                      <td class="text-xs font-mono">{{ payment.caseNumber || '—' }}</td>
                      <td class="font-semibold">
                        \${{ payment.amountInPaise / 100 | number: '1.2-2' }}
                      </td>
                      <td>{{ purposeLabel(payment.purpose) }}</td>
                      <td>
                        <span [class]="badgeClass(payment.status)">{{
                          payment.status | titlecase
                        }}</span>
                      </td>
                      <td class="text-xs text-base-content/70 max-w-[200px] truncate">
                        {{ payment.description || '—' }}
                      </td>
                      <td>
                        @if (payment.status === 'pending') {
                          <a
                            [routerLink]="['/client/payments', payment._id, 'pay']"
                            class="bb-btn bb-btn-primary bb-btn-sm"
                          >
                            Pay
                          </a>
                        }
                        @if (payment.receiptDocumentId; as docId) {
                          <button
                            class="bb-btn bb-btn-ghost bb-btn-icon"
                            (click)="downloadReceipt(docId)"
                            aria-label="Download receipt"
                            title="Download receipt"
                          >
                            <i class="material-icons-outlined text-base">receipt</i>
                          </button>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }
      </div>
    </section>
  `,
})
export class ClientPaymentsComponent implements OnInit {
  payments: Payment[] = [];
  sortOrder = new FormControl<DateSortOrder>('desc');
  historyLoading = false;
  errorMessage = '';

  constructor(
    private api: ApiService,
    private paymentsService: PaymentsService,
    private pageTitleService: PageTitleService,
  ) {}

  ngOnInit(): void {
    this.pageTitleService.set('Payments');
    this.loadPayments();
    this.sortOrder.valueChanges.subscribe(() => {
      this.payments = sortByDate(this.payments, this.sortOrder.value ?? 'desc');
    });
  }

  get pendingPayments(): Payment[] {
    return this.payments.filter((p) => p.status === 'pending');
  }

  loadPayments(): void {
    this.historyLoading = true;
    this.paymentsService.getPayments().subscribe({
      next: (data) => {
        this.payments = sortByDate(data, this.sortOrder.value ?? 'desc');
        this.historyLoading = false;
      },
      error: (err: unknown) => {
        const e = extractApiError(err, 'Failed to load payment history');
        this.errorMessage = e.message;
        this.historyLoading = false;
      },
    });
  }

  purposeLabel(p?: string): string {
    switch (p) {
      case 'TOKEN':
        return 'Token / Advance';
      case 'PARTIAL':
        return 'Partial payment';
      case 'MILESTONE':
        return 'Milestone payment';
      case 'FULL':
        return 'Full payment';
      default:
        return '—';
    }
  }

  downloadReceipt(documentId: string): void {
    this.api.get<{ downloadUrl: string }>(`/documents/${documentId}/download`).subscribe({
      next: (res) => {
        if (res.downloadUrl) window.open(res.downloadUrl, '_blank');
      },
      error: (err: unknown) => {
        this.errorMessage = extractApiError(err, 'Failed to download receipt').message;
      },
    });
  }

  badgeClass(status: string): string {
    const m: Record<string, string> = {
      pending: 'bb-chip bb-chip-warning',
      authorized: 'bb-chip bb-chip-info',
      captured: 'bb-chip bb-chip-success',
      failed: 'bb-chip bb-chip-danger',
      refunded: 'bb-chip bb-chip-neutral',
    };
    return m[status] ?? 'bb-chip bb-chip-neutral';
  }
}
