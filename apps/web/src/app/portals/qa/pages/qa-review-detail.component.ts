import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { PageTitleService } from '../../../core/services/page-title.service';

interface ChecklistItem {
  item: string;
  isPassed: boolean;
  note?: string;
}

interface QaReviewDetail {
  _id: string;
  caseId: string | { _id?: string; caseNumber?: string; title?: string; status?: string };
  qaLeadId: string | { name?: string };
  status: string;
  overallScore?: number;
  reviewedAt?: string;
  checklist: ChecklistItem[];
  comments?: string;
  approvalNote?: string;
  rejectionReason?: string;
  rejectedItems?: string[];
}

interface CaseContext {
  _id: string;
  caseNumber?: string;
  title?: string;
  status?: string;
}

interface CaseDocument {
  _id: string;
  originalFileName?: string;
  name?: string;
  verificationStatus?: string;
}

@Component({
  selector: 'app-qa-review-detail',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="flex items-center justify-between gap-3 mb-5">
      <p class="text-sm text-base-content/60">
        Summary, checklist and decision for this deliverable.
      </p>
      <button class="bb-btn bb-btn-ghost bb-btn-sm gap-1" (click)="goBack()">
        <i class="material-icons-outlined">arrow_back</i>
        Back to Reviews
      </button>
    </div>

    @if (loading) {
      <div class="flex justify-center py-12">
        <span
          class="loading loading-spinner loading-lg text-primary"
          aria-label="Loading review"
        ></span>
      </div>
    }

    @if (!loading && review) {
      <div class="flex flex-col gap-5 max-w-4xl">
        <!-- Summary Card -->
        <div class="bb-card">
          <div class="bb-card-body">
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div class="bb-section-title break-all">
                Review — {{ getCaseName(review.caseId) }}
              </div>
              <span class="bb-chip" [ngClass]="statusChipClass(review.status)">{{
                review.status
              }}</span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <div class="flex flex-col gap-1">
                <span class="bb-label">Case</span>
                <span class="text-sm text-base-content">{{ getCaseName(review.caseId) }}</span>
              </div>
              <div class="flex flex-col gap-1">
                <span class="bb-label">QA Lead</span>
                <span class="text-sm text-base-content">{{ getLeadName(review.qaLeadId) }}</span>
              </div>
              <div class="flex flex-col gap-1">
                <span class="bb-label">Overall Score</span>
                <span class="text-sm text-base-content">{{ review.overallScore }}</span>
              </div>
              <div class="flex flex-col gap-1">
                <span class="bb-label">Reviewed At</span>
                <span class="text-sm text-base-content">{{
                  review.reviewedAt ? (review.reviewedAt | date: 'medium') : '—'
                }}</span>
              </div>
            </div>

            @if (review.comments) {
              <div class="mt-4">
                <span class="bb-label">Comments</span>
                <p class="mt-2 text-base-content/80">{{ review.comments }}</p>
              </div>
            }

            @if (caseContext) {
              <div class="mt-4 pt-4 border-t border-base-300">
                <p class="bb-label">Case Context</p>
                <p class="text-sm m-0">
                  {{ caseContext.caseNumber }} · {{ caseContext.title || 'Untitled case' }}
                </p>
                <p class="text-xs text-base-content/60 m-0 mt-1">
                  Status: {{ caseContext.status || '—' }}
                </p>
              </div>
            }

            @if (caseDocuments.length) {
              <div class="mt-4">
                <p class="bb-label">Case Documents</p>
                <ul class="text-sm space-y-1 m-0 p-0 list-none">
                  @for (doc of caseDocuments; track doc._id) {
                    <li class="flex items-center justify-between gap-2">
                      <span>{{ doc.originalFileName || doc.name || doc._id }}</span>
                      <span class="bb-chip bb-chip-neutral">{{
                        doc.verificationStatus || 'PENDING'
                      }}</span>
                    </li>
                  }
                </ul>
              </div>
            }
          </div>
        </div>

        <!-- Checklist Card -->
        @if (review.checklist.length) {
          <div class="bb-card">
            <div class="bb-card-body">
              <div class="bb-section-title">Checklist</div>
              <ul class="divide-y divide-base-300">
                @for (item of review.checklist; track item.item) {
                  <li class="py-3">
                    <div class="flex items-center gap-3">
                      <button
                        type="button"
                        class="bb-btn bb-btn-ghost bb-btn-sm"
                        (click)="toggleChecklistItem(item)"
                      >
                        <i
                          class="material-icons-outlined"
                          [class.text-success]="item.isPassed"
                          [class.text-error]="!item.isPassed"
                        >
                          {{ item.isPassed ? 'check_circle' : 'cancel' }}
                        </i>
                      </button>
                      <span class="flex-1 text-base-content">{{ item.item }}</span>
                      <span
                        class="bb-chip"
                        [ngClass]="item.isPassed ? 'bb-chip-success' : 'bb-chip-danger'"
                      >
                        {{ item.isPassed ? 'Pass' : 'Fail' }}
                      </span>
                    </div>
                    <textarea
                      class="bb-textarea mt-2"
                      rows="2"
                      [(ngModel)]="item.note"
                      placeholder="Validation note"
                    ></textarea>
                  </li>
                }
              </ul>
              <div class="flex justify-end mt-3">
                <button
                  class="bb-btn bb-btn-outline"
                  (click)="saveChecklist()"
                  [disabled]="actionLoading"
                >
                  Save checklist
                </button>
              </div>
            </div>
          </div>
        }

        <!-- Action Card -->
        @if (
          review.status === 'PENDING' ||
          review.status === 'pending' ||
          review.status === 'IN_REVIEW'
        ) {
          <div class="bb-card">
            <div class="bb-card-body">
              <header>
                <p class="bb-page-eyebrow mb-1">REVIEW DECISION</p>
                <h3 class="bb-section-title m-0">Approve or reject this deliverable</h3>
                <p class="bb-section-subtitle mt-1">
                  An approval releases the deliverable to the client. A rejection routes it back to
                  the vendor with your reason.
                </p>
              </header>

              <div>
                <label class="bb-label" for="qa-review-reason">
                  Comments
                  <span class="font-normal text-base-content/60 normal-case tracking-normal"
                    >(required when rejecting)</span
                  >
                </label>
                <textarea
                  class="bb-textarea min-h-28"
                  id="qa-review-reason"
                  name="reason"
                  [(ngModel)]="reason"
                  placeholder="What did you check? What changes are needed?"
                  aria-label="Comments — required when rejecting"
                ></textarea>
              </div>

              <div>
                <label class="bb-label">Rejected Items</label>
                <div class="flex flex-wrap gap-2">
                  @for (item of failedChecklistItems(); track item) {
                    <label class="bb-chip bb-chip-neutral cursor-pointer">
                      <input
                        type="checkbox"
                        class="mr-1"
                        [checked]="selectedRejectedItems.has(item)"
                        (change)="toggleRejectedItem(item)"
                      />
                      {{ item }}
                    </label>
                  }
                </div>
              </div>

              <div
                class="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4 border-t border-base-200"
              >
                <button
                  class="bb-btn bb-btn-danger"
                  (click)="reject()"
                  [disabled]="actionLoading || !reason.trim()"
                  aria-label="Reject review"
                >
                  <i class="material-icons-outlined">close</i>
                  {{ actionLoading ? 'Processing...' : 'Reject &amp; return to vendor' }}
                </button>
                <button
                  class="bb-btn bb-btn-primary bb-btn-lg"
                  (click)="approve()"
                  [disabled]="actionLoading"
                  aria-label="Approve review"
                >
                  @if (actionLoading) {
                    <span class="loading loading-spinner loading-sm"></span>
                  } @else {
                    <i class="material-icons-outlined">check</i>
                    <span>Approve &amp; release</span>
                  }
                </button>
              </div>
            </div>
          </div>
        }
      </div>
    }

    @if (!loading && error) {
      <div
        class="flex items-center gap-2 px-4 py-2.5 rounded-lg mb-4 text-sm bg-error/10 text-error border border-error/20"
      >
        <i class="material-icons-outlined text-base">error_outline</i>
        Failed to load review. Please try again.
      </div>
    }
  `,
  styles: [],
})
export class QaReviewDetailComponent implements OnInit {
  review: QaReviewDetail | null = null;
  caseContext: CaseContext | null = null;
  caseDocuments: CaseDocument[] = [];
  loading = true;
  error = false;
  reason = '';
  actionLoading = false;
  selectedRejectedItems = new Set<string>();

  constructor(
    private api: ApiService,
    private route: ActivatedRoute,
    private router: Router,
    private toast: ToastService,
    private pageTitleService: PageTitleService,
  ) {}

  ngOnInit(): void {
    this.pageTitleService.set('Review Detail');
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.api.get<QaReviewDetail>(`/qa/reviews/${id}`).subscribe({
      next: (data) => {
        this.review = data;
        this.selectedRejectedItems = new Set(data.rejectedItems ?? []);
        this.loadCaseContext();
        this.loading = false;
      },
      error: () => {
        this.error = true;
        this.loading = false;
      },
    });
  }

  getCaseName(caseId: QaReviewDetail['caseId']): string {
    if (!caseId) return '—';
    if (typeof caseId === 'string') return caseId;
    return (caseId as { caseNumber?: string }).caseNumber ?? '—';
  }

  private getCaseIdValue(): string {
    if (!this.review?.caseId) return '';
    if (typeof this.review.caseId === 'string') return this.review.caseId;
    return this.review.caseId._id ?? '';
  }

  loadCaseContext(): void {
    const caseId = this.getCaseIdValue();
    if (!caseId) return;
    this.api.get<CaseContext>(`/cases/${caseId}`).subscribe({
      next: (data) => {
        this.caseContext = data;
      },
      error: () => {
        this.caseContext = null;
      },
    });

    this.api.get<CaseDocument[]>('/documents', { caseId }).subscribe({
      next: (docs) => {
        this.caseDocuments = docs ?? [];
      },
      error: () => {
        this.caseDocuments = [];
      },
    });
  }

  getLeadName(leadId: QaReviewDetail['qaLeadId']): string {
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

  approve(): void {
    if (!this.review) return;
    this.actionLoading = true;
    this.api
      .patch<QaReviewDetail>(`/qa/reviews/${this.review._id}/approve`, { note: this.reason })
      .subscribe({
        next: (data) => {
          this.review = data;
          this.actionLoading = false;
          this.toast.success('Review approved successfully');
        },
        error: () => {
          this.actionLoading = false;
          this.toast.error('Failed to approve review');
        },
      });
  }

  reject(): void {
    if (!this.review || !this.reason.trim()) return;
    this.actionLoading = true;
    this.api
      .patch<QaReviewDetail>(`/qa/reviews/${this.review._id}/reject`, {
        reason: this.reason,
        rejectedItems: Array.from(this.selectedRejectedItems),
      })
      .subscribe({
        next: (data) => {
          this.review = data;
          this.actionLoading = false;
          this.toast.info('Review rejected');
        },
        error: () => {
          this.actionLoading = false;
          this.toast.error('Failed to reject review');
        },
      });
  }

  goBack(): void {
    this.router.navigate(['/qa/reviews']);
  }

  toggleChecklistItem(item: ChecklistItem): void {
    item.isPassed = !item.isPassed;
    if (item.isPassed) {
      this.selectedRejectedItems.delete(item.item);
    }
  }

  failedChecklistItems(): string[] {
    return (this.review?.checklist ?? []).filter((item) => !item.isPassed).map((item) => item.item);
  }

  toggleRejectedItem(item: string): void {
    if (this.selectedRejectedItems.has(item)) {
      this.selectedRejectedItems.delete(item);
    } else {
      this.selectedRejectedItems.add(item);
    }
  }

  saveChecklist(): void {
    if (!this.review) return;
    this.actionLoading = true;
    this.api
      .patch<QaReviewDetail>(`/qa/reviews/${this.review._id}/checklist`, {
        checklist: this.review.checklist,
      })
      .subscribe({
        next: (data) => {
          this.review = data;
          this.actionLoading = false;
          this.toast.success('Checklist updated');
        },
        error: () => {
          this.actionLoading = false;
          this.toast.error('Failed to update checklist');
        },
      });
  }
}
