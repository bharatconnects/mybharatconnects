import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { PageTitleService } from '../../../core/services/page-title.service';
import { extractApiError } from '../../../core/services/api-error';
import { STAGE_LABEL, CaseStatus } from '../../../core/models/case-status.model';
import {
  QaReviewRow,
  caseRefOf,
  reviewStatusChip,
  reviewStatusLabel,
  reviewTypeInfo,
  reviewerName,
} from '../qa-review.model';

interface ChecklistItem {
  item: string;
  isPassed: boolean;
  note?: string;
}

interface QaReviewDetail extends QaReviewRow {
  checklist: ChecklistItem[];
  approvalNote?: string;
  rejectionReason?: string;
  rejectedItems?: string[];
  rounds?: { status: string; reviewedAt?: string; note?: string; rejectedItems?: string[] }[];
}

interface ReviewDocument {
  _id: string;
  name?: string;
  originalFileName?: string;
  category?: string;
  createdAt?: string;
  verificationStatus?: string;
  cmAnnotation?: string;
  uploadedBy?: { name?: string; role?: string } | string | null;
}

interface ReviewDocuments {
  documents: ReviewDocument[];
  otherReview: ReviewDocument[];
  internal: ReviewDocument[];
}

@Component({
  selector: 'app-qa-review-detail',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="flex items-center justify-between gap-3 mb-5">
      <button class="bb-btn bb-btn-ghost bb-btn-sm gap-1" (click)="goBack()">
        <i class="material-icons-outlined">arrow_back</i>
        Back to reviews
      </button>
    </div>

    @if (loading) {
      <div class="flex justify-center py-12">
        <span class="loading loading-spinner loading-lg text-primary" aria-label="Loading review"></span>
      </div>
    } @else if (error) {
      <div
        role="alert"
        class="flex items-center gap-2 px-4 py-2.5 rounded-lg mb-4 text-sm bg-error/10 text-error border border-error/20"
      >
        <i class="material-icons-outlined text-base">error_outline</i>
        Could not load this review. Please try again.
      </div>
    } @else if (review) {
      <div class="flex flex-col gap-5 max-w-4xl">
        <!-- Header -->
        <div class="bb-card">
          <div class="bb-card-body">
            <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
              <div>
                <p class="bb-page-eyebrow mb-1">{{ info.title }}</p>
                <h2 class="bb-section-title m-0">
                  {{ caseRef.caseNumber ?? 'Case' }}@if (caseRef.title) {
                    <span class="font-normal text-base-content/70"> · {{ caseRef.title }}</span>
                  }
                </h2>
              </div>
              <span class="bb-chip" [ngClass]="chip(review.status)">{{ label(review.status) }}</span>
            </div>
            <p class="text-sm text-base-content/70 mt-3 mb-1">{{ info.scope }}</p>
            <p class="text-sm text-base-content/70 m-0">{{ info.onFail }}</p>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 text-sm">
              <div>
                <span class="bb-label">Case stage</span>
                <div>{{ caseStageLabel }}</div>
              </div>
              <div>
                <span class="bb-label">Reviewer</span>
                <div>{{ reviewer }}</div>
              </div>
              <div>
                <span class="bb-label">Decided</span>
                <div>{{ review.reviewedAt ? (review.reviewedAt | date: 'medium') : '—' }}</div>
              </div>
            </div>
            @if (!caseInQa && isOpen) {
              <div
                class="flex items-start gap-2 px-4 py-2.5 rounded-lg mt-4 text-sm bg-warning/10 text-warning border border-warning/30"
                role="status"
              >
                <i class="material-icons-outlined text-base mt-0.5">info</i>
                <p class="m-0">
                  This case is no longer in QA review (it is at {{ caseStageLabel }}), so this check cannot be
                  decided right now. It reopens if the case comes back to QA.
                </p>
              </div>
            }
          </div>
        </div>

        <!-- Documents -->
        <div class="bb-card">
          <div class="bb-card-body">
            <h3 class="bb-section-title">{{ docsTitle }}</h3>
            @if (docsLoading) {
              <p class="text-sm text-base-content/60 m-0">Loading documents…</p>
            } @else if (docs.documents.length === 0) {
              <p class="text-sm text-base-content/60 m-0">
                {{ info.type === 'CLIENT_DOCUMENTS' ? 'The client has not uploaded any documents.' : 'The vendor has not uploaded any documents.' }}
                You can still complete the checklist below if nothing is needed for this case.
              </p>
            } @else {
              <ul class="divide-y divide-base-300 list-none p-0 m-0">
                @for (d of docs.documents; track d._id) {
                  <li class="py-3">
                    <div class="flex flex-wrap items-center justify-between gap-2">
                      <div class="min-w-0">
                        <div class="text-sm font-medium break-all">{{ d.name || d.originalFileName }}</div>
                        <div class="text-xs text-base-content/60">
                          {{ d.category | titlecase }} · {{ uploaderName(d) }} ·
                          {{ d.createdAt | date: 'mediumDate' }}
                        </div>
                      </div>
                      <div class="flex flex-wrap items-center gap-2">
                        <span class="bb-chip" [ngClass]="docChip(d.verificationStatus)">{{
                          docLabel(d.verificationStatus)
                        }}</span>
                        <button class="bb-btn bb-btn-ghost bb-btn-sm" (click)="download(d)">
                          <i class="material-icons-outlined text-base">download</i> Open
                        </button>
                        @if (isOpen && caseInQa) {
                          <button
                            class="bb-btn bb-btn-outline bb-btn-sm"
                            (click)="verifyDoc(d)"
                            [disabled]="docBusyId === d._id || d.verificationStatus === 'VERIFIED'"
                          >
                            Mark checked
                          </button>
                          <button
                            class="bb-btn bb-btn-ghost bb-btn-sm"
                            (click)="rejectingDocId = rejectingDocId === d._id ? null : d._id"
                          >
                            Not usable
                          </button>
                        }
                      </div>
                    </div>
                    @if (d.cmAnnotation && d.verificationStatus === 'REJECTED_ILLEGIBLE') {
                      <p class="text-xs text-error mt-1 mb-0">Reason: {{ d.cmAnnotation }}</p>
                    }
                    @if (rejectingDocId === d._id) {
                      <div class="flex flex-col sm:flex-row gap-2 mt-2">
                        <input
                          class="bb-input flex-1"
                          maxlength="500"
                          placeholder="Why can this file not be used?"
                          [attr.aria-label]="'Reason for ' + (d.name || d.originalFileName)"
                          [(ngModel)]="docRejectReason"
                        />
                        <button
                          class="bb-btn bb-btn-danger bb-btn-sm"
                          (click)="rejectDoc(d)"
                          [disabled]="docBusyId === d._id || !docRejectReason.trim()"
                        >
                          Mark not usable
                        </button>
                      </div>
                    }
                  </li>
                }
              </ul>
            }

            @if (docs.otherReview.length || docs.internal.length) {
              <details class="mt-4 text-sm">
                <summary class="cursor-pointer text-base-content/70">
                  Other documents on this case ({{ docs.otherReview.length + docs.internal.length }})
                </summary>
                <p class="text-xs text-base-content/60 mt-2">
                  These belong to the
                  {{ info.type === 'CLIENT_DOCUMENTS' ? 'vendor deliverables check' : 'client documents check' }}
                  or were added by staff, so they are not part of this one.
                </p>
                <ul class="list-none p-0 m-0 text-base-content/70">
                  @for (d of docs.otherReview; track d._id) {
                    <li>{{ d.name || d.originalFileName }} · {{ uploaderName(d) }}</li>
                  }
                  @for (d of docs.internal; track d._id) {
                    <li>{{ d.name || d.originalFileName }} · staff</li>
                  }
                </ul>
              </details>
            }
          </div>
        </div>

        <!-- Checklist -->
        <div class="bb-card">
          <div class="bb-card-body">
            <h3 class="bb-section-title">Checklist</h3>
            <p class="text-sm text-base-content/60 mt-0 mb-2">
              Tick each point once you have checked it. If a point does not apply to this case, tick it and say so
              in its note. Every point must be ticked to approve.
            </p>
            <ul class="divide-y divide-base-300 list-none p-0 m-0">
              @for (item of review.checklist; track item.item) {
                <li class="py-3">
                  <label class="flex items-start gap-3" [class.cursor-pointer]="canEdit">
                    <input
                      type="checkbox"
                      class="checkbox checkbox-sm mt-0.5"
                      [(ngModel)]="item.isPassed"
                      [disabled]="!canEdit"
                    />
                    <span class="flex-1 text-sm">{{ item.item }}</span>
                  </label>
                  @if (canEdit || item.note) {
                    <textarea
                      class="bb-textarea mt-2"
                      rows="2"
                      maxlength="1000"
                      [(ngModel)]="item.note"
                      [disabled]="!canEdit"
                      placeholder="Note (optional)"
                      [attr.aria-label]="'Note for: ' + item.item"
                    ></textarea>
                  }
                </li>
              }
            </ul>
            @if (canEdit) {
              <div class="flex items-center justify-between gap-3 mt-3">
                <span class="text-xs text-base-content/60">{{ passedCount }} of {{ review.checklist.length }} ticked</span>
                <button class="bb-btn bb-btn-outline" (click)="saveChecklist()" [disabled]="actionLoading">
                  Save progress
                </button>
              </div>
            }
          </div>
        </div>

        <!-- Decision -->
        @if (canEdit) {
          <div class="bb-card">
            <div class="bb-card-body">
              <header>
                <p class="bb-page-eyebrow mb-1">YOUR DECISION</p>
                <h3 class="bb-section-title m-0">Approve this check or ask for changes</h3>
                <p class="bb-section-subtitle mt-1">
                  Approving this check does not move the case on by itself: the case goes to the client once
                  <strong>both</strong> the client documents and the vendor deliverables are approved.
                  {{ info.onFail }}
                </p>
              </header>

              <div>
                <label class="bb-label" for="qa-review-reason">
                  Note
                  <span class="font-normal text-base-content/60 normal-case tracking-normal"
                    >(required when asking for changes)</span
                  >
                </label>
                <textarea
                  class="bb-textarea min-h-24"
                  id="qa-review-reason"
                  [(ngModel)]="reason"
                  maxlength="2000"
                  placeholder="What did you check? What needs to change?"
                ></textarea>
              </div>

              @if (failedChecklistItems().length) {
                <div>
                  <label class="bb-label">Which points need changes?</label>
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
              }

              @if (decisionHint; as hint) {
                <p class="text-sm text-warning m-0" role="status">{{ hint }}</p>
              }

              <div class="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4 border-t border-base-200">
                <button
                  class="bb-btn bb-btn-danger"
                  (click)="reject()"
                  [disabled]="actionLoading || reason.trim().length < 5"
                >
                  <i class="material-icons-outlined">undo</i>
                  {{ actionLoading ? 'Working…' : 'Ask for changes' }}
                </button>
                <button
                  class="bb-btn bb-btn-primary bb-btn-lg"
                  (click)="approve()"
                  [disabled]="actionLoading || passedCount < review.checklist.length"
                >
                  <i class="material-icons-outlined">check</i>
                  <span>{{ actionLoading ? 'Working…' : 'Approve this check' }}</span>
                </button>
              </div>
            </div>
          </div>
        } @else if (review.status === 'APPROVED' || review.status === 'REJECTED') {
          <div class="bb-card">
            <div class="bb-card-body">
              <h3 class="bb-section-title">Outcome</h3>
              <p class="text-sm m-0">
                <span class="bb-chip" [ngClass]="chip(review.status)">{{ label(review.status) }}</span>
                {{ review.reviewedAt | date: 'medium' }}
              </p>
              @if (review.approvalNote) {
                <p class="text-sm mt-2 mb-0">{{ review.approvalNote }}</p>
              }
              @if (review.rejectionReason) {
                <p class="text-sm mt-2 mb-0">{{ review.rejectionReason }}</p>
                @if (review.rejectedItems?.length) {
                  <ul class="text-sm mt-2 mb-0">
                    @for (i of review.rejectedItems; track i) {
                      <li>{{ i }}</li>
                    }
                  </ul>
                }
              }
            </div>
          </div>
        }

        @if (review.rounds?.length) {
          <div class="bb-card">
            <div class="bb-card-body">
              <h3 class="bb-section-title">Earlier rounds</h3>
              <ul class="list-none p-0 m-0 text-sm divide-y divide-base-300">
                @for (r of review.rounds; track $index) {
                  <li class="py-2">
                    <span class="bb-chip" [ngClass]="chip(r.status)">{{ label(r.status) }}</span>
                    {{ r.reviewedAt | date: 'medium' }}
                    @if (r.note) {
                      <div class="text-base-content/70">{{ r.note }}</div>
                    }
                  </li>
                }
              </ul>
            </div>
          </div>
        }
      </div>
    }
  `,
})
export class QaReviewDetailComponent implements OnInit {
  review: QaReviewDetail | null = null;
  docs: ReviewDocuments = { documents: [], otherReview: [], internal: [] };
  docsLoading = true;
  loading = true;
  error = false;
  reason = '';
  actionLoading = false;
  selectedRejectedItems = new Set<string>();
  rejectingDocId: string | null = null;
  docRejectReason = '';
  docBusyId: string | null = null;

  readonly label = reviewStatusLabel;
  readonly chip = reviewStatusChip;

  constructor(
    private api: ApiService,
    private route: ActivatedRoute,
    private router: Router,
    private toast: ToastService,
    private pageTitleService: PageTitleService,
  ) {}

  get info() {
    return reviewTypeInfo(this.review?.reviewType);
  }

  get caseRef() {
    return caseRefOf(this.review?.caseId);
  }

  get reviewer(): string {
    return reviewerName(this.review?.qaLeadId);
  }

  get caseStageLabel(): string {
    const status = this.caseRef.status as CaseStatus | undefined;
    return (status && STAGE_LABEL[status]) || status || '—';
  }

  get caseInQa(): boolean {
    return this.caseRef.status === CaseStatus.QA_REVIEW;
  }

  get isOpen(): boolean {
    return this.review?.status === 'PENDING' || this.review?.status === 'IN_REVIEW';
  }

  /** The review can be worked on only while it is open and the case is still in QA. */
  get canEdit(): boolean {
    return this.isOpen && this.caseInQa;
  }

  get docsTitle(): string {
    return this.info.type === 'CLIENT_DOCUMENTS' ? 'Documents from the client' : 'Documents from the vendor';
  }

  get passedCount(): number {
    return (this.review?.checklist ?? []).filter((c) => c.isPassed).length;
  }

  /** Why the approve button is unavailable, in plain words. */
  get decisionHint(): string | null {
    const total = this.review?.checklist.length ?? 0;
    if (this.passedCount < total) {
      return `Tick the remaining ${total - this.passedCount} point${total - this.passedCount === 1 ? '' : 's'} to approve, or ask for changes instead.`;
    }
    return null;
  }

  ngOnInit(): void {
    this.pageTitleService.set('Review');
    this.load();
  }

  private load(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.api.get<QaReviewDetail>(`/qa/reviews/${id}`).subscribe({
      next: (data) => {
        this.review = data;
        this.selectedRejectedItems = new Set(data.rejectedItems ?? []);
        this.pageTitleService.set(`${reviewTypeInfo(data.reviewType).title}`);
        this.loading = false;
        this.loadDocuments(id);
      },
      error: () => {
        this.error = true;
        this.loading = false;
      },
    });
  }

  private loadDocuments(id: string): void {
    this.docsLoading = true;
    this.api.get<ReviewDocuments>(`/qa/reviews/${id}/documents`).subscribe({
      next: (data) => {
        this.docs = {
          documents: data?.documents ?? [],
          otherReview: data?.otherReview ?? [],
          internal: data?.internal ?? [],
        };
        this.docsLoading = false;
      },
      error: () => {
        this.docs = { documents: [], otherReview: [], internal: [] };
        this.docsLoading = false;
      },
    });
  }

  uploaderName(d: ReviewDocument): string {
    const u = d.uploadedBy;
    if (!u || typeof u === 'string') return 'Unknown';
    return (u.name ?? '').trim() || 'Unknown';
  }

  docLabel(status?: string): string {
    switch (status) {
      case 'VERIFIED':
        return 'Checked';
      case 'REJECTED_ILLEGIBLE':
        return 'Not usable';
      default:
        return 'Not checked yet';
    }
  }

  docChip(status?: string): string {
    switch (status) {
      case 'VERIFIED':
        return 'bb-chip-success';
      case 'REJECTED_ILLEGIBLE':
        return 'bb-chip-danger';
      default:
        return 'bb-chip-neutral';
    }
  }

  download(d: ReviewDocument): void {
    this.api.get<{ downloadUrl: string }>(`/documents/${d._id}/download`).subscribe({
      next: (res) => window.open(res.downloadUrl, '_blank', 'noopener'),
      error: (err) => this.toast.error(extractApiError(err, 'Could not open this document').message),
    });
  }

  verifyDoc(d: ReviewDocument): void {
    if (this.docBusyId) return;
    this.docBusyId = d._id;
    this.api.patch<ReviewDocument>(`/documents/${d._id}/verify`, {}).subscribe({
      next: (updated) => {
        this.docBusyId = null;
        d.verificationStatus = updated.verificationStatus ?? 'VERIFIED';
        this.toast.success('Marked as checked');
      },
      error: (err) => {
        this.docBusyId = null;
        this.toast.error(extractApiError(err, 'Could not update this document').message);
      },
    });
  }

  rejectDoc(d: ReviewDocument): void {
    const reason = this.docRejectReason.trim();
    if (this.docBusyId || !reason) return;
    this.docBusyId = d._id;
    this.api.patch<ReviewDocument>(`/documents/${d._id}/reject`, { reason }).subscribe({
      next: (updated) => {
        this.docBusyId = null;
        d.verificationStatus = updated.verificationStatus ?? 'REJECTED_ILLEGIBLE';
        d.cmAnnotation = reason;
        this.rejectingDocId = null;
        this.docRejectReason = '';
        this.toast.info('Marked as not usable');
      },
      error: (err) => {
        this.docBusyId = null;
        this.toast.error(extractApiError(err, 'Could not update this document').message);
      },
    });
  }

  failedChecklistItems(): string[] {
    return (this.review?.checklist ?? []).filter((item) => !item.isPassed).map((item) => item.item);
  }

  toggleRejectedItem(item: string): void {
    if (this.selectedRejectedItems.has(item)) this.selectedRejectedItems.delete(item);
    else this.selectedRejectedItems.add(item);
  }

  private replaceReview(data: QaReviewDetail): void {
    this.review = data;
    this.selectedRejectedItems = new Set(data.rejectedItems ?? []);
  }

  saveChecklist(): void {
    if (!this.review || this.actionLoading) return;
    this.actionLoading = true;
    this.api
      .patch<QaReviewDetail>(`/qa/reviews/${this.review._id}/checklist`, {
        checklist: this.review.checklist.map((c) => ({ item: c.item, isPassed: !!c.isPassed, note: c.note ?? '' })),
      })
      .subscribe({
        next: (data) => {
          this.replaceReview(data);
          this.actionLoading = false;
          this.toast.success('Progress saved');
        },
        error: (err) => {
          this.actionLoading = false;
          this.toast.error(extractApiError(err, 'Could not save the checklist').message);
        },
      });
  }

  approve(): void {
    if (!this.review || this.actionLoading) return;
    this.actionLoading = true;
    const id = this.review._id;
    // Save the ticks first so what is on screen is what gets approved.
    this.api
      .patch<QaReviewDetail>(`/qa/reviews/${id}/checklist`, {
        checklist: this.review.checklist.map((c) => ({ item: c.item, isPassed: !!c.isPassed, note: c.note ?? '' })),
      })
      .subscribe({
        next: () => {
          this.api
            .patch<QaReviewDetail>(`/qa/reviews/${id}/approve`, { note: this.reason.trim() || undefined })
            .subscribe({
              next: (data) => {
                this.replaceReview(data);
                this.actionLoading = false;
                this.toast.success('Check approved');
              },
              error: (err) => {
                this.actionLoading = false;
                this.toast.error(extractApiError(err, 'Could not approve this check').message);
              },
            });
        },
        error: (err) => {
          this.actionLoading = false;
          this.toast.error(extractApiError(err, 'Could not save the checklist').message);
        },
      });
  }

  reject(): void {
    if (!this.review || this.actionLoading || this.reason.trim().length < 5) return;
    this.actionLoading = true;
    this.api
      .patch<QaReviewDetail>(`/qa/reviews/${this.review._id}/reject`, {
        reason: this.reason.trim(),
        rejectedItems: Array.from(this.selectedRejectedItems),
      })
      .subscribe({
        next: (data) => {
          this.replaceReview(data);
          this.actionLoading = false;
          this.toast.info('Changes requested. The case has been sent back.');
        },
        error: (err) => {
          this.actionLoading = false;
          this.toast.error(extractApiError(err, 'Could not send this back').message);
        },
      });
  }

  goBack(): void {
    this.router.navigate(['/qa/reviews']);
  }
}
