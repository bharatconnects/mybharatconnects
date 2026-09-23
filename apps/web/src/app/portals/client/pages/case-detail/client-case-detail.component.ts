import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormsModule } from '@angular/forms';
import type { Stripe, StripeElements } from '@stripe/stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { environment } from '../../../../../environments/environment';
import { ClientCasesService } from '../../services/client-cases.service';
import { ApiService } from '../../../../core/services/api.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { ToastService } from '../../../../core/services/toast.service';
import { DocumentsService } from '../../../../core/services/documents.service';
import { extractApiError } from '../../../../core/services/api-error';
import { Case } from '../../models/case.model';
import { CaseStatus, STAGE_LABEL } from '../../../../core/models/case-status.model';
import { PageTitleService } from '../../../../core/services/page-title.service';
import { CaseStageTimelineComponent } from '../../../../shared/components/case-stage-timeline/case-stage-timeline.component';
import { BbSelectComponent } from '../../../../shared/components/bb-select/bb-select.component';
import { PaymentsService, Payment } from '../../../../core/services/payments.service';
import {
  ALLOWED_DOCUMENT_FILE_ACCEPT,
  isAllowedDocumentFile,
  isDocumentFileTooLarge,
} from '../../../../shared/utils/document-file-types.util';

interface CaseInvoice {
  _id: string;
  invoiceNumber: string;
  totalAmount: number;
  currency: string;
  status: 'DRAFT' | 'ISSUED' | 'PAID' | 'CANCELLED' | string;
  attachmentDocumentId?: string;
  externalReceiptUrl?: string;
  issuedAt?: string;
  paidAt?: string;
  createdAt: string;
}

interface Slot {
  startAt: string;
  endAt: string;
}

interface Booking {
  _id: string;
  startAt: string;
  endAt: string;
  status: 'SCHEDULED' | 'CANCELLED' | 'COMPLETED';
}

type QuoteStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'NEGOTIATING' | 'EXPIRED';
type QuoteResponse = 'ACCEPTED' | 'REJECTED' | 'NEGOTIATING';
type MilestoneStatus = 'PENDING' | 'VENDOR_MARKED_DONE' | 'CLIENT_APPROVED' | 'PAID';
interface QuoteItem {
  description: string;
  quantity: number;
  unitPrice: number;
}
interface QuoteMilestone {
  _id?: string;
  title: string;
  sequence: number;
  amountValue: number;
  computedAmount?: number;
  status: MilestoneStatus;
}
interface Quote {
  _id: string;
  // A case can also have INVITED/DECLINED quotes mid-RFP — those are internal
  // vendor-sourcing states and are filtered out before reaching the client UI.
  status: QuoteStatus | 'INVITED' | 'DECLINED';
  // The vendor's own cost fields are stripped from client-facing API
  // responses — kept here only as an optional fallback for quotes that
  // predate the client-quote feature (never had clientItems populated).
  totalAmount?: number;
  currency: string;
  items?: QuoteItem[];
  clientItems?: QuoteItem[];
  clientTotalAmount?: number;
  validUntil?: string;
  revisionNumber?: number;
  quoteType?: 'FIXED' | 'MILESTONE';
  previousClientQuote?: { items: QuoteItem[]; totalAmount: number; capturedAt: string };
  clientResponse?: string;
  cmNegotiationReply?: string;
  milestones?: QuoteMilestone[];
  // Set by the backend: something changed on this quote since the client last opened it.
  hasUpdate?: boolean;
  // Set once the client rejects this quote — the CM handles it from here
  // (renegotiate with the vendor, or formally reject), so the action buttons
  // below hide until then.
  clientRejectedAt?: string;
  clientRejectionReason?: string;
}

const MILESTONE_STATUS_LABEL: Record<MilestoneStatus, string> = {
  PENDING: 'Pending',
  VENDOR_MARKED_DONE: 'Marked complete — needs your confirmation',
  CLIENT_APPROVED: 'Confirmed — payment pending',
  PAID: 'Paid',
};

const MILESTONE_CHIP: Record<MilestoneStatus, string> = {
  PENDING: 'bb-chip-neutral',
  VENDOR_MARKED_DONE: 'bb-chip-warning',
  CLIENT_APPROVED: 'bb-chip-info',
  PAID: 'bb-chip-success',
};

const QUOTE_STATUS_LABEL: Record<QuoteStatus, string> = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
  NEGOTIATING: 'Negotiating',
  EXPIRED: 'Expired',
};

const QUOTE_BADGE: Record<QuoteStatus, string> = {
  DRAFT: 'bb-chip-neutral',
  SENT: 'bb-chip-info',
  ACCEPTED: 'bb-chip-success',
  REJECTED: 'bb-chip-danger',
  NEGOTIATING: 'bb-chip-warning',
  EXPIRED: 'bb-chip-neutral',
};

interface DocumentRecord {
  _id: string;
  name?: string;
  originalFileName?: string;
  category?: string;
  isVerified?: boolean;
  uploadedAt?: string;
  createdAt?: string;
}

const PRIORITY_BADGE: Record<string, string> = {
  HIGH: 'bb-chip-danger',
  MEDIUM: 'bb-chip-warning',
  LOW: 'bb-chip-success',
};

@Component({
  selector: 'app-client-case-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, CaseStageTimelineComponent, BbSelectComponent],
  providers: [FormBuilder],
  template: `
    <div class="max-w-5xl">
      <button
        class="bb-btn bb-btn-ghost bb-btn-sm mb-4"
        (click)="goBack()"
        aria-label="Back to cases"
      >
        <i class="material-icons-outlined">arrow_back</i>
        <span>Back to Cases</span>
      </button>

      @if (loading) {
        <div class="flex justify-center py-12">
          <span class="loading loading-spinner loading-lg text-primary"></span>
        </div>
      } @else if (caseData) {
        <div class="flex items-center justify-between gap-3 mb-5">
          <p class="text-sm text-base-content/60 font-mono">{{ caseData.caseNumber }}</p>
          <div class="flex flex-wrap gap-2 shrink-0">
            <span class="bb-chip bb-chip-neutral">{{ getStageLabel(caseData.status) }}</span>
            <span class="bb-chip" [class]="getPriorityBadge(caseData.priority)"
              >{{ caseData.priority }} Priority</span
            >
          </div>
        </div>

        <div class="bb-card mb-6">
          <div class="bb-card-body">
            <h3 class="bb-section-title">Case Progress</h3>
            <app-case-stage-timeline
              [currentStage]="caseData.status"
              [stageHistory]="caseData.stageHistory ?? []"
            ></app-case-stage-timeline>
          </div>
        </div>

        @if (caseData.propertyDetails) {
          <div class="bb-card mb-6">
            <div class="bb-card-body">
              <h3 class="bb-section-title">Property Details</h3>
              <ul class="divide-y divide-base-300 mt-2">
                @if (caseData.propertyDetails.address) {
                  <li class="py-2">
                    <div class="text-xs font-semibold text-base-content/60">Address</div>
                    <div class="text-sm">{{ caseData.propertyDetails.address }}</div>
                  </li>
                }
                @if (caseData.propertyDetails.city) {
                  <li class="py-2">
                    <div class="text-xs font-semibold text-base-content/60">City</div>
                    <div class="text-sm">{{ caseData.propertyDetails.city }}</div>
                  </li>
                }
                @if (caseData.propertyDetails.type) {
                  <li class="py-2">
                    <div class="text-xs font-semibold text-base-content/60">Type</div>
                    <div class="text-sm">{{ caseData.propertyDetails.type }}</div>
                  </li>
                }
              </ul>
            </div>
          </div>
        }

        <div class="bb-card mb-6">
          <div class="bb-card-body">
            <h3 class="bb-section-title">Case Manager</h3>
            <p class="text-sm mt-1">
              {{ caseData.caseManagerId?.name }}
            </p>
          </div>
        </div>

        @if (caseData.status === 'CLIENT_REVIEW') {
          <div class="bb-card mb-6">
            <div class="bb-card-body">
              <h3 class="bb-section-title">Confirm Completion</h3>
              <p class="text-sm text-base-content/70 mb-3">
                Your case manager has marked this case as complete. Please confirm once you're
                satisfied with the work so the case can be closed.
              </p>
              <button
                class="bb-btn bb-btn-primary"
                (click)="confirmClose()"
                [disabled]="confirmingClose"
              >
                {{ confirmingClose ? 'Confirming...' : 'Confirm Case Complete' }}
              </button>
            </div>
          </div>
        }

        @if (canBookDiscovery()) {
          <div class="bb-card mb-6">
            <div class="bb-card-body">
              <h3 class="bb-section-title">Book Discovery Call</h3>

              @if (loadingBooking) {
                <p class="text-sm text-base-content/60 py-3">Checking your booking...</p>
              } @else if (myBooking && !rescheduling) {
                <div class="bb-booked-card">
                  <div class="bb-booked-icon">
                    <i class="material-icons-outlined">event_available</i>
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="font-semibold text-base-content m-0">
                      {{ myBooking.startAt | date: 'EEEE, MMM d' }}
                    </p>
                    <p class="text-sm text-base-content/60 m-0">
                      {{ myBooking.startAt | date: 'shortTime' }} -
                      {{ myBooking.endAt | date: 'shortTime' }}
                    </p>
                  </div>
                  <div class="flex gap-2 shrink-0">
                    <button
                      class="bb-btn bb-btn-outline bb-btn-sm"
                      (click)="startReschedule()"
                      [disabled]="cancellingBooking"
                    >
                      Change
                    </button>
                    <button
                      class="bb-btn bb-btn-danger bb-btn-sm"
                      (click)="cancelBooking()"
                      [disabled]="cancellingBooking"
                    >
                      {{ cancellingBooking ? 'Cancelling...' : 'Cancel' }}
                    </button>
                  </div>
                </div>
              } @else {
                <p class="bb-section-subtitle">
                  Pick an open slot with your case manager in the next 14 days.
                </p>
                @if (rescheduling) {
                  <button class="bb-btn bb-btn-ghost bb-btn-sm mb-2" (click)="cancelReschedule()">
                    <i class="material-icons-outlined text-base">arrow_back</i>
                    Back
                  </button>
                }
                @if (loadingSlots) {
                  <p class="text-sm text-base-content/60 py-3">Loading available slots...</p>
                } @else if (slotsComingSoon) {
                  <div
                    class="flex items-center gap-2 px-4 py-2.5 rounded-lg mt-2 text-sm bg-base-200 text-base-content border border-base-300"
                  >
                    <i class="material-icons-outlined text-base">info</i>
                    <span>Scheduling coming soon.</span>
                  </div>
                } @else if (slots.length === 0) {
                  <p class="text-sm text-base-content/60 py-3">No open slots in the next 14 days.</p>
                } @else {
                  <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mt-3">
                    @for (s of slots; track s.startAt; let i = $index) {
                      <button
                        class="bb-btn bb-btn-outline whitespace-normal h-auto py-2 bb-slot-btn"
                        [style.animation-delay.ms]="i * 25"
                        (click)="bookSlot(s)"
                        [disabled]="booking"
                      >
                        <div class="flex flex-col items-center text-xs">
                          <span class="font-medium">{{ s.startAt | date: 'mediumDate' }}</span>
                          <span
                            >{{ s.startAt | date: 'shortTime' }} -
                            {{ s.endAt | date: 'shortTime' }}</span
                          >
                        </div>
                      </button>
                    }
                  </div>
                }
              }
            </div>
          </div>
        }

        <div class="bb-card mb-6">
          <div class="bb-card-body">
            <h3 class="bb-section-title flex items-center gap-2">
              Quotes
              @if (anyQuoteHasUpdate()) {
                <span class="bb-update-dot" title="New updates on one or more quotes"></span>
              }
            </h3>
            @if (loadingQuotes) {
              <p class="text-center text-base-content/60 py-3">Loading quotes...</p>
            } @else if (visibleQuotes.length === 0) {
              <p class="text-center text-base-content/60 py-3">No quotes yet for this case.</p>
            } @else {
              <div class="flex flex-col gap-4 mt-2">
                @for (q of visibleQuotes; track q._id) {
                  <div
                    class="rounded-xl border border-base-300 overflow-hidden bg-base-100"
                    (click)="markQuoteSeen(q)"
                  >
                    <!-- Header strip -->
                    <div
                      class="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-base-300"
                      style="background: var(--navy-50)"
                    >
                      <div class="flex flex-wrap items-center gap-2 min-w-0">
                        @if (q.hasUpdate) {
                          <span class="bb-update-dot" title="New update on this quote"></span>
                        }
                        <span class="bb-chip" [class]="getQuoteBadge(q.status)">{{
                          quoteStatusLabel(q.status)
                        }}</span>
                        @if (q.revisionNumber && q.revisionNumber > 1) {
                          <span class="bb-chip bb-chip-neutral">rev {{ q.revisionNumber }}</span>
                        }
                        @if (q.validUntil) {
                          <span class="text-xs text-base-content/60"
                            >valid until {{ q.validUntil | date: 'mediumDate' }}</span
                          >
                        }
                      </div>
                      <div class="text-right shrink-0">
                        <div class="text-[0.65rem] font-semibold uppercase tracking-wide text-base-content/50">
                          Total
                        </div>
                        <strong class="text-lg leading-tight text-base-content"
                          >{{ q.currency }} {{ quoteTotal(q) | number: '1.0-2' }}</strong
                        >
                      </div>
                    </div>

                    <div class="px-4 py-3">
                      @if (q.clientRejectedAt) {
                        <div
                          class="flex items-start gap-2 px-3 py-2.5 rounded-md mb-3 text-sm"
                          style="background: rgba(220, 38, 38, 0.08); border: 1px solid rgba(220, 38, 38, 0.25)"
                        >
                          <i class="material-icons-outlined text-base text-error shrink-0">report</i>
                          <div class="min-w-0">
                            <p class="font-semibold text-error m-0">You rejected this quote</p>
                            <p class="text-xs text-base-content/60 m-0 mt-1">
                              Your case manager has been notified and will follow up with an updated offer.
                            </p>
                          </div>
                        </div>
                      }
                      @if (q.previousClientQuote) {
                        <p class="text-xs text-base-content/70 mb-2">
                          Previous quote was {{ q.currency }}
                          {{ q.previousClientQuote.totalAmount | number: '1.0-2' }}
                        </p>
                      }
                      @if (quoteItems(q).length > 0) {
                        <div class="bb-table-wrap">
                          <div class="bb-table-scroll">
                            <table class="bb-table bb-table--compact">
                              <thead>
                                <tr>
                                  <th>Item</th>
                                  <th class="text-right">Qty</th>
                                  <th class="text-right">Unit price</th>
                                  <th class="text-right">Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                @for (it of quoteItems(q); track $index) {
                                  <tr>
                                    <td>{{ it.description }}</td>
                                    <td class="text-right">{{ it.quantity }}</td>
                                    <td class="text-right">{{ it.unitPrice | number: '1.0-2' }}</td>
                                    <td class="text-right font-medium">
                                      {{ it.quantity * it.unitPrice | number: '1.0-2' }}
                                    </td>
                                  </tr>
                                }
                                <tr class="bb-table-total-row">
                                  <td colspan="3" class="text-right">Total</td>
                                  <td class="text-right">{{ q.currency }} {{ quoteTotal(q) | number: '1.0-2' }}</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      }

                      @if (q.status === 'ACCEPTED' && q.milestones && q.milestones.length > 0) {
                        <div class="mt-3 pt-3 border-t border-base-300 flex flex-col gap-2">
                          <h4 class="text-xs font-semibold uppercase tracking-wide text-base-content/50 mb-1">
                            {{ q.quoteType === 'MILESTONE' ? 'Milestones' : 'Completion' }}
                          </h4>
                          @for (m of q.milestones; track m._id) {
                            <div class="flex flex-wrap items-center gap-2 text-sm">
                              <span class="font-medium">{{
                                q.quoteType === 'MILESTONE' ? m.sequence + '. ' + m.title : 'Payment status'
                              }}</span>
                              <span class="text-base-content/60"
                                >{{ q.currency }} {{ (m.computedAmount ?? m.amountValue) | number: '1.0-2' }}</span
                              >
                              <span class="bb-chip" [ngClass]="milestoneChipClass(m.status)">{{
                                milestoneStatusLabel(m.status)
                              }}</span>
                              @if (m.status === 'VENDOR_MARKED_DONE') {
                                <button
                                  class="bb-btn bb-btn-primary bb-btn-sm"
                                  (click)="approveMilestone(q, m)"
                                  [disabled]="milestoneBusyId === m._id"
                                >
                                  {{ milestoneBusyId === m._id ? 'Confirming…' : 'Confirm Complete' }}
                                </button>
                              }
                            </div>
                          }
                        </div>
                      }

                      @if (q.status === 'NEGOTIATING' && negotiatingQuoteId !== q._id) {
                        <div class="mt-3 flex items-start gap-2 px-3 py-2 rounded-lg bg-warning/10 border border-warning/20">
                          <i class="material-icons-outlined text-base text-warning">forum</i>
                          <div class="min-w-0 flex-1">
                            <div
                              class="text-xs font-semibold text-warning uppercase tracking-wide flex items-center justify-between gap-2"
                            >
                              Your negotiation note
                              <button
                                type="button"
                                class="bb-btn bb-btn-ghost bb-btn-sm"
                                (click)="toggleNegotiate(q._id, q.clientResponse)"
                              >
                                <i class="material-icons-outlined text-base">edit</i>
                                Edit
                              </button>
                            </div>
                            <p class="text-sm text-base-content mt-0.5 m-0">{{ q.clientResponse }}</p>
                          </div>
                        </div>
                        @if (q.cmNegotiationReply) {
                          <div class="mt-2 flex items-start gap-2 px-3 py-2 rounded-lg bg-base-200 border border-base-300">
                            <i class="material-icons-outlined text-base text-base-content/60">support_agent</i>
                            <div class="min-w-0">
                              <div class="text-xs font-semibold text-base-content/60 uppercase tracking-wide">
                                Case manager's reply
                              </div>
                              <p class="text-sm text-base-content mt-0.5 m-0">{{ q.cmNegotiationReply }}</p>
                            </div>
                          </div>
                        }
                      }

                      @if (!q.clientRejectedAt && (q.status === 'SENT' || q.status === 'NEGOTIATING')) {
                        <div class="flex flex-wrap justify-end gap-2 mt-3 pt-3 border-t border-base-300">
                          <button
                            class="bb-btn bb-btn-danger bb-btn-sm"
                            (click)="toggleReject(q._id)"
                            [disabled]="respondingQuoteId === q._id"
                          >
                            Reject
                          </button>
                          <button
                            class="bb-btn bb-btn-outline bb-btn-sm"
                            (click)="toggleNegotiate(q._id, q.clientResponse)"
                            [disabled]="respondingQuoteId === q._id"
                          >
                            Negotiate
                          </button>
                          <button
                            class="bb-btn bb-btn-primary bb-btn-sm"
                            (click)="respondQuote(q, 'ACCEPTED')"
                            [disabled]="respondingQuoteId === q._id"
                          >
                            Accept
                          </button>
                        </div>
                        @if (rejectingQuoteId === q._id) {
                          <div class="mt-3">
                            <label class="bb-label" for="reject-reason-{{ q._id }}"
                              >Reason for rejection</label
                            >
                            <textarea
                              id="reject-reason-{{ q._id }}"
                              class="bb-textarea"
                              [(ngModel)]="rejectReason"
                              rows="2"
                              placeholder="Tell the team why this quote doesn't work..."
                            ></textarea>
                            <div class="flex flex-wrap gap-2 justify-end mt-2">
                              <button class="bb-btn bb-btn-ghost bb-btn-sm" (click)="cancelReject()">
                                Cancel
                              </button>
                              <button
                                class="bb-btn bb-btn-danger bb-btn-sm"
                                (click)="rejectQuote(q)"
                                [disabled]="!rejectReason.trim() || respondingQuoteId === q._id"
                              >
                                Send rejection
                              </button>
                            </div>
                          </div>
                        }
                      }

                      @if (negotiatingQuoteId === q._id) {
                        <div class="mt-3">
                          <label class="bb-label" for="negotiate-comment-{{ q._id }}"
                            >Negotiation comment</label
                          >
                          <textarea
                            id="negotiate-comment-{{ q._id }}"
                            class="bb-textarea"
                            [(ngModel)]="negotiateComment"
                            rows="2"
                            placeholder="Explain what you'd like changed..."
                          ></textarea>
                          <div class="flex flex-wrap gap-2 justify-end mt-2">
                            <button
                              class="bb-btn bb-btn-ghost bb-btn-sm"
                              (click)="cancelNegotiate()"
                            >
                              Cancel
                            </button>
                            <button
                              class="bb-btn bb-btn-primary bb-btn-sm"
                              (click)="respondQuote(q, 'NEGOTIATING', negotiateComment)"
                              [disabled]="!negotiateComment.trim() || respondingQuoteId === q._id"
                            >
                              {{ q.status === 'NEGOTIATING' ? 'Update' : 'Send response' }}
                            </button>
                          </div>
                        </div>
                      }
                    </div>
                  </div>
                }
              </div>
            }
          </div>
        </div>

        <div class="bb-card mb-6">
          <div class="bb-card-body">
            <h3 class="bb-section-title">Documents</h3>
            @if (documentsLoading) {
              <p class="text-sm text-base-content/60">Loading documents...</p>
            } @else if (documents.length === 0) {
              <p class="text-sm text-base-content/60">No documents shared on this case yet.</p>
            } @else {
              <ul class="divide-y divide-base-300">
                @for (d of documents; track d._id) {
                  <li class="py-2 flex items-center gap-2">
                    <div class="flex-1 min-w-0">
                      <span class="text-sm font-medium truncate">{{
                        d.name || d.originalFileName || 'Document'
                      }}</span>
                      @if (d.category) {
                        <span class="bb-chip bb-chip-neutral ml-2">{{ d.category }}</span>
                      }
                      @if (d.isVerified) {
                        <span class="bb-chip bb-chip-success ml-2">Verified</span>
                      }
                    </div>
                    <button
                      class="bb-btn bb-btn-ghost bb-btn-icon"
                      (click)="downloadDocument(d._id)"
                      aria-label="Download document"
                      title="Download"
                    >
                      <i class="material-icons-outlined text-base">download</i>
                    </button>
                  </li>
                }
              </ul>
            }

            <div class="divider my-3"></div>
            <h4 class="text-sm font-semibold text-base-content mb-2">Upload Document</h4>
            <div>
              <label class="bb-label" for="up-category">Category</label>
              <app-bb-select
                id="up-category"
                [(ngModel)]="uploadCategory"
                [options]="uploadCategoryOptions()"
              ></app-bb-select>
            </div>
            <div class="mt-3 flex flex-col sm:flex-row sm:items-end gap-3">
              <div class="flex-1">
                <label class="bb-label" for="up-file">File</label>
                <input
                  id="up-file"
                  type="file"
                  class="file-input file-input-bordered w-full"
                  [attr.accept]="allowedDocAccept"
                  (change)="onFileSelected($event)"
                />
                <p class="bb-hint mt-1">PDF, Word, Excel, or image files. The file's own name is used as the document name.</p>
              </div>
              <button
                class="bb-btn bb-btn-primary"
                [disabled]="uploading || !canUpload()"
                (click)="uploadDocument()"
              >
                @if (uploading) {
                  <span class="loading loading-spinner loading-sm"></span>
                } @else {
                  <i class="material-icons-outlined text-base">upload</i>
                  Upload
                }
              </button>
            </div>
          </div>
        </div>

        <div class="bb-card mb-6">
          <div class="bb-card-body">
            <h3 class="bb-section-title">Payments</h3>
            @if (paymentsLoading) {
              <p class="text-sm text-base-content/60">Loading payments...</p>
            } @else if (casePayments.length === 0) {
              <p class="text-sm text-base-content/60">No payments requested for this case yet.</p>
            } @else {
              <ul class="divide-y divide-base-300">
                @for (p of casePayments; track p._id) {
                  <li class="py-2">
                    <div class="flex flex-wrap items-center justify-between gap-2">
                      <div class="min-w-0">
                        <div class="text-sm font-medium">
                          {{ p.currency | uppercase }} {{ formatAmount(p.amountInPaise / 100) }}
                        </div>
                        @if (p.description) {
                          <div class="text-xs text-base-content/70">
                            <span class="text-base-content/50">For:</span> {{ p.description }}
                          </div>
                        }
                      </div>
                      <div class="flex items-center gap-2 shrink-0">
                        <span class="bb-chip" [ngClass]="paymentChipClass(p.status)">{{
                          p.status | titlecase
                        }}</span>
                        @if (p.status === 'pending' && payingPaymentId !== p._id) {
                          <button class="bb-btn bb-btn-primary bb-btn-sm" (click)="openPayForm(p)">
                            Pay Now
                          </button>
                        }
                      </div>
                    </div>

                    @if (payingPaymentId === p._id) {
                      <div class="mt-3 rounded-lg border border-base-300 p-3">
                        @if (payError) {
                          <div
                            class="flex items-center gap-2 px-3 py-2 rounded-lg mb-3 text-sm bg-error/10 text-error border border-error/20"
                          >
                            <i class="material-icons-outlined text-base">error_outline</i>
                            <span class="flex-1">{{ payError }}</span>
                          </div>
                        }
                        @if (stripeLoading) {
                          <div class="flex justify-center py-8">
                            <span class="loading loading-spinner loading-md text-primary"></span>
                          </div>
                        }
                        <div #paymentElementHost [class.hidden]="stripeLoading"></div>
                        <div class="flex gap-2 justify-end mt-3" [class.hidden]="stripeLoading">
                          <button
                            type="button"
                            class="bb-btn bb-btn-ghost bb-btn-sm"
                            (click)="cancelPayForm()"
                            [disabled]="submittingPayment"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            class="bb-btn bb-btn-primary bb-btn-sm"
                            (click)="submitInlinePayment(p)"
                            [disabled]="submittingPayment"
                          >
                            {{
                              submittingPayment
                                ? 'Processing…'
                                : 'Pay ' + (p.currency | uppercase) + ' ' + formatAmount(p.amountInPaise / 100)
                            }}
                          </button>
                        </div>
                      </div>
                    }
                  </li>
                }
              </ul>
            }
          </div>
        </div>

        <div class="bb-card mb-6">
          <div class="bb-card-body">
            <h3 class="bb-section-title">Invoices</h3>
            @if (invoicesLoading) {
              <p class="text-sm text-base-content/60">Loading invoices...</p>
            } @else if (caseInvoices.length === 0) {
              <p class="text-sm text-base-content/60">No invoices issued for this case yet.</p>
            } @else {
              <ul class="divide-y divide-base-300">
                @for (inv of caseInvoices; track inv._id) {
                  <li class="py-2 flex flex-wrap items-center justify-between gap-2">
                    <div class="min-w-0">
                      <div class="text-xs font-mono text-base-content/70">{{ inv.invoiceNumber }}</div>
                      <div class="text-sm font-medium">
                        {{ inv.currency }} {{ inv.totalAmount | number: '1.2-2' }}
                      </div>
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                      <span class="bb-chip" [ngClass]="invoiceChipClass(inv.status)">{{
                        inv.status
                      }}</span>
                      @if (inv.attachmentDocumentId) {
                        <button
                          class="bb-btn bb-btn-outline bb-btn-sm"
                          (click)="downloadInvoiceAttachment(inv)"
                          [disabled]="downloadingInvoiceId === inv._id"
                        >
                          Attachment
                        </button>
                      }
                      @if (inv.externalReceiptUrl) {
                        <a
                          class="bb-btn bb-btn-outline bb-btn-sm"
                          [href]="inv.externalReceiptUrl"
                          target="_blank"
                          rel="noopener"
                        >
                          Receipt
                        </a>
                      }
                    </div>
                  </li>
                }
              </ul>
            }
          </div>
        </div>

        @if (canRateConsultant()) {
          <div class="bb-card mt-4">
            <div class="bb-card-body flex flex-col gap-6">
              <div>
                <h3 class="bb-section-title !mb-1">Rate your consultant</h3>
                <p class="text-sm text-base-content/60">
                  This case is closed — let us know how
                  {{ caseData.caseManagerId?.name || 'your case manager' }} did.
                </p>
              </div>

              @if (consultantRatingSubmitted) {
                <div
                  class="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm bg-success/10 text-success border border-success/20"
                >
                  <i class="material-icons-outlined text-base">check_circle</i>
                  <span>Thank you for rating your case manager!</span>
                </div>
              } @else {
                <div>
                  <span class="bb-label">Overall</span>
                  <span class="block font-medium text-base-content mt-1"
                    >How was your experience overall?</span
                  >
                  <div class="flex gap-1 mt-3" role="radiogroup" aria-label="Overall star rating">
                    @for (star of [1, 2, 3, 4, 5]; track star) {
                      <button
                        type="button"
                        class="bb-btn bb-btn-icon bb-star-btn"
                        [attr.aria-label]="'Rate ' + star + ' out of 5'"
                        [attr.aria-pressed]="consultantRating >= star"
                        (click)="setConsultantRating(star)"
                      >
                        <i
                          class="material-icons-outlined text-4xl transition-colors"
                          [style.color]="consultantRating >= star ? 'var(--saffron)' : 'var(--ink-40)'"
                        >
                          {{ consultantRating >= star ? 'star' : 'star_border' }}
                        </i>
                      </button>
                    }
                  </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                  @for (dim of consultantDimensions; track dim.key) {
                    <div>
                      <span class="bb-label">{{ dim.label }}</span>
                      <div
                        class="flex gap-1 mt-2"
                        role="radiogroup"
                        [attr.aria-label]="dim.label + ' rating'"
                      >
                        @for (n of [1, 2, 3, 4, 5]; track n) {
                          <button
                            type="button"
                            class="w-8 h-8 rounded-full text-xs font-semibold border transition-colors"
                            [class.bg-primary]="consultantDimensionValue(dim.key) === n"
                            [class.text-primary-content]="consultantDimensionValue(dim.key) === n"
                            [class.border-primary]="consultantDimensionValue(dim.key) === n"
                            [class.bg-base-100]="consultantDimensionValue(dim.key) !== n"
                            [class.border-base-300]="consultantDimensionValue(dim.key) !== n"
                            (click)="setConsultantDimension(dim.key, n)"
                          >
                            {{ n }}
                          </button>
                        }
                      </div>
                    </div>
                  }
                </div>

                <div>
                  <label class="bb-label" for="consultant-comment"
                    >Comments
                    <span class="font-normal text-base-content/60">(optional)</span></label
                  >
                  <textarea
                    id="consultant-comment"
                    class="bb-textarea"
                    [(ngModel)]="consultantComment"
                    placeholder="Anything to add…"
                  ></textarea>
                </div>

                @if (consultantRatingError) {
                  <div
                    class="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm bg-error/10 text-error border border-error/20"
                  >
                    <i class="material-icons-outlined text-base">error_outline</i>
                    <span>{{ consultantRatingError }}</span>
                  </div>
                }

                <div class="flex justify-end pt-2 border-t border-base-200">
                  <button
                    class="bb-btn bb-btn-primary"
                    type="button"
                    [disabled]="consultantRatingLoading"
                    (click)="submitConsultantRatingForCase()"
                  >
                    @if (consultantRatingLoading) {
                      <span class="loading loading-spinner loading-sm"></span>
                    } @else {
                      <span>Submit Rating</span>
                      <i class="material-icons-outlined">arrow_forward</i>
                    }
                  </button>
                </div>
              }
            </div>
          </div>
        }
      } @else {
        <div class="bb-card">
          <div class="bb-empty">
            <div class="bb-empty-icon"><i class="material-icons-outlined">help_outline</i></div>
            <p class="bb-empty-title">Case not found</p>
          </div>
        </div>
      }
    </div>
  `,
})
export class ClientCaseDetailComponent implements OnInit, OnDestroy {
  @ViewChild('paymentElementHost') paymentElementHost?: ElementRef<HTMLDivElement>;
  caseData: (Omit<Case, 'status'> & { status: CaseStatus }) | null = null;
  loading = true;

  quotes: Quote[] = [];
  loadingQuotes = false;
  respondingQuoteId: string | null = null;
  negotiatingQuoteId: string | null = null;
  negotiateComment = '';
  rejectingQuoteId: string | null = null;
  rejectReason = '';
  confirmingClose = false;
  milestoneBusyId: string | null = null;

  // Discovery call booking
  slots: Slot[] = [];
  loadingSlots = false;
  slotsComingSoon = false;
  booking = false;
  myBooking: Booking | null = null;
  loadingBooking = false;
  cancellingBooking = false;
  rescheduling = false;

  // Payments
  casePayments: Payment[] = [];
  paymentsLoading = false;
  payingPaymentId: string | null = null;
  stripeLoading = false;
  submittingPayment = false;
  payError = '';
  private stripe: Stripe | null = null;
  private elements: StripeElements | null = null;

  // Invoices
  caseInvoices: CaseInvoice[] = [];
  invoicesLoading = false;
  downloadingInvoiceId: string | null = null;

  // Documents
  documents: DocumentRecord[] = [];
  documentsLoading = false;
  uploadCategories = ['IDENTITY', 'PROPERTY', 'FINANCIAL', 'LEGAL', 'AGREEMENT', 'OTHER'];

  uploadCategoryOptions(): { value: string; label: string }[] {
    return this.uploadCategories.map((c) => ({ value: c, label: c }));
  }
  uploadCategory = 'OTHER';
  uploadFile: File | null = null;
  uploading = false;
  readonly allowedDocAccept = ALLOWED_DOCUMENT_FILE_ACCEPT;

  // Rate your consultant — only offered once the case is closed
  consultantRating = 0;
  consultantCommunication = 0;
  consultantExpertise = 0;
  consultantResponsiveness = 0;
  consultantComment = '';
  consultantRatingLoading = false;
  consultantRatingSubmitted = false;
  consultantRatingError = '';
  readonly consultantDimensions = [
    { key: 'communication', label: 'Communication' },
    { key: 'expertise', label: 'Expertise' },
    { key: 'responsiveness', label: 'Responsiveness' },
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private clientCasesService: ClientCasesService,
    private api: ApiService,
    private auth: AuthService,
    private toast: ToastService,
    private documentsService: DocumentsService,
    private pageTitleService: PageTitleService,
    private paymentsService: PaymentsService,
  ) {}

  ngOnInit(): void {
    // The route param is whatever identifier the URL used (the human-readable
    // caseNumber) — every call after this one must use the loaded case's own
    // _id instead, never this raw param.
    const routeId = this.route.snapshot.paramMap.get('id') ?? '';
    this.clientCasesService.getCaseById(routeId).subscribe({
      next: (c) => {
        this.caseData = c as Omit<Case, 'status'> & { status: CaseStatus };
        this.pageTitleService.set(c.caseNumber ?? 'Case Detail');
        this.loading = false;
        this.loadQuotes(c._id);
        this.loadDocuments(c._id);
        this.loadPayments(c._id);
        this.loadInvoices(c._id);
        if (this.canBookDiscovery()) {
          this.loadMyBooking();
        }
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  canBookDiscovery(): boolean {
    const s = this.caseData?.status;
    return s === CaseStatus.LEAD_CAPTURED || s === CaseStatus.FRQ_INTAKE;
  }

  canRateConsultant(): boolean {
    return this.caseData?.status === CaseStatus.CLOSED;
  }

  setConsultantRating(star: number): void {
    this.consultantRating = star;
  }

  setConsultantDimension(key: string, n: number): void {
    if (key === 'communication') this.consultantCommunication = n;
    else if (key === 'expertise') this.consultantExpertise = n;
    else if (key === 'responsiveness') this.consultantResponsiveness = n;
  }

  consultantDimensionValue(key: string): number {
    if (key === 'communication') return this.consultantCommunication;
    if (key === 'expertise') return this.consultantExpertise;
    if (key === 'responsiveness') return this.consultantResponsiveness;
    return 0;
  }

  submitConsultantRatingForCase(): void {
    if (!this.caseData || !this.consultantRating) {
      this.consultantRatingError = 'Please select an overall star rating.';
      return;
    }
    this.consultantRatingLoading = true;
    this.consultantRatingError = '';
    const caseId = this.caseData._id;
    this.clientCasesService
      .submitConsultantRating(caseId, {
        rating: this.consultantRating,
        communication: this.consultantCommunication,
        expertise: this.consultantExpertise,
        responsiveness: this.consultantResponsiveness,
        comment: this.consultantComment,
        caseId,
      })
      .subscribe({
        next: () => {
          this.consultantRatingLoading = false;
          this.consultantRatingSubmitted = true;
        },
        error: (err) => {
          this.consultantRatingLoading = false;
          this.consultantRatingError = extractApiError(err, 'Could not submit rating.').message;
        },
      });
  }

  loadMyBooking(): void {
    if (!this.caseData) return;
    this.loadingBooking = true;
    this.api.get<Booking[]>(`/scheduling/bookings/case/${this.caseData._id}`).subscribe({
      next: (rows) => {
        this.loadingBooking = false;
        this.myBooking = (rows ?? []).find((b) => b.status === 'SCHEDULED') ?? null;
        if (!this.myBooking) this.loadSlots();
      },
      error: () => {
        this.loadingBooking = false;
        this.loadSlots();
      },
    });
  }

  loadSlots(): void {
    const cmId = this.caseData?.caseManagerId?._id;
    if (!cmId) return;
    this.loadingSlots = true;
    const from = new Date().toISOString();
    const to = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    this.api.get<Slot[]>(`/scheduling/slots/${cmId}`, { from, to }).subscribe({
      next: (rows) => {
        this.slots = rows ?? [];
        this.loadingSlots = false;
        this.slotsComingSoon = false;
      },
      error: (err) => {
        this.loadingSlots = false;
        this.slots = [];
        if (err?.status === 404) this.slotsComingSoon = true;
      },
    });
  }

  startReschedule(): void {
    this.rescheduling = true;
    this.loadSlots();
  }

  cancelReschedule(): void {
    this.rescheduling = false;
    this.slots = [];
  }

  bookSlot(slot: Slot): void {
    if (!this.caseData || this.booking) return;
    const cmId = this.caseData.caseManagerId?._id;
    if (!cmId) return;
    const me = this.auth.currentUser;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
    const startMs = new Date(slot.startAt).getTime();
    const endMs = new Date(slot.endAt).getTime();
    const durationMinutes = Math.max(15, Math.round((endMs - startMs) / 60000));
    const previousBookingId = this.myBooking?._id ?? null;
    this.booking = true;
    const body = {
      hostUserId: cmId,
      guestUserId: me?._id,
      guestName: me?.name?.trim() || 'Client',
      guestEmail: me?.email ?? '',
      guestTimezone: tz,
      caseId: this.caseData._id,
      purpose: 'DISCOVERY',
      startAt: slot.startAt,
      durationMinutes,
    };
    this.api.post<Booking>('/scheduling/bookings', body).subscribe({
      next: (created) => {
        this.booking = false;
        this.myBooking = created;
        this.rescheduling = false;
        this.toast.success(previousBookingId ? 'Discovery call rescheduled' : 'Discovery call booked');
        if (previousBookingId) {
          this.api.patch<unknown>(`/scheduling/bookings/${previousBookingId}/cancel`, {}).subscribe();
        }
      },
      error: (err) => {
        this.booking = false;
        if (err?.status === 404) {
          this.slotsComingSoon = true;
          this.toast.info('Scheduling coming soon');
        } else {
          this.toast.error(extractApiError(err, 'Failed to book slot').message);
        }
      },
    });
  }

  cancelBooking(): void {
    if (!this.myBooking || this.cancellingBooking) return;
    this.cancellingBooking = true;
    this.api.patch<unknown>(`/scheduling/bookings/${this.myBooking._id}/cancel`, {}).subscribe({
      next: () => {
        this.cancellingBooking = false;
        this.myBooking = null;
        this.toast.success('Discovery call cancelled');
        this.loadSlots();
      },
      error: (err) => {
        this.cancellingBooking = false;
        this.toast.error(extractApiError(err, 'Failed to cancel booking').message);
      },
    });
  }

  loadQuotes(caseId: string): void {
    this.loadingQuotes = true;
    this.api.get<Quote[]>(`/quotes/case/${caseId}`).subscribe({
      next: (qs) => {
        this.quotes = qs ?? [];
        this.loadingQuotes = false;
      },
      error: () => {
        this.quotes = [];
        this.loadingQuotes = false;
      },
    });
  }

  get visibleQuotes(): Quote[] {
    // INVITED/DRAFT/DECLINED are internal vendor-sourcing states, not
    // client-facing — the backend already excludes never-sent quotes
    // entirely, this is just defense-in-depth against the same leak.
    return this.quotes.filter(
      (q) => q.status !== 'INVITED' && q.status !== 'DRAFT' && q.status !== 'DECLINED',
    );
  }

  anyQuoteHasUpdate(): boolean {
    return this.visibleQuotes.some((q) => q.hasUpdate);
  }

  markQuoteSeen(q: Quote): void {
    if (!q.hasUpdate) return;
    q.hasUpdate = false;
    this.api.patch(`/quotes/${q._id}/seen`, {}).subscribe({ error: () => {} });
  }

  quoteStatusLabel(s: Quote['status']): string {
    return QUOTE_STATUS_LABEL[s as QuoteStatus] ?? s;
  }

  getQuoteBadge(s: Quote['status']): string {
    return QUOTE_BADGE[s as QuoteStatus] ?? 'bb-chip-neutral';
  }

  // The CM-curated client-facing quote — falls back to the (now usually
  // stripped) vendor fields only for quotes that predate this feature.
  quoteItems(q: Quote): QuoteItem[] {
    return q.clientItems?.length ? q.clientItems : (q.items ?? []);
  }

  quoteTotal(q: Quote): number {
    return q.clientTotalAmount ?? q.totalAmount ?? 0;
  }

  confirmClose(): void {
    if (!this.caseData || this.confirmingClose) return;
    this.confirmingClose = true;
    this.api.post<Case>(`/cases/${this.caseData._id}/confirm-close`, {}).subscribe({
      next: (updated) => {
        this.caseData = updated as Omit<Case, 'status'> & { status: CaseStatus };
        this.confirmingClose = false;
        this.toast.success('Case marked as complete — thank you!');
      },
      error: (err) => {
        this.confirmingClose = false;
        this.toast.error(extractApiError(err, 'Failed to confirm case completion').message);
      },
    });
  }

  getPriorityBadge(priority: string): string {
    return PRIORITY_BADGE[priority?.toUpperCase()] ?? 'bb-chip-neutral';
  }

  toggleNegotiate(quoteId: string, prefill?: string): void {
    if (this.negotiatingQuoteId === quoteId) {
      this.cancelNegotiate();
    } else {
      this.negotiatingQuoteId = quoteId;
      this.negotiateComment = prefill ?? '';
    }
  }

  cancelNegotiate(): void {
    this.negotiatingQuoteId = null;
    this.negotiateComment = '';
  }

  toggleReject(quoteId: string): void {
    if (this.rejectingQuoteId === quoteId) {
      this.cancelReject();
    } else {
      this.rejectingQuoteId = quoteId;
      this.rejectReason = '';
      // Close negotiate form if it was open
      this.negotiatingQuoteId = null;
      this.negotiateComment = '';
    }
  }

  cancelReject(): void {
    this.rejectingQuoteId = null;
    this.rejectReason = '';
  }

  rejectQuote(q: Quote): void {
    if (this.respondingQuoteId || !this.rejectReason.trim()) return;
    this.respondingQuoteId = q._id;
    this.api
      .post<Quote>(`/quotes/${q._id}/reject`, { reason: this.rejectReason.trim() })
      .subscribe({
        next: () => {
          this.respondingQuoteId = null;
          this.cancelReject();
          if (this.caseData) this.loadQuotes(this.caseData._id);
          this.toast.success('Quote rejected');
        },
        error: (err) => {
          this.respondingQuoteId = null;
          this.toast.error(extractApiError(err, 'Failed to reject quote').message);
        },
      });
  }

  respondQuote(q: Quote, response: QuoteResponse, comment?: string): void {
    if (this.respondingQuoteId) return;
    this.respondingQuoteId = q._id;
    const body: { response: QuoteResponse; comment?: string } = { response };
    if (comment && comment.trim()) body.comment = comment.trim();
    this.api.post<Quote>(`/quotes/${q._id}/respond`, body).subscribe({
      next: () => {
        this.respondingQuoteId = null;
        this.cancelNegotiate();
        if (this.caseData) this.loadQuotes(this.caseData._id);
        const verb =
          response === 'ACCEPTED'
            ? 'accepted'
            : response === 'REJECTED'
              ? 'rejected'
              : 'sent for negotiation';
        this.toast.success(`Quote ${verb}`);
      },
      error: () => {
        this.respondingQuoteId = null;
        this.toast.error('Failed to respond to quote');
      },
    });
  }

  // ---------- Milestones ----------
  milestoneStatusLabel(status: MilestoneStatus): string {
    return MILESTONE_STATUS_LABEL[status] ?? status;
  }

  milestoneChipClass(status: MilestoneStatus): string {
    return MILESTONE_CHIP[status] ?? 'bb-chip-neutral';
  }

  approveMilestone(q: Quote, m: QuoteMilestone): void {
    if (!m._id || this.milestoneBusyId) return;
    this.milestoneBusyId = m._id;
    this.api
      .patch<Quote>(`/quotes/${q._id}/milestones/${m._id}/client-approve`, {})
      .subscribe({
        next: () => {
          this.milestoneBusyId = null;
          if (this.caseData) this.loadQuotes(this.caseData._id);
          this.toast.success('Milestone confirmed');
        },
        error: (err) => {
          this.milestoneBusyId = null;
          this.toast.error(extractApiError(err, 'Failed to confirm milestone').message);
        },
      });
  }

  getStageLabel(stage: CaseStatus | string): string {
    return STAGE_LABEL[stage as CaseStatus] ?? String(stage);
  }

  // ---------- Payments ----------
  loadPayments(caseId: string): void {
    this.paymentsLoading = true;
    this.paymentsService.getPaymentsByCase(caseId).subscribe({
      next: (rows) => {
        this.casePayments = rows ?? [];
        this.paymentsLoading = false;
      },
      error: () => {
        this.casePayments = [];
        this.paymentsLoading = false;
      },
    });
  }

  formatAmount(n: number): string {
    return (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  paymentChipClass(status: Payment['status']): string {
    switch (status) {
      case 'captured':
        return 'bb-chip-success';
      case 'authorized':
        return 'bb-chip-info';
      case 'failed':
        return 'bb-chip-danger';
      case 'refunded':
        return 'bb-chip-neutral';
      default:
        return 'bb-chip-warning';
    }
  }

  openPayForm(p: Payment): void {
    this.payingPaymentId = p._id;
    this.payError = '';
    this.stripeLoading = true;
    this.api.post<{ clientSecret: string }>(`/payments/${p._id}/create-intent`, {}).subscribe({
      next: async ({ clientSecret }) => {
        this.stripe = await loadStripe(environment.stripePublishableKey);
        if (!this.stripe) {
          this.payError = 'Could not load the payment form. Please try again.';
          this.stripeLoading = false;
          return;
        }
        this.elements = this.stripe.elements({ clientSecret });
        const paymentElement = this.elements.create('payment');
        // Deferred one tick so the (now-unhidden) host div has rendered.
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

  cancelPayForm(): void {
    this.payingPaymentId = null;
    this.stripeLoading = false;
    this.payError = '';
    this.elements = null;
    this.stripe = null;
  }

  async submitInlinePayment(p: Payment): Promise<void> {
    if (!this.stripe || !this.elements || this.submittingPayment) return;
    this.submittingPayment = true;
    this.payError = '';

    const { error, paymentIntent } = await this.stripe.confirmPayment({
      elements: this.elements,
      redirect: 'if_required',
    });

    this.submittingPayment = false;

    if (error) {
      this.payError = error.message ?? 'Payment failed. Please check your card details and try again.';
      return;
    }

    // capture_method: manual — a successful confirm lands in
    // 'requires_capture', not 'succeeded'. Either means the hold went
    // through. Sync our own record right away rather than waiting on the
    // webhook, so this list reflects it the moment we reload.
    if (paymentIntent?.status === 'requires_capture' || paymentIntent?.status === 'succeeded') {
      // The charge itself already went through on Stripe's side regardless
      // of whether this sync call succeeds — the webhook is the fallback —
      // so reload and confirm to the client either way rather than leaving
      // the form stuck if only the sync call hiccups.
      const finish = () => {
        this.cancelPayForm();
        if (this.caseData) this.loadPayments(this.caseData._id);
        this.toast.success('Payment received. Thank you!');
      };
      this.api.post(`/payments/${p._id}/confirm`, {}).subscribe({ next: finish, error: finish });
    } else {
      this.payError = 'Payment could not be completed. Please try again.';
    }
  }

  ngOnDestroy(): void {
    this.elements = null;
    this.stripe = null;
  }

  // ---------- Invoices ----------
  loadInvoices(caseId: string): void {
    this.invoicesLoading = true;
    this.api.get<CaseInvoice[]>(`/invoices/case/${caseId}`).subscribe({
      next: (rows) => {
        this.caseInvoices = rows ?? [];
        this.invoicesLoading = false;
      },
      error: () => {
        this.caseInvoices = [];
        this.invoicesLoading = false;
      },
    });
  }

  invoiceChipClass(status: string): string {
    switch ((status || '').toUpperCase()) {
      case 'ISSUED':
        return 'bb-chip-info';
      case 'PAID':
        return 'bb-chip-success';
      default:
        return 'bb-chip-neutral';
    }
  }

  downloadInvoiceAttachment(inv: CaseInvoice): void {
    if (!inv.attachmentDocumentId) return;
    this.downloadingInvoiceId = inv._id;
    this.documentsService.getDownloadUrl(inv.attachmentDocumentId).subscribe({
      next: ({ downloadUrl }) => {
        this.downloadingInvoiceId = null;
        window.open(downloadUrl, '_blank');
      },
      error: (err) => {
        this.downloadingInvoiceId = null;
        this.toast.error(extractApiError(err, 'Failed to open attachment').message);
      },
    });
  }

  goBack(): void {
    this.router.navigate(['/client/cases']);
  }

  // ---------- Documents ----------
  loadDocuments(caseId: string): void {
    this.documentsLoading = true;
    this.api.get<DocumentRecord[]>(`/documents/case/${caseId}`).subscribe({
      next: (docs) => {
        this.documents = docs ?? [];
        this.documentsLoading = false;
      },
      error: () => {
        this.documents = [];
        this.documentsLoading = false;
      },
    });
  }

  downloadDocument(id: string): void {
    this.api.get<{ downloadUrl: string }>(`/documents/${id}/download`).subscribe({
      next: (res) => {
        if (res.downloadUrl) window.open(res.downloadUrl, '_blank');
      },
      error: (err) => {
        this.toast.error(extractApiError(err, 'Failed to download document').message);
      },
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files.length > 0 ? input.files[0] : null;
    if (file && !isAllowedDocumentFile(file)) {
      this.toast.error('Only PDF, Word, Excel, or image files can be uploaded.');
      input.value = '';
      this.uploadFile = null;
      return;
    }
    if (file && isDocumentFileTooLarge(file)) {
      this.toast.error('File must be 5 MB or smaller.');
      input.value = '';
      this.uploadFile = null;
      return;
    }
    this.uploadFile = file;
  }

  canUpload(): boolean {
    return !!this.uploadFile;
  }

  uploadDocument(): void {
    if (!this.caseData || !this.uploadFile || !this.canUpload()) return;
    const file = this.uploadFile;
    if (this.documents.some((d) => d.name === file.name)) {
      this.toast.error(
        `A document named "${file.name}" already exists on this case — rename the file and try again.`,
      );
      return;
    }
    this.uploading = true;
    this.documentsService
      .requestUploadUrl({
        caseId: this.caseData._id,
        category: this.uploadCategory as
          | 'IDENTITY'
          | 'PROPERTY'
          | 'FINANCIAL'
          | 'LEGAL'
          | 'AGREEMENT'
          | 'OTHER',
        name: file.name,
        originalFileName: file.name,
        mimeType: this.uploadFile.type || 'application/octet-stream',
        sizeBytes: this.uploadFile.size,
      })
      .subscribe({
        next: async ({ uploadUrl, documentId }) => {
          try {
            const uploadRes = await fetch(uploadUrl, {
              method: 'PUT',
              headers: { 'Content-Type': this.uploadFile?.type || 'application/octet-stream' },
              body: this.uploadFile,
            });
            if (!uploadRes.ok) {
              throw new Error('Upload failed while sending file to storage');
            }
            this.documentsService.confirmUpload(documentId).subscribe({
              next: () => {
                this.uploading = false;
                this.uploadFile = null;
                this.toast.success('Document uploaded');
                if (this.caseData) this.loadDocuments(this.caseData._id);
              },
              error: (err) => {
                this.uploading = false;
                this.toast.error(extractApiError(err, 'Upload confirmation failed').message);
              },
            });
          } catch (err) {
            this.uploading = false;
            this.toast.error(err instanceof Error ? err.message : 'Upload failed');
          }
        },
        error: (err) => {
          this.uploading = false;
          this.toast.error(extractApiError(err, 'Failed to get upload URL').message);
        },
      });
  }
}
