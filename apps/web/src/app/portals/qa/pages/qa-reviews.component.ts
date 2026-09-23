import { Component, ElementRef, HostListener, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { PageTitleService } from '../../../core/services/page-title.service';
import { DateSortOrder, sortByDate } from '../../../shared/utils/sort-by-date.util';
import { BbSelectComponent } from '../../../shared/components/bb-select/bb-select.component';

interface QaReview {
  _id: string;
  caseId: string | { _id?: string; caseNumber?: string; title?: string; status?: string };
  qaLeadId: string | { name?: string };
  status: string;
  overallScore?: number;
  reviewedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

@Component({
  selector: 'app-qa-reviews',
  standalone: true,
  imports: [CommonModule, FormsModule, BbSelectComponent],
  template: `
    <div class="flex items-center justify-between gap-3 mb-5">
      <p class="text-sm text-base-content/60">Deliverables awaiting your decision and prior reviews.</p>
      @if (!loading) {
        <span class="bb-page-count">{{ reviews.length }} {{ reviews.length === 1 ? 'review' : 'reviews' }}</span>
      }
    </div>

    <section class="bb-filter-card mb-4">
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
        class="grid grid-cols-1 md:grid-cols-5 gap-3"
        [class.bb-filter-row--collapsed]="!filtersExpanded"
      >
        <div>
          <label class="bb-label" for="qa-filter-status">Status</label>
          <app-bb-select
            id="qa-filter-status"
            [(ngModel)]="statusFilter"
            (ngModelChange)="applyFilters()"
            [options]="statusFilterOptions"
            placeholder="All"
          ></app-bb-select>
        </div>
        <div class="relative" #caseFilterWrap>
          <label class="bb-label" for="qa-filter-search">Case search</label>
          <button
            id="qa-filter-search"
            type="button"
            class="bb-input text-left w-full flex items-center justify-between gap-2"
            (click)="toggleCaseDropdown()"
          >
            <span class="truncate">{{ selectedCaseLabel() }}</span>
            <i class="material-icons-outlined text-base">arrow_drop_down</i>
          </button>
          @if (caseDropdownOpen) {
            <div
              class="bb-search-dd-panel bg-base-100 border border-base-300 rounded-xl shadow-lg"
            >
              <div class="p-2 border-b border-base-200">
                <input
                  class="bb-input"
                  [(ngModel)]="caseSearchTerm"
                  placeholder="Search case # or title…"
                  autocomplete="off"
                />
              </div>
              <ul class="max-h-52 overflow-y-auto">
                <li
                  class="px-4 py-2.5 hover:bg-base-200 cursor-pointer text-sm font-semibold border-b border-base-200"
                  (click)="selectCase('')"
                >
                  All cases
                </li>
                @for (c of filteredCaseOptions(); track c.id) {
                  <li
                    class="px-4 py-2.5 hover:bg-base-200 cursor-pointer text-sm border-b border-base-200 last:border-b-0"
                    (click)="selectCase(c.id)"
                  >
                    {{ c.label }}
                  </li>
                } @empty {
                  <li class="px-4 py-3 text-sm text-base-content/50">No matching cases</li>
                }
              </ul>
            </div>
          }
        </div>
        <div>
          <label class="bb-label" for="qa-filter-score">Min score</label>
          <input
            id="qa-filter-score"
            type="number"
            min="1"
            max="10"
            class="bb-input"
            [(ngModel)]="minScore"
            (ngModelChange)="applyFilters()"
          />
        </div>
        <div>
          <label class="bb-label" for="qa-filter-sort">Sort by</label>
          <app-bb-select
            id="qa-filter-sort"
            [(ngModel)]="sortOrder"
            (ngModelChange)="applyFilters()"
            ariaLabel="Sort by last update date"
            [options]="sortOrderOptions"
          ></app-bb-select>
        </div>
        <div class="flex items-end">
          <button type="button" class="bb-btn bb-btn-ghost" (click)="clearFilters()">Clear</button>
        </div>
      </div>
    </section>

    @if (!loading) {
      <div class="mb-8">
        <div class="mb-4 flex items-center justify-between gap-3">
          <h2 class="bb-section-title">Review Snapshot</h2>
          <span class="text-xs sm:text-sm text-base-content/60">Updated just now</span>
        </div>

        <div class="bb-stats-grid">
          <div class="bb-stat-card accent-ink">
            <div class="bb-stat-icon">
              <i class="material-icons-outlined text-base">fact_check</i>
            </div>
            <div class="bb-stat-value">{{ filteredReviews.length }}</div>
            <div class="bb-stat-label">Total Reviews</div>
            <div class="bb-stat-sub">Assigned to QA</div>
          </div>

          <div class="bb-stat-card accent-saffron">
            <div class="bb-stat-icon">
              <i class="material-icons-outlined text-base">pending_actions</i>
            </div>
            <div class="bb-stat-value">
              {{ getStatusCount('PENDING') + getStatusCount('IN_REVIEW') }}
            </div>
            <div class="bb-stat-label">Pending</div>
            <div class="bb-stat-sub">Awaiting decision</div>
          </div>

          <div class="bb-stat-card accent-teal">
            <div class="bb-stat-icon">
              <i class="material-icons-outlined text-base">verified</i>
            </div>
            <div class="bb-stat-value">{{ getStatusCount('APPROVED') }}</div>
            <div class="bb-stat-label">Approved</div>
            <div class="bb-stat-sub">Released to client</div>
          </div>

          <div class="bb-stat-card accent-warn">
            <div class="bb-stat-icon">
              <i class="material-icons-outlined text-base">cancel</i>
            </div>
            <div class="bb-stat-value">{{ getStatusCount('REJECTED') }}</div>
            <div class="bb-stat-label">Rejected</div>
            <div class="bb-stat-sub">Sent back to vendor</div>
          </div>
        </div>
      </div>
    }

    @if (loading) {
      <div class="flex justify-center py-12">
        <span
          class="loading loading-spinner loading-lg text-primary"
          aria-label="Loading reviews"
        ></span>
      </div>
    } @else if (filteredReviews.length === 0) {
      <div class="bb-card">
        <div class="bb-empty">
          <div class="bb-empty-icon"><i class="material-icons-outlined">fact_check</i></div>
          <p class="bb-empty-title">No reviews found</p>
          <p class="text-sm text-base-content/60">
            When vendors submit deliverables, the reviews will appear here.
          </p>
        </div>
      </div>
    } @else {
      <!-- Desktop / tablet table -->
      <div class="hidden md:block bb-table-wrap">
        <div class="bb-table-scroll">
          <table class="bb-table">
            <thead>
              <tr>
                <th>Case</th>
                <th>QA Lead</th>
                <th>Status</th>
                <th>Overall Score</th>
                <th>Reviewed At</th>
                <th class="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (r of filteredReviews; track r._id) {
                <tr class="bb-row-clickable" (click)="goToDetail(r._id)">
                  <td>{{ getCaseName(r.caseId) }}</td>
                  <td>{{ getLeadName(r.qaLeadId) }}</td>
                  <td>
                    <span class="bb-chip" [ngClass]="statusChipClass(r.status)">{{
                      r.status
                    }}</span>
                  </td>
                  <td>{{ r.overallScore ?? '—' }}</td>
                  <td>{{ r.reviewedAt ? (r.reviewedAt | date: 'mediumDate') : '—' }}</td>
                  <td class="text-right">
                    <button
                      class="bb-btn bb-btn-ghost bb-btn-sm mr-2"
                      (click)="$event.stopPropagation(); openCase(r)"
                      aria-label="Open case detail"
                    >
                      <i class="material-icons-outlined text-base">folder_open</i>
                    </button>
                    <button
                      class="bb-btn bb-btn-ghost bb-btn-sm"
                      (click)="$event.stopPropagation(); goToDetail(r._id)"
                      aria-label="View review details"
                    >
                      <i class="material-icons-outlined text-base">open_in_new</i>
                      <span class="ml-1">View</span>
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- Mobile cards -->
      <div class="md:hidden flex flex-col gap-3">
        @for (r of filteredReviews; track r._id) {
          <div class="bb-row-card cursor-pointer" (click)="goToDetail(r._id)">
            <div class="flex items-start justify-between gap-2 mb-2">
              <div class="font-semibold text-base-content">{{ getCaseName(r.caseId) }}</div>
              <span class="bb-chip" [ngClass]="statusChipClass(r.status)">{{ r.status }}</span>
            </div>
            <div class="text-sm text-base-content/70 space-y-1">
              <div><span class="font-medium">QA Lead:</span> {{ getLeadName(r.qaLeadId) }}</div>
              <div><span class="font-medium">Score:</span> {{ r.overallScore ?? '—' }}</div>
              <div>
                <span class="font-medium">Reviewed:</span>
                {{ r.reviewedAt ? (r.reviewedAt | date: 'mediumDate') : '—' }}
              </div>
            </div>
            <div class="flex justify-end pt-2">
              <button
                class="bb-btn bb-btn-ghost bb-btn-sm mr-2"
                (click)="$event.stopPropagation(); openCase(r)"
                aria-label="Open case detail"
              >
                <i class="material-icons-outlined text-base">folder_open</i>
              </button>
              <button
                class="bb-btn bb-btn-ghost bb-btn-sm"
                (click)="$event.stopPropagation(); goToDetail(r._id)"
                aria-label="View review details"
              >
                <i class="material-icons-outlined text-base">open_in_new</i>
                <span class="ml-1">View</span>
              </button>
            </div>
          </div>
        }
      </div>
    }

    @if (!loading && error) {
      <div class="flex items-center gap-2 px-4 py-2.5 rounded-lg mb-4 text-sm bg-error/10 text-error border border-error/20">
        <i class="material-icons-outlined text-base">error_outline</i>
        Failed to load reviews. Please try again.
      </div>
    }
  `,
  styles: [],
})
export class QaReviewsComponent implements OnInit {
  reviews: QaReview[] = [];
  filteredReviews: QaReview[] = [];
  loading = true;
  error = false;
  statusFilter = '';
  selectedCaseId = '';
  filtersExpanded = true;

  activeFilterCount(): number {
    return (
      (this.statusFilter ? 1 : 0) + (this.selectedCaseId ? 1 : 0) + (this.minScore != null ? 1 : 0)
    );
  }

  readonly statusFilterOptions = [
    { value: '', label: 'All' },
    { value: 'PENDING', label: 'Pending' },
    { value: 'IN_REVIEW', label: 'In review' },
    { value: 'APPROVED', label: 'Approved' },
    { value: 'REJECTED', label: 'Rejected' },
  ];
  readonly sortOrderOptions = [
    { value: 'desc', label: 'Newest first' },
    { value: 'asc', label: 'Oldest first' },
  ];
  caseSearchTerm = '';
  caseDropdownOpen = false;
  minScore: number | null = null;
  sortOrder: DateSortOrder = 'desc';
  displayedColumns = ['caseId', 'qaLeadId', 'status', 'overallScore', 'reviewedAt', 'actions'];

  @ViewChild('caseFilterWrap') caseFilterWrapRef?: ElementRef<HTMLElement>;

  constructor(
    private api: ApiService,
    private router: Router,
    private pageTitleService: PageTitleService,
  ) {}

  ngOnInit(): void {
    this.pageTitleService.set('QA Reviews');
    this.api.get<QaReview[]>('/qa/reviews').subscribe({
      next: (data) => {
        this.reviews = data ?? [];
        this.applyFilters();
        this.loading = false;
      },
      error: () => {
        this.error = true;
        this.loading = false;
      },
    });
  }

  getCaseName(caseId: QaReview['caseId']): string {
    if (!caseId) return '—';
    if (typeof caseId === 'string') return caseId;
    return (caseId as { caseNumber?: string }).caseNumber ?? '—';
  }

  getLeadName(leadId: QaReview['qaLeadId']): string {
    if (!leadId) return '—';
    if (typeof leadId === 'string') return leadId;
    const l = leadId as { name?: string };
    return (l.name ?? '').trim() || '—';
  }

  statusChipClass(status: string): string {
    switch ((status ?? '').toLowerCase()) {
      case 'approved':
        return 'bb-chip-success';
      case 'rejected':
        return 'bb-chip-danger';
      case 'pending':
        return 'bb-chip-warning';
      default:
        return 'bb-chip-neutral';
    }
  }

  goToDetail(id: string): void {
    this.router.navigate(['/qa/reviews', id]);
  }

  openCase(review: QaReview): void {
    if (review.caseId && typeof review.caseId !== 'string' && review.caseId.caseNumber) {
      this.router.navigate(['/case-manager/cases', review.caseId.caseNumber]);
    }
  }

  clearFilters(): void {
    this.statusFilter = '';
    this.selectedCaseId = '';
    this.minScore = null;
    this.applyFilters();
  }

  applyFilters(): void {
    const filtered = this.reviews.filter((r) => {
      if (this.statusFilter && r.status !== this.statusFilter) return false;
      if (this.minScore !== null && (r.overallScore ?? 0) < this.minScore) return false;
      if (this.selectedCaseId && this.caseIdOf(r) !== this.selectedCaseId) return false;
      return true;
    });
    this.filteredReviews = sortByDate(filtered, this.sortOrder);
  }

  getStatusCount(status: string): number {
    return this.filteredReviews.filter((r) => (r.status ?? '') === status).length;
  }

  private caseIdOf(review: QaReview): string {
    const c = review.caseId;
    if (!c) return '';
    return typeof c === 'string' ? c : (c._id ?? '');
  }

  get caseOptions(): { id: string; label: string }[] {
    const map = new Map<string, string>();
    this.reviews.forEach((r) => {
      const id = this.caseIdOf(r);
      if (!id || map.has(id)) return;
      map.set(id, this.getCaseName(r.caseId));
    });
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
  }

  filteredCaseOptions(): { id: string; label: string }[] {
    const term = this.caseSearchTerm.trim().toLowerCase();
    if (!term) return this.caseOptions;
    return this.caseOptions.filter((c) => c.label.toLowerCase().includes(term));
  }

  selectedCaseLabel(): string {
    if (!this.selectedCaseId) return 'All cases';
    return this.caseOptions.find((c) => c.id === this.selectedCaseId)?.label ?? 'All cases';
  }

  toggleCaseDropdown(): void {
    if (!this.caseDropdownOpen) this.caseSearchTerm = '';
    this.caseDropdownOpen = !this.caseDropdownOpen;
  }

  selectCase(id: string): void {
    this.selectedCaseId = id;
    this.caseDropdownOpen = false;
    this.applyFilters();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (
      this.caseDropdownOpen &&
      this.caseFilterWrapRef &&
      !this.caseFilterWrapRef.nativeElement.contains(event.target as Node)
    ) {
      this.caseDropdownOpen = false;
    }
  }
}
