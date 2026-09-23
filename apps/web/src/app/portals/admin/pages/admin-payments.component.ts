import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PaymentsService, Payment } from '../../../core/services/payments.service';
import { extractApiError } from '../../../core/services/api-error';
import { PageTitleService } from '../../../core/services/page-title.service';
import { DateSortOrder, sortByDate } from '../../../shared/utils/sort-by-date.util';
import { BbSelectComponent } from '../../../shared/components/bb-select/bb-select.component';

@Component({
  selector: 'app-admin-payments',
  standalone: true,
  imports: [CommonModule, FormsModule, BbSelectComponent, RouterLink],
  template: `
    <div class="flex items-center justify-between gap-3 mb-5">
      <p class="text-sm text-base-content/60">
        Read-only. Payments are requested and marked paid from a case's own detail page.
      </p>
      <span class="bb-page-count">{{ filteredPayments.length }} of {{ payments.length }}</span>
    </div>

    @if (errorMessage) {
      <div
        role="alert"
        class="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-error/10 text-error border border-error/20 text-sm mb-6"
      >
        <i class="material-icons-outlined">error_outline</i>
        <span>{{ errorMessage }}</span>
      </div>
    }

    <!-- Summary Cards -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
      <div class="bb-card flex items-center gap-3 p-3">
        <div class="h-9 w-9 rounded-lg bg-teal-500/10 text-teal-600 flex items-center justify-center shrink-0">
          <i class="material-icons-outlined text-lg">attach_money</i>
        </div>
        <div>
          <div class="text-xl font-bold leading-none">\${{ getTotalCaptured() | number: '1.2-2' }}</div>
          <div class="mt-0.5 text-xs uppercase tracking-wide text-base-content/60">Total Revenue</div>
          <div class="text-xs text-base-content/40 mt-0.5">Captured payments</div>
        </div>
      </div>
      <div class="bb-card flex items-center gap-3 p-3">
        <div class="h-9 w-9 rounded-lg bg-warning/10 text-warning flex items-center justify-center shrink-0">
          <i class="material-icons-outlined text-lg">pending_actions</i>
        </div>
        <div>
          <div class="text-xl font-bold leading-none">\${{ getPendingCapture() | number: '1.2-2' }}</div>
          <div class="mt-0.5 text-xs uppercase tracking-wide text-base-content/60">Pending Capture</div>
          <div class="text-xs text-base-content/40 mt-0.5">Authorized holds</div>
        </div>
      </div>
      <div class="bb-card flex items-center gap-3 p-3">
        <div class="h-9 w-9 rounded-lg bg-error/10 text-error flex items-center justify-center shrink-0">
          <i class="material-icons-outlined text-lg">error_outline</i>
        </div>
        <div>
          <div class="text-xl font-bold leading-none">\${{ getFailedAmount() | number: '1.2-2' }}</div>
          <div class="mt-0.5 text-xs uppercase tracking-wide text-base-content/60">Failed</div>
          <div class="text-xs text-base-content/40 mt-0.5">Failed transactions</div>
        </div>
      </div>
      <div class="bb-card flex items-center gap-3 p-3">
        <div class="h-9 w-9 rounded-lg bg-base-300/50 text-base-content/60 flex items-center justify-center shrink-0">
          <i class="material-icons-outlined text-lg">undo</i>
        </div>
        <div>
          <div class="text-xl font-bold leading-none">\${{ getRefundedAmount() | number: '1.2-2' }}</div>
          <div class="mt-0.5 text-xs uppercase tracking-wide text-base-content/60">Refunded</div>
          <div class="text-xs text-base-content/40 mt-0.5">Total refunds issued</div>
        </div>
      </div>
    </div>

    <!-- Filters -->
    <div class="bb-filter-card mb-4">
      <button
        type="button"
        class="bb-filter-toggle"
        (click)="filtersExpanded = !filtersExpanded"
        [attr.aria-expanded]="filtersExpanded"
      >
        <span class="flex items-center gap-1.5">
          <i class="material-icons-outlined text-base">tune</i>
          Filters
          @if (activeFilterCount() > 0) {
            <span class="bb-chip bb-chip-info">{{ activeFilterCount() }}</span>
          }
        </span>
        <i class="material-icons-outlined text-base">{{
          filtersExpanded ? 'expand_less' : 'expand_more'
        }}</i>
      </button>

      <div
        class="flex flex-col sm:flex-row sm:flex-wrap gap-3 items-stretch sm:items-end"
        [class.bb-filter-row--collapsed]="!filtersExpanded"
      >
        <div class="w-full sm:w-48 sm:shrink-0">
          <label class="bb-label">Status</label>
          <app-bb-select
            [(ngModel)]="statusFilter"
            (ngModelChange)="applyFilters()"
            [options]="statusFilterOptions"
            placeholder="All Statuses"
          ></app-bb-select>
        </div>
        <div class="flex-1 min-w-52">
          <label class="bb-label">Search</label>
          <input type="text" class="bb-input" placeholder="Search by case / client ID…" [(ngModel)]="searchTerm" (ngModelChange)="applyFilters()" />
        </div>
        <div class="w-full sm:w-44 sm:shrink-0">
          <label class="bb-label" for="payments-sort">Sort by</label>
          <app-bb-select
            id="payments-sort"
            [(ngModel)]="sortOrder"
            (ngModelChange)="applyFilters()"
            ariaLabel="Sort by last update date"
            [options]="sortOrderOptions"
          ></app-bb-select>
        </div>
      </div>
    </div>

    <!-- Payments Table -->
    @if (loading) {
      <div class="bb-table-wrap">
        <div class="bb-table-scroll">
          <table class="bb-table">
            <thead>
              <tr>
                <th>Transaction ID</th>
                <th>Client</th>
                <th>Case</th>
                <th class="text-right">Amount</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              @for (i of skeletonRows; track i) {
                <tr class="bb-skeleton-row">
                  <td><div class="bb-skeleton bb-skeleton-text" style="width: 5.5rem"></div></td>
                  <td><div class="bb-skeleton bb-skeleton-text" style="width: 7rem"></div></td>
                  <td><div class="bb-skeleton bb-skeleton-text" style="width: 5rem"></div></td>
                  <td class="text-right"><div class="bb-skeleton bb-skeleton-text ml-auto" style="width: 4rem"></div></td>
                  <td><div class="bb-skeleton bb-skeleton-text" style="width: 4.5rem"></div></td>
                  <td><div class="bb-skeleton bb-skeleton-text" style="width: 5rem"></div></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    } @else if (filteredPayments.length === 0) {
      <div class="bb-empty">
        <div class="bb-empty-icon"><i class="material-icons-outlined">receipt_long</i></div>
        <p class="bb-empty-title">No payments found</p>
        <p class="text-sm" style="color: var(--ink-60)">Try adjusting the filters above.</p>
      </div>
    } @else {
      <div class="bb-table-wrap">
        <div class="bb-table-scroll">
          <table class="bb-table">
            <thead>
              <tr>
                <th>Transaction ID</th>
                <th>Client</th>
                <th>Case</th>
                <th class="text-right">Amount</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              @for (payment of filteredPayments; track payment._id) {
                <tr>
                  <td class="font-mono text-xs">
                    {{ (payment.transactionId || payment._id) | slice: 0 : 12 }}…
                  </td>
                  <td class="text-sm">
                    {{ payment.clientName || (payment.clientId | slice: 0 : 8) + '…' }}
                  </td>
                  <td class="text-sm font-medium">
                    @if (payment.caseNumber) {
                      <a
                        class="font-mono text-sm text-[var(--saffron)] hover:underline"
                        [routerLink]="['/admin/cases', payment.caseNumber]"
                      >
                        {{ payment.caseNumber }}
                      </a>
                    } @else {
                      <span class="text-sm text-base-content/40 italic">Case deleted</span>
                    }
                  </td>
                  <td class="text-right font-semibold">\${{ (payment.amountInPaise / 100).toFixed(2) }}</td>
                  <td>
                    <span [class]="getStatusBadge(payment.status)">
                      {{ payment.status | titlecase }}
                    </span>
                  </td>
                  <td class="text-xs">{{ payment.createdAt | date: 'short' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    }
  `,
  styles: [`
    thead th { position: sticky; top: 0; z-index: 2; background: var(--ivory-soft); }
  `],
})
export class AdminPaymentsComponent implements OnInit {
  payments: Payment[] = [];
  filteredPayments: Payment[] = [];
  statusFilter = '';
  searchTerm = '';
  filtersExpanded = true;

  activeFilterCount(): number {
    return (this.statusFilter ? 1 : 0) + (this.searchTerm ? 1 : 0);
  }
  sortOrder: DateSortOrder = 'desc';
  loading = false;
  readonly skeletonRows = [1, 2, 3, 4, 5];
  errorMessage = '';
  readonly sortOrderOptions = [
    { value: 'desc', label: 'Newest first' },
    { value: 'asc', label: 'Oldest first' },
  ];
  readonly statusFilterOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'pending', label: 'Pending' },
    { value: 'authorized', label: 'Authorized' },
    { value: 'captured', label: 'Captured' },
    { value: 'failed', label: 'Failed' },
    { value: 'refunded', label: 'Refunded' },
  ];

  constructor(
    private paymentsService: PaymentsService,
    private pageTitleService: PageTitleService,
  ) {}

  ngOnInit(): void {
    this.pageTitleService.set('Payments');
    this.loadPayments();
  }

  loadPayments(): void {
    this.loading = true;
    this.paymentsService.getPayments().subscribe({
      next: (data: Payment[]) => {
        this.payments = data;
        this.applyFilters();
        this.loading = false;
      },
      error: (err: unknown) => {
        const e = extractApiError(err, 'Failed to load payments');
        this.errorMessage = e.message;
        this.loading = false;
      },
    });
  }

  applyFilters(): void {
    const filtered = this.payments.filter((p) => {
      const matchesStatus = !this.statusFilter || p.status === this.statusFilter;
      const term = this.searchTerm.trim().toLowerCase();
      const matchesSearch =
        !term ||
        p.caseId.includes(term) ||
        p.clientId.includes(term) ||
        p.transactionId?.includes(term) ||
        p.caseNumber?.toLowerCase().includes(term) ||
        p.clientName?.toLowerCase().includes(term);
      return matchesStatus && matchesSearch;
    });
    this.filteredPayments = sortByDate(filtered, this.sortOrder);
  }

  getTotalCaptured(): number {
    return (
      this.payments
        .filter((p) => p.status === 'captured')
        .reduce((sum, p) => sum + p.amountInPaise, 0) / 100
    );
  }

  getPendingCapture(): number {
    return (
      this.payments
        .filter((p) => p.status === 'authorized')
        .reduce((sum, p) => sum + p.amountInPaise, 0) / 100
    );
  }

  getFailedAmount(): number {
    return (
      this.payments
        .filter((p) => p.status === 'failed')
        .reduce((sum, p) => sum + p.amountInPaise, 0) / 100
    );
  }

  getRefundedAmount(): number {
    return (
      this.payments
        .filter((p) => p.status === 'refunded')
        .reduce((sum, p) => sum + p.amountInPaise, 0) / 100
    );
  }

  getStatusBadge(status: string): string {
    const map: Record<string, string> = {
      pending: 'bb-chip bb-chip-warning',
      authorized: 'bb-chip bb-chip-info',
      captured: 'bb-chip bb-chip-success',
      failed: 'bb-chip bb-chip-danger',
      refunded: 'bb-chip bb-chip-neutral',
    };
    return map[status] ?? 'bb-chip bb-chip-neutral';
  }
}
