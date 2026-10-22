import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { PageTitleService } from '../../../core/services/page-title.service';
import { DateSortOrder, sortByDate } from '../../../shared/utils/sort-by-date.util';
import { BbSelectComponent } from '../../../shared/components/bb-select/bb-select.component';
import {
  QA_REVIEW_TYPES,
  QaReviewRow,
  QaReviewType,
  caseRefOf,
  reviewStatusChip,
  reviewStatusLabel,
  reviewTypeInfo,
  reviewerName,
} from '../qa-review.model';

@Component({
  selector: 'app-qa-reviews',
  standalone: true,
  imports: [CommonModule, FormsModule, BbSelectComponent],
  template: `
    <div class="mb-5">
      <p class="text-sm text-base-content/70 m-0 max-w-3xl">
        Every case is checked twice: the <strong>client's documents</strong> and the
        <strong>vendor's deliverables</strong>. Both checks must be approved before the case moves on to
        the client. Pick a check below to see what is waiting for you.
      </p>
    </div>

    <!-- The two checks -->
    <div class="flex flex-wrap gap-2 mb-2" role="tablist" aria-label="Type of check">
      @for (t of types; track t.type) {
        <button
          type="button"
          role="tab"
          class="bb-btn"
          [ngClass]="active === t.type ? 'bb-btn-primary' : 'bb-btn-outline'"
          [attr.aria-selected]="active === t.type"
          (click)="selectTab(t.type)"
        >
          {{ t.tab }}
          <span class="bb-chip ml-2" [ngClass]="awaiting(t.type) > 0 ? 'bb-chip-warning' : 'bb-chip-neutral'">{{
            awaiting(t.type)
          }}</span>
        </button>
      }
    </div>
    <p class="text-sm text-base-content/60 mb-1">{{ activeInfo.scope }}</p>
    <p class="text-sm text-base-content/60 mb-5">{{ activeInfo.onFail }}</p>

    <section class="bb-filter-card mb-4">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <label class="bb-label" for="qa-filter-status">Show</label>
          <app-bb-select
            id="qa-filter-status"
            [(ngModel)]="statusFilter"
            (ngModelChange)="applyFilters()"
            [options]="statusFilterOptions"
            placeholder="All"
          ></app-bb-select>
        </div>
        <div class="md:col-span-2">
          <label class="bb-label" for="qa-filter-search">Find a case</label>
          <input
            id="qa-filter-search"
            class="bb-input"
            type="search"
            placeholder="Case number or title"
            autocomplete="off"
            [(ngModel)]="search"
            (ngModelChange)="applyFilters()"
          />
        </div>
        <div>
          <label class="bb-label" for="qa-filter-sort">Order</label>
          <app-bb-select
            id="qa-filter-sort"
            [(ngModel)]="sortOrder"
            (ngModelChange)="applyFilters()"
            ariaLabel="Order by last update"
            [options]="sortOrderOptions"
          ></app-bb-select>
        </div>
      </div>
    </section>

    @if (loading) {
      <div class="flex justify-center py-12">
        <span class="loading loading-spinner loading-lg text-primary" aria-label="Loading reviews"></span>
      </div>
    } @else if (error) {
      <div
        role="alert"
        class="flex items-center gap-2 px-4 py-2.5 rounded-lg mb-4 text-sm bg-error/10 text-error border border-error/20"
      >
        <i class="material-icons-outlined text-base">error_outline</i>
        Could not load the reviews. Please try again.
      </div>
    } @else if (filteredReviews.length === 0) {
      <div class="bb-card">
        <div class="bb-empty">
          <div class="bb-empty-icon"><i class="material-icons-outlined">fact_check</i></div>
          <p class="bb-empty-title">Nothing to show</p>
          <p class="text-sm text-base-content/60">
            A case appears here for each check as soon as it reaches QA review.
          </p>
        </div>
      </div>
    } @else {
      <div class="hidden md:block bb-table-wrap">
        <div class="bb-table-scroll">
          <table class="bb-table">
            <thead>
              <tr>
                <th>Case</th>
                <th>This check</th>
                <th>Other check</th>
                <th>Reviewer</th>
                <th>Last decision</th>
                <th class="text-right"><span class="sr-only">Action</span></th>
              </tr>
            </thead>
            <tbody>
              @for (r of filteredReviews; track r._id) {
                <tr class="bb-row-clickable" (click)="open(r._id)">
                  <td>
                    <div class="font-medium">{{ caseOf(r).caseNumber ?? '—' }}</div>
                    <div class="text-xs text-base-content/60">{{ caseOf(r).title }}</div>
                  </td>
                  <td>
                    <span class="bb-chip" [ngClass]="chip(r.status)">{{ label(r.status) }}</span>
                  </td>
                  <td>
                    @if (otherStatus(r); as other) {
                      <span class="bb-chip" [ngClass]="chip(other)">{{ label(other) }}</span>
                    } @else {
                      <span class="text-base-content/50">—</span>
                    }
                  </td>
                  <td>{{ reviewer(r) }}</td>
                  <td>{{ r.reviewedAt ? (r.reviewedAt | date: 'mediumDate') : '—' }}</td>
                  <td class="text-right">
                    <button class="bb-btn bb-btn-ghost bb-btn-sm" (click)="$event.stopPropagation(); open(r._id)">
                      {{ isOpen(r) ? 'Review' : 'View' }}
                      <i class="material-icons-outlined text-base">chevron_right</i>
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      <div class="md:hidden flex flex-col gap-3">
        @for (r of filteredReviews; track r._id) {
          <div class="bb-row-card cursor-pointer" (click)="open(r._id)">
            <div class="flex items-start justify-between gap-2 mb-2">
              <div>
                <div class="font-semibold text-base-content">{{ caseOf(r).caseNumber ?? '—' }}</div>
                <div class="text-xs text-base-content/60">{{ caseOf(r).title }}</div>
              </div>
              <span class="bb-chip" [ngClass]="chip(r.status)">{{ label(r.status) }}</span>
            </div>
            <div class="text-sm text-base-content/70 space-y-1">
              <div><span class="font-medium">Reviewer:</span> {{ reviewer(r) }}</div>
              @if (otherStatus(r); as other) {
                <div><span class="font-medium">Other check:</span> {{ label(other) }}</div>
              }
            </div>
          </div>
        }
      </div>
    }
  `,
})
export class QaReviewsComponent implements OnInit {
  reviews: QaReviewRow[] = [];
  filteredReviews: QaReviewRow[] = [];
  loading = true;
  error = false;
  active: QaReviewType = 'CLIENT_DOCUMENTS';
  statusFilter = '';
  search = '';
  sortOrder: DateSortOrder = 'desc';

  readonly types = QA_REVIEW_TYPES;
  readonly statusFilterOptions = [
    { value: '', label: 'Everything' },
    { value: 'OPEN', label: 'Waiting for a decision' },
    { value: 'APPROVED', label: 'Approved' },
    { value: 'REJECTED', label: 'Changes requested' },
  ];
  readonly sortOrderOptions = [
    { value: 'desc', label: 'Newest first' },
    { value: 'asc', label: 'Oldest first' },
  ];

  readonly label = reviewStatusLabel;
  readonly chip = reviewStatusChip;

  constructor(
    private api: ApiService,
    private router: Router,
    private pageTitleService: PageTitleService,
  ) {}

  get activeInfo() {
    return reviewTypeInfo(this.active);
  }

  ngOnInit(): void {
    this.pageTitleService.set('QA Reviews');
    this.api.get<QaReviewRow[]>('/qa/reviews').subscribe({
      next: (data) => {
        this.reviews = data ?? [];
        // Land on whichever check has something waiting.
        if (this.awaiting('CLIENT_DOCUMENTS') === 0 && this.awaiting('VENDOR_DELIVERABLES') > 0) {
          this.active = 'VENDOR_DELIVERABLES';
        }
        this.applyFilters();
        this.loading = false;
      },
      error: () => {
        this.error = true;
        this.loading = false;
      },
    });
  }

  caseOf(r: QaReviewRow) {
    return caseRefOf(r.caseId);
  }

  reviewer(r: QaReviewRow): string {
    return reviewerName(r.qaLeadId);
  }

  isOpen(r: QaReviewRow): boolean {
    return r.status === 'PENDING' || r.status === 'IN_REVIEW';
  }

  awaiting(type: QaReviewType): number {
    return this.reviews.filter((r) => r.reviewType === type && this.isOpen(r)).length;
  }

  /** Status of the same case's other check, so QA can see where the case stands overall. */
  otherStatus(r: QaReviewRow): string | null {
    const id = this.caseOf(r)._id;
    if (!id) return null;
    const other = this.reviews.find((o) => o.reviewType !== r.reviewType && this.caseOf(o)._id === id);
    return other?.status ?? null;
  }

  selectTab(type: QaReviewType): void {
    this.active = type;
    this.applyFilters();
  }

  applyFilters(): void {
    const term = this.search.trim().toLowerCase();
    const rows = this.reviews.filter((r) => {
      if (r.reviewType !== this.active) return false;
      if (this.statusFilter === 'OPEN' && !this.isOpen(r)) return false;
      if (this.statusFilter && this.statusFilter !== 'OPEN' && r.status !== this.statusFilter) return false;
      if (term) {
        const c = this.caseOf(r);
        const haystack = `${c.caseNumber ?? ''} ${c.title ?? ''}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
    this.filteredReviews = sortByDate(rows, this.sortOrder);
  }

  open(id: string): void {
    this.router.navigate(['/qa/reviews', id]);
  }
}
