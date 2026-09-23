import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { DocumentsService } from '../../../core/services/documents.service';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { extractApiError } from '../../../core/services/api-error';
import { PageTitleService } from '../../../core/services/page-title.service';
import { CaseStageTimelineComponent } from '../../../shared/components/case-stage-timeline/case-stage-timeline.component';
import { BbSelectComponent } from '../../../shared/components/bb-select/bb-select.component';
import { PaymentsService, Payment } from '../../../core/services/payments.service';
import {
  ALLOWED_DOCUMENT_FILE_ACCEPT,
  isAllowedDocumentFile,
  isDocumentFileTooLarge,
} from '../../../shared/utils/document-file-types.util';

interface PopulatedRef {
  _id?: string;
  name?: string;
  email?: string;
}

interface CaseDetail {
  _id: string;
  caseNumber: string;
  title?: string;
  description?: string;
  serviceType: string;
  status: string;
  priority?: string;
  clientId?: PopulatedRef | string | null;
  caseManagerId?: PopulatedRef | string | null;
  vendorId?: { _id: string; businessName?: string } | null;
  timeline?: { vendorStartedAt?: string };
  stageHistory?: { stage: string; changedAt: string; note?: string }[];
  createdAt?: string;
  updatedAt?: string;
}

type QuoteStatus =
  | 'INVITED'
  | 'DRAFT'
  | 'SENT'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'NEGOTIATING'
  | 'EXPIRED'
  | 'DECLINED';

type QuoteType = 'FIXED' | 'MILESTONE';
type MilestoneAmountType = 'FIXED' | 'PERCENT';
type MilestoneStatus = 'PENDING' | 'VENDOR_MARKED_DONE' | 'CLIENT_APPROVED' | 'PAID';

interface QuoteMilestone {
  _id?: string;
  title: string;
  sequence: number;
  amountType: MilestoneAmountType;
  amountValue: number;
  computedAmount?: number;
  status: MilestoneStatus;
}

interface QuoteItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

interface Quote {
  _id: string;
  status: QuoteStatus;
  totalAmount: number;
  currency: string;
  items?: QuoteItem[];
  validUntil?: string;
  revisionNumber?: number;
  quoteType?: QuoteType;
  milestones?: QuoteMilestone[];
  invitedAt?: string;
  respondBy?: string;
  declinedAt?: string;
  declineReason?: string;
  inviteNote?: string;
  vendorNegotiationReply?: string;
  vendorNegotiationRepliedAt?: string;
  vendorInfoRequest?: string;
  vendorInfoRequestedAt?: string;
  cmInfoResponse?: string;
  cmInfoRespondedAt?: string;
  sentAt?: string;
  vendorId?: { _id: string; businessName?: string };
  caseManagerId?: { _id?: string; name?: string };
  previousVendorQuote?: { items: QuoteItem[]; totalAmount: number; revisionNumber: number; capturedAt: string };
  // Set by the backend: something changed on this quote since the vendor last opened it.
  hasUpdate?: boolean;
}

const QUOTE_STATUS_LABEL: Record<QuoteStatus, string> = {
  INVITED: 'Quote Requested',
  DRAFT: 'Draft',
  SENT: 'Sent to Client',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
  // The vendor deals with the CM, not the client — whether the client is
  // negotiating on price with the CM is private between them (see
  // stripClientFieldsForVendor in quotes.service.ts). From the vendor's side
  // nothing has changed since they submitted, so this reads the same as SENT.
  NEGOTIATING: 'Sent to Client',
  EXPIRED: 'Expired',
  DECLINED: 'Declined',
};

interface QuoteItemForm {
  description: string;
  quantity: number;
  unitPrice: number;
}

interface MilestoneForm {
  title: string;
  amountType: MilestoneAmountType;
  amountValue: number;
}

interface DocumentRecord {
  _id: string;
  name?: string;
  category?: string;
  uploadedAt?: string;
  createdAt?: string;
}

type VendorInvoiceStatus = 'SUBMITTED' | 'ACKNOWLEDGED';

interface VendorInvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

interface VendorInvoice {
  _id: string;
  invoiceNumber: string;
  quoteId: string;
  milestoneId?: string;
  items: VendorInvoiceItem[];
  subtotal: number;
  gstRate: number;
  gstAmount: number;
  totalAmount: number;
  currency: string;
  status: VendorInvoiceStatus;
  attachmentDocumentId?: string;
  createdAt?: string;
}

interface InvoiceItemForm {
  description: string;
  quantity: number;
  unitPrice: number;
}

@Component({
  selector: 'app-vendor-case-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, CaseStageTimelineComponent, BbSelectComponent],
  template: `
    @if (loading) {
      <div class="flex justify-center py-16">
        <span class="loading loading-spinner loading-md text-primary" aria-label="Loading"></span>
      </div>
    }

    @if (!loading && caseDetail) {
      <button type="button" class="bb-btn bb-btn-ghost bb-btn-sm mb-4" (click)="goBack()">
        <i class="material-icons-outlined text-base">arrow_back</i>
        Back to My Jobs
      </button>

      <div class="bb-card mb-4">
        <div class="bb-card-body">
          <div class="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h2 class="bb-section-title !mb-1">{{ caseDetail.caseNumber }}</h2>
              <p class="text-sm text-base-content/60">{{ caseDetail.title }}</p>
            </div>
            <span class="bb-chip" [ngClass]="statusChipClass(caseDetail.status)">{{
              caseDetail.status
            }}</span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
            <div>
              <div class="bb-label">Service</div>
              <div class="text-sm">{{ caseDetail.serviceType }}</div>
            </div>
            <div>
              <div class="bb-label">Client</div>
              <div class="text-sm">
                {{ hasAcceptedQuote() ? getPersonName(caseDetail.clientId) : '—' }}
              </div>
            </div>
            <div>
              <div class="bb-label">Case Manager</div>
              <div class="text-sm">
                {{ hasAcceptedQuote() ? getPersonName(caseDetail.caseManagerId) : '—' }}
              </div>
            </div>
            <div>
              <div class="bb-label">Started</div>
              <div class="text-sm">
                {{
                  caseDetail.timeline?.vendorStartedAt
                    ? (caseDetail.timeline!.vendorStartedAt | date: 'mediumDate')
                    : '—'
                }}
              </div>
            </div>
          </div>

          @if (caseDetail.description) {
            <div class="mt-4">
              <div class="bb-label">Description</div>
              <p class="text-sm">{{ caseDetail.description }}</p>
            </div>
          }

          @for (q of quotes; track q._id) {
            @if (q.vendorInfoRequest) {
              <div class="vc-qa-thread mt-4">
                <div class="vc-qa-bubble vc-qa-bubble--you">
                  <div class="vc-qa-bubble-label">
                    <i class="material-icons-outlined text-sm">store</i>
                    You
                  </div>
                  <p class="vc-qa-bubble-text">{{ q.vendorInfoRequest }}</p>
                </div>
                @if (q.cmInfoResponse) {
                  <div class="vc-qa-bubble vc-qa-bubble--cm">
                    <div class="vc-qa-bubble-label">
                      <i class="material-icons-outlined text-sm">support_agent</i>
                      Case Manager
                    </div>
                    <p class="vc-qa-bubble-text">{{ q.cmInfoResponse }}</p>
                  </div>
                } @else {
                  <p class="vc-qa-waiting">Waiting on the case manager…</p>
                }
              </div>
            }

            @if (requestInfoFormId === q._id) {
              <div class="flex flex-col gap-2 mt-3">
                <label class="bb-label" [attr.for]="'req-info-' + q._id">Ask a question</label>
                <textarea
                  [id]="'req-info-' + q._id"
                  class="bb-textarea"
                  rows="2"
                  [(ngModel)]="requestInfoNote"
                  [ngModelOptions]="{ standalone: true }"
                  placeholder="e.g. Can you clarify the exact scope of work?"
                ></textarea>
                <div class="flex gap-2 justify-end">
                  <button class="bb-btn bb-btn-ghost bb-btn-sm" (click)="cancelRequestInfo()">
                    Cancel
                  </button>
                  <button
                    class="bb-btn bb-btn-primary bb-btn-sm"
                    (click)="submitRequestInfo(q)"
                    [disabled]="!requestInfoNote.trim() || requestInfoBusy"
                  >
                    {{ requestInfoBusy ? 'Sending…' : 'Send Question' }}
                  </button>
                </div>
              </div>
            } @else if (
              respondingQuoteId !== q._id &&
              decliningQuoteId !== q._id &&
              (!q.vendorInfoRequest || q.cmInfoResponse)
            ) {
              <div class="flex justify-end mt-3">
                <button class="bb-btn bb-btn-secondary bb-btn-sm" (click)="openRequestInfoForm(q)">
                  <i class="material-icons-outlined text-base">help_outline</i>
                  Ask a Question
                </button>
              </div>
            }
          }
        </div>
      </div>

      <!-- Timeline -->
      <div class="bb-card mb-4">
        <div class="bb-card-body">
          <h3 class="bb-section-title">Progress Timeline</h3>
          <app-case-stage-timeline
            [currentStage]="caseDetail.status"
            [stageHistory]="caseDetail.stageHistory ?? []"
          ></app-case-stage-timeline>
        </div>
      </div>

      <!-- Quotes for this case -->
      <div class="bb-card mb-4">
        <div class="bb-card-body">
          <h3 class="bb-section-title flex items-center gap-2">
            Quotes
            @if (anyQuoteHasUpdate()) {
              <span class="bb-update-dot" title="New updates on one or more quotes"></span>
            }
          </h3>

          @if (quotesLoading) {
            <p class="text-sm text-base-content/60 mt-2">Loading quotes...</p>
          } @else if (quotes.length === 0) {
            <p class="text-sm text-base-content/60 mt-2">No quote requests yet for this case.</p>
          }

          @for (q of quotes; track q._id) {
            <div
              class="rounded-xl border border-base-300 overflow-hidden mb-4 last:mb-0 bg-base-100"
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
                  <span
                    class="bb-chip"
                    [class.vc-chip--invited]="q.status === 'INVITED'"
                    [ngClass]="quoteChipClass(q.status)"
                    >{{ quoteStatusLabel(q.status) }}</span
                  >
                  @if (q.revisionNumber && q.revisionNumber > 1) {
                    <span class="bb-chip bb-chip-neutral">rev {{ q.revisionNumber }}</span>
                  }
                  @if (q.status === 'ACCEPTED') {
                    <span class="text-xs text-base-content/70"
                      >CM: {{ getPersonName(q.caseManagerId) }}</span
                    >
                  }
                </div>
                @if (q.items && q.items.length > 0) {
                  <div class="text-right shrink-0">
                    <div class="text-[0.65rem] font-semibold uppercase tracking-wide text-base-content/50">
                      Total
                    </div>
                    <strong class="text-lg leading-tight text-[var(--saffron)]"
                      >{{ q.currency }} {{ q.totalAmount | number: '1.0-2' }}</strong
                    >
                  </div>
                }
              </div>

              <div class="px-4 py-3">
                @if (q.status === 'INVITED' && (q.respondBy || q.previousVendorQuote)) {
                  <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-base-content/70 mb-2">
                    @if (q.respondBy) {
                      <span>Respond by {{ q.respondBy | date: 'MMM d, y, h:mm a' }}</span>
                    }
                    @if (q.previousVendorQuote) {
                      <span
                        >Your previous quote was {{ q.currency }}
                        {{ q.previousVendorQuote.totalAmount | number: '1.0-2' }}</span
                      >
                    }
                  </div>
                }
                @if (isSubmittedQuote(q) && q.items && q.items.length > 0 && revisingQuoteId !== q._id) {
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
                          @for (it of q.items; track $index) {
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
                            <td class="text-right">{{ q.currency }} {{ q.totalAmount | number: '1.0-2' }}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                }

                @if (
                  q.status === 'INVITED' &&
                  q.inviteNote &&
                  revisingQuoteId !== q._id &&
                  !isThisVendorAssigned(q)
                ) {
                  <div class="mt-3 flex items-start gap-2 px-3 py-2 rounded-lg bg-warning/10 border border-warning/20">
                    <i class="material-icons-outlined text-base text-warning">forum</i>
                    <div class="min-w-0 flex-1">
                      <div class="text-xs font-semibold text-warning uppercase tracking-wide">
                        Case manager's note
                      </div>
                      <p class="text-sm text-base-content mt-0.5 m-0">{{ q.inviteNote }}</p>
                    </div>
                  </div>
                  @if (q.vendorNegotiationReply && vendorReplyFormId !== q._id) {
                    <div class="mt-2 flex items-start gap-2 px-3 py-2 rounded-lg bg-base-200 border border-base-300">
                      <i class="material-icons-outlined text-base text-base-content/60">reply</i>
                      <div class="min-w-0 flex-1">
                        <div class="text-xs font-semibold text-base-content/60 uppercase tracking-wide">
                          Your reply
                        </div>
                        <p class="text-sm text-base-content mt-0.5 m-0">{{ q.vendorNegotiationReply }}</p>
                      </div>
                    </div>
                    <div class="flex justify-end mt-2">
                      <button class="bb-btn bb-btn-ghost bb-btn-sm" (click)="openVendorReplyForm(q)">
                        <i class="material-icons-outlined text-base">edit</i>
                        Edit Reply
                      </button>
                    </div>
                  } @else if (vendorReplyFormId === q._id) {
                    <div class="mt-2 flex flex-col gap-2">
                      <label class="bb-label" [attr.for]="'vendor-reply-' + q._id">Your reply</label>
                      <textarea
                        [id]="'vendor-reply-' + q._id"
                        class="bb-textarea"
                        rows="2"
                        [(ngModel)]="vendorReplyText"
                        [ngModelOptions]="{ standalone: true }"
                        placeholder="e.g. Can't go below this without dropping quality — happy to explain the breakdown."
                      ></textarea>
                      <div class="flex gap-2 justify-end">
                        <button class="bb-btn bb-btn-ghost bb-btn-sm" (click)="cancelVendorReply()">
                          Cancel
                        </button>
                        <button
                          class="bb-btn bb-btn-primary bb-btn-sm"
                          (click)="submitVendorReply(q)"
                          [disabled]="!vendorReplyText.trim() || vendorReplyBusy"
                        >
                          {{ vendorReplyBusy ? 'Sending…' : 'Send Reply' }}
                        </button>
                      </div>
                    </div>
                  } @else {
                    <div class="flex justify-end mt-2">
                      <button class="bb-btn bb-btn-outline bb-btn-sm" (click)="openVendorReplyForm(q)">
                        <i class="material-icons-outlined text-base">reply</i>
                        Reply
                      </button>
                    </div>
                  }
                }

                @if (
                  q.status === 'INVITED' &&
                  !(q.items && q.items.length > 0) &&
                  respondingQuoteId !== q._id &&
                  decliningQuoteId !== q._id &&
                  requestInfoFormId !== q._id
                ) {
                  <div class="flex flex-wrap justify-end gap-2 mt-3">
                    <button class="bb-btn bb-btn-danger bb-btn-sm" (click)="openDeclineForm(q)">
                      <i class="material-icons-outlined text-base">close</i>
                      Decline
                    </button>
                    <button class="bb-btn bb-btn-primary bb-btn-sm" (click)="openSubmitForm(q)">
                      <i class="material-icons-outlined text-base">edit_document</i>
                      Submit Quote
                    </button>
                  </div>
                }

                @if (revisingQuoteId !== q._id && (isRevisableQuote(q) || isDeletableQuote(q))) {
                  <div class="mt-3 pt-3 border-t border-base-300 flex justify-end gap-2">
                    @if (isDeletableQuote(q)) {
                      <button
                        class="bb-btn bb-btn-danger bb-btn-sm"
                        (click)="deleteQuote(q)"
                        [disabled]="deletingQuoteId === q._id"
                      >
                        <i class="material-icons-outlined text-base">delete</i>
                        {{ deletingQuoteId === q._id ? 'Deleting…' : 'Delete Quote' }}
                      </button>
                    }
                    @if (isRevisableQuote(q)) {
                      <button class="bb-btn bb-btn-secondary bb-btn-sm" (click)="openReviseForm(q)">
                        <i class="material-icons-outlined text-base">autorenew</i>
                        Revise Quote
                      </button>
                    }
                  </div>
                }

                @if (q.milestones && q.milestones.length > 0) {
                  <div class="mt-3 pt-3 border-t border-base-300 flex flex-col gap-2">
                    <h4 class="text-xs font-semibold uppercase tracking-wide text-base-content/50 mb-1">
                      {{ q.quoteType === 'MILESTONE' ? 'Milestones' : 'Completion' }}
                    </h4>
                    @for (m of q.milestones; track m._id) {
                      <div class="flex flex-wrap items-center gap-2 text-sm">
                        <span class="font-medium">{{
                          q.quoteType === 'MILESTONE' ? m.sequence + '. ' + m.title : 'Payment status'
                        }}</span>
                        <span class="text-base-content/60">{{ milestoneAmountLabel(q, m) }}</span>
                        <span class="bb-chip" [ngClass]="milestoneChipClass(m.status)">{{
                          milestoneStatusLabel(m.status)
                        }}</span>
                        @if (q.status === 'ACCEPTED' && m.status === 'PENDING') {
                          <button
                            class="bb-btn bb-btn-outline bb-btn-sm"
                            (click)="markMilestoneComplete(q, m)"
                            [disabled]="milestoneBusyId === m._id"
                          >
                            {{ milestoneBusyId === m._id ? 'Saving…' : 'Mark Complete' }}
                          </button>
                        }
                      </div>
                    }
                  </div>
                }

              <!-- Submit / revise quote form -->
              @if (respondingQuoteId === q._id || revisingQuoteId === q._id) {
                <div class="mt-3 pt-3 border-t border-base-300 flex flex-col gap-3">
                  @if (respondingQuoteId === q._id) {
                    <div class="flex gap-2">
                      <button
                        type="button"
                        class="bb-btn bb-btn-sm"
                        [class.bb-btn-primary]="formQuoteType === 'FIXED'"
                        [class.bb-btn-outline]="formQuoteType !== 'FIXED'"
                        (click)="formQuoteType = 'FIXED'"
                      >
                        Fixed Price
                      </button>
                      <button
                        type="button"
                        class="bb-btn bb-btn-sm"
                        [class.bb-btn-primary]="formQuoteType === 'MILESTONE'"
                        [class.bb-btn-outline]="formQuoteType !== 'MILESTONE'"
                        (click)="formQuoteType = 'MILESTONE'"
                      >
                        Milestone-based
                      </button>
                    </div>
                  }

                  <div class="bb-table-wrap">
                    <div class="bb-table-scroll">
                      <table class="bb-table bb-table--compact">
                        <thead>
                          <tr>
                            <th>Item</th>
                            <th class="w-24 text-right">Qty</th>
                            <th class="w-32 text-right">Unit price</th>
                            <th class="w-16"></th>
                          </tr>
                        </thead>
                        <tbody>
                          @for (item of formItems; track $index; let i = $index) {
                            <tr>
                              <td>
                                <input
                                  [id]="'vq-desc-' + i"
                                  class="bb-input"
                                  [(ngModel)]="item.description"
                                  [ngModelOptions]="{ standalone: true }"
                                  placeholder="e.g. Site visit"
                                  [attr.aria-label]="'Item description ' + (i + 1)"
                                />
                              </td>
                              <td>
                                <input
                                  [id]="'vq-qty-' + i"
                                  class="bb-input text-right"
                                  type="number"
                                  min="1"
                                  [(ngModel)]="item.quantity"
                                  [ngModelOptions]="{ standalone: true }"
                                  [attr.aria-label]="'Item quantity ' + (i + 1)"
                                />
                              </td>
                              <td>
                                <input
                                  [id]="'vq-price-' + i"
                                  class="bb-input text-right"
                                  type="number"
                                  min="0"
                                  [(ngModel)]="item.unitPrice"
                                  [ngModelOptions]="{ standalone: true }"
                                  [attr.aria-label]="'Item unit price ' + (i + 1)"
                                />
                              </td>
                              <td class="text-right">
                                <button
                                  type="button"
                                  class="bb-btn bb-btn-danger bb-btn-icon"
                                  (click)="removeFormItem(i)"
                                  [disabled]="formItems.length === 1"
                                  aria-label="Remove item"
                                  title="Remove item"
                                >
                                  <i class="material-icons-outlined">delete</i>
                                </button>
                              </td>
                            </tr>
                          }
                          <tr>
                            <td colspan="3" class="p-0">
                              <div class="bb-table-add-rule"></div>
                            </td>
                            <td class="text-right py-2 pl-0">
                              <button
                                type="button"
                                class="bb-btn bb-btn-secondary bb-btn-icon"
                                (click)="addFormItem()"
                                aria-label="Add item"
                                title="Add item"
                              >
                                <i class="material-icons-outlined">add</i>
                              </button>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div class="flex flex-wrap items-end gap-3 sm:justify-end">
                    <div class="w-28">
                      <label class="bb-label" for="vq-tax">Tax %</label>
                      <input
                        id="vq-tax"
                        class="bb-input"
                        type="number"
                        min="0"
                        [(ngModel)]="formTaxPercent"
                        [ngModelOptions]="{ standalone: true }"
                      />
                    </div>
                    <div class="w-28">
                      <label class="bb-label" for="vq-cur">Currency</label>
                      <input
                        id="vq-cur"
                        class="bb-input"
                        [(ngModel)]="formCurrency"
                        [ngModelOptions]="{ standalone: true }"
                      />
                    </div>
                    <div class="flex items-center gap-4 text-sm py-2">
                      <span>Subtotal: <strong>{{ formSubtotal | number: '1.0-2' }}</strong></span>
                      <span>Total: <strong>{{ formTotal | number: '1.0-2' }}</strong></span>
                    </div>
                  </div>

                  @if (respondingQuoteId === q._id && formQuoteType === 'MILESTONE') {
                    <div class="border-t border-base-300 pt-3 flex flex-col gap-2">
                      <h4 class="text-sm font-semibold">Milestones</h4>
                      @for (m of formMilestones; track $index; let i = $index) {
                        <div class="flex flex-col gap-1">
                          <div class="flex flex-col sm:flex-row sm:items-end gap-2">
                            <div class="w-full sm:flex-[2]">
                              <label class="bb-label" [attr.for]="'ms-title-' + i">Title</label>
                              <input
                                [id]="'ms-title-' + i"
                                class="bb-input"
                                [(ngModel)]="m.title"
                                [ngModelOptions]="{ standalone: true }"
                                placeholder="e.g. Documentation complete"
                              />
                            </div>
                            <div class="w-full sm:w-36">
                              <label class="bb-label" [attr.for]="'ms-type-' + i">Amount type</label>
                              <app-bb-select
                                [id]="'ms-type-' + i"
                                [(ngModel)]="m.amountType"
                                [ngModelOptions]="{ standalone: true }"
                                [options]="amountTypeOptions"
                              ></app-bb-select>
                            </div>
                            <div class="w-full sm:w-32">
                              <label class="bb-label" [attr.for]="'ms-amt-' + i">Amount</label>
                              <input
                                [id]="'ms-amt-' + i"
                                class="bb-input"
                                type="number"
                                min="0"
                                [(ngModel)]="m.amountValue"
                                [ngModelOptions]="{ standalone: true }"
                              />
                            </div>
                            <button
                              type="button"
                              class="bb-btn bb-btn-ghost bb-btn-icon text-error/60"
                              (click)="removeMilestone(i)"
                              aria-label="Remove milestone"
                              title="Remove milestone"
                            >
                              <i class="material-icons-outlined">delete</i>
                            </button>
                          </div>
                          @if (m.amountType === 'PERCENT') {
                            <div class="hidden sm:flex sm:items-start gap-2">
                              <div class="sm:flex-[2]" aria-hidden="true"></div>
                              <div class="sm:w-36" aria-hidden="true"></div>
                              <p class="sm:w-32 text-xs text-base-content/60">
                                ≈ {{ formCurrency }}
                                {{ milestoneComputedAmount(m) | number: '1.0-2' }}
                              </p>
                              <div class="bb-btn-icon invisible" aria-hidden="true"></div>
                            </div>
                            <p class="text-xs text-base-content/60 sm:hidden">
                              ≈ {{ formCurrency }}
                              {{ milestoneComputedAmount(m) | number: '1.0-2' }}
                            </p>
                          }
                        </div>
                      }
                      <!-- Aligned to the same right-hand column as the delete
                           buttons above, via matching (hidden) spacers — so
                           it always sits under/right of the last one. -->
                      <div class="flex flex-col sm:flex-row sm:items-center gap-2">
                        <div class="hidden sm:block sm:flex-[2]" aria-hidden="true"></div>
                        <div class="hidden sm:block sm:w-36" aria-hidden="true"></div>
                        <div class="hidden sm:block sm:w-32" aria-hidden="true"></div>
                        <button
                          type="button"
                          class="bb-btn bb-btn-outline bb-btn-sm shrink-0"
                          (click)="addMilestone()"
                        >
                          <i class="material-icons-outlined text-base">add</i> Add milestone
                        </button>
                      </div>
                      @if (milestonePercentTotal > 100) {
                        <p class="text-xs text-error">Milestone percentages cannot exceed 100%.</p>
                      }
                    </div>
                  }

                  <div class="flex gap-2 justify-end">
                    <button type="button" class="bb-btn bb-btn-ghost" (click)="closeAllForms()">
                      Cancel
                    </button>
                    @if (respondingQuoteId === q._id) {
                      <button
                        type="button"
                        class="bb-btn bb-btn-primary"
                        (click)="submitQuote(q)"
                        [disabled]="!canSubmitQuote() || formBusy"
                      >
                        {{ formBusy ? 'Submitting...' : 'Submit Quote' }}
                      </button>
                    } @else {
                      <button
                        type="button"
                        class="bb-btn bb-btn-primary"
                        (click)="reviseQuote(q)"
                        [disabled]="!canSubmitItemsOnly() || !isReviseFormDirty() || formBusy"
                      >
                        {{ formBusy ? 'Saving...' : 'Send Revised Quote' }}
                      </button>
                    }
                  </div>
                </div>
              }

              <!-- Decline form -->
              @if (decliningQuoteId === q._id) {
                <div class="mt-3 pt-3 border-t border-base-300 flex flex-col gap-2">
                  <label class="bb-label" for="decline-reason">Reason for declining</label>
                  <textarea
                    id="decline-reason"
                    class="bb-textarea"
                    rows="2"
                    [(ngModel)]="declineReason"
                    placeholder="e.g. Outside our service area / fully booked"
                  ></textarea>
                  <div class="flex gap-2 justify-end">
                    <button type="button" class="bb-btn bb-btn-ghost" (click)="closeAllForms()">
                      Cancel
                    </button>
                    <button
                      type="button"
                      class="bb-btn bb-btn-danger"
                      (click)="declineQuote(q)"
                      [disabled]="!declineReason.trim() || formBusy"
                    >
                      {{ formBusy ? 'Declining...' : 'Confirm Decline' }}
                    </button>
                  </div>
                </div>
              }
              </div>
            </div>
          }
        </div>
      </div>

      <!-- Documents -->
      <div class="bb-card mb-4">
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
                    <span class="text-sm font-medium truncate">{{ d.name || 'Document' }}</span>
                    @if (d.category) {
                      <span class="bb-chip bb-chip-neutral ml-2">{{ d.category }}</span>
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

      <!-- Invoices -->
      @if (hasAcceptedQuote()) {
        <div class="bb-card mb-4">
          <div class="bb-card-body">
            <h3 class="bb-section-title">Invoices</h3>
            <p class="text-sm text-base-content/60 mb-3">
              Once you've received a payout, create an invoice for your records — tag it to the
              specific milestone that was paid, or to the case itself for a fixed-price
              engagement.
            </p>

            @if (invoicesLoading) {
              <p class="text-sm text-base-content/60">Loading invoices...</p>
            } @else if (vendorInvoices.length > 0) {
              <ul class="divide-y divide-base-300 mb-3">
                @for (inv of vendorInvoices; track inv._id) {
                  <li class="py-2 flex flex-wrap items-center gap-2 text-sm">
                    <span class="font-medium">{{ inv.invoiceNumber }}</span>
                    @if (inv.milestoneId) {
                      <span class="bb-chip bb-chip-neutral">{{
                        milestoneTitleFor(inv.milestoneId)
                      }}</span>
                    } @else {
                      <span class="bb-chip bb-chip-neutral">Whole case</span>
                    }
                    <span>{{ inv.currency }} {{ formatAmount(inv.totalAmount) }}</span>
                    <span class="bb-chip" [ngClass]="invoiceChipClass(inv.status)">{{
                      invoiceStatusLabel(inv.status)
                    }}</span>
                    @if (inv.attachmentDocumentId; as docId) {
                      <button
                        class="bb-btn bb-btn-ghost bb-btn-icon"
                        (click)="downloadDocument(docId)"
                        aria-label="Download attachment"
                        title="Download attachment"
                      >
                        <i class="material-icons-outlined text-base">attach_file</i>
                      </button>
                    }
                  </li>
                }
              </ul>
            }

            @if (acceptedQuote(); as q) {
              @if (q.quoteType === 'MILESTONE') {
                @for (m of q.milestones; track m._id) {
                  @if (m.status !== 'PENDING' && !hasInvoiceForMilestone(m._id)) {
                    <div class="flex items-center gap-2 mb-2">
                      <span class="text-sm">{{ m.sequence }}. {{ m.title }} — not yet invoiced</span>
                      <button
                        class="bb-btn bb-btn-outline bb-btn-sm"
                        (click)="openInvoiceForm(q, m)"
                      >
                        Create Invoice
                      </button>
                    </div>
                  }
                }
              } @else if (!hasInvoiceForQuote(q._id)) {
                <div class="flex items-center gap-2 mb-2">
                  <span class="text-sm">No invoice created for this case yet</span>
                  <button class="bb-btn bb-btn-outline bb-btn-sm" (click)="openInvoiceForm(q)">
                    Create Invoice
                  </button>
                </div>
              }

              @if (invoiceFormOpenFor) {
                <div class="mt-3 pt-3 border-t border-base-300 flex flex-col gap-3">
                  <div class="bb-table-wrap">
                    <div class="bb-table-scroll">
                      <table class="bb-table bb-table--compact">
                        <thead>
                          <tr>
                            <th>Description</th>
                            <th class="w-24 text-right">Qty</th>
                            <th class="w-32 text-right">Unit price</th>
                            <th class="w-16"></th>
                          </tr>
                        </thead>
                        <tbody>
                          @for (item of invoiceFormItems; track $index; let i = $index) {
                            <tr>
                              <td>
                                <input
                                  [id]="'inv-desc-' + i"
                                  class="bb-input"
                                  [(ngModel)]="item.description"
                                  [ngModelOptions]="{ standalone: true }"
                                  placeholder="e.g. Documentation services"
                                  [attr.aria-label]="'Item description ' + (i + 1)"
                                />
                              </td>
                              <td>
                                <input
                                  [id]="'inv-qty-' + i"
                                  class="bb-input text-right"
                                  type="number"
                                  min="1"
                                  [(ngModel)]="item.quantity"
                                  [ngModelOptions]="{ standalone: true }"
                                  [attr.aria-label]="'Item quantity ' + (i + 1)"
                                />
                              </td>
                              <td>
                                <input
                                  [id]="'inv-price-' + i"
                                  class="bb-input text-right"
                                  type="number"
                                  min="0"
                                  [(ngModel)]="item.unitPrice"
                                  [ngModelOptions]="{ standalone: true }"
                                  [attr.aria-label]="'Item unit price ' + (i + 1)"
                                />
                              </td>
                              <td class="text-right">
                                <button
                                  type="button"
                                  class="bb-btn bb-btn-danger bb-btn-icon"
                                  (click)="removeInvoiceFormItem(i)"
                                  [disabled]="invoiceFormItems.length === 1"
                                  aria-label="Remove item"
                                  title="Remove item"
                                >
                                  <i class="material-icons-outlined">delete</i>
                                </button>
                              </td>
                            </tr>
                          }
                          <tr>
                            <td colspan="3" class="p-0">
                              <div class="bb-table-add-rule"></div>
                            </td>
                            <td class="text-right py-2 pl-0">
                              <button
                                type="button"
                                class="bb-btn bb-btn-secondary bb-btn-icon"
                                (click)="addInvoiceFormItem()"
                                aria-label="Add item"
                                title="Add item"
                              >
                                <i class="material-icons-outlined">add</i>
                              </button>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div class="flex flex-wrap items-end gap-3 sm:justify-end">
                    <div class="w-28">
                      <label class="bb-label" for="inv-gst">GST %</label>
                      <input
                        id="inv-gst"
                        class="bb-input"
                        type="number"
                        min="0"
                        [(ngModel)]="invoiceFormGstRate"
                        [ngModelOptions]="{ standalone: true }"
                      />
                    </div>
                    <div class="flex items-center gap-4 text-sm py-2">
                      <span
                        >Subtotal:
                        <strong>{{ invoiceFormSubtotal | number: '1.0-2' }}</strong></span
                      >
                      <span
                        >Total:
                        <strong>{{ invoiceFormTotal | number: '1.0-2' }}</strong></span
                      >
                    </div>
                  </div>

                  <div class="pt-3 border-t border-base-300">
                    <label class="bb-label" for="inv-attachment"
                      >Attach a bill or receipt
                      <span class="normal-case text-base-content/50">(optional — image, PDF or doc)</span></label
                    >
                    <div class="flex flex-col sm:flex-row sm:items-center gap-3">
                      <input
                        id="inv-attachment"
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                        class="file-input file-input-bordered w-full sm:max-w-xs"
                        (change)="onInvoiceAttachmentSelected($event)"
                      />
                      @if (invoiceAttachmentFile) {
                        <span class="text-sm text-base-content/60">{{ invoiceAttachmentFile.name }}</span>
                      }
                    </div>
                  </div>

                  <div class="flex gap-2 justify-end">
                    <button type="button" class="bb-btn bb-btn-ghost" (click)="closeInvoiceForm()">
                      Cancel
                    </button>
                    <button
                      type="button"
                      class="bb-btn bb-btn-primary"
                      (click)="submitVendorInvoice(q)"
                      [disabled]="!canSubmitInvoice() || invoiceFormBusy"
                    >
                      {{ invoiceFormBusy ? 'Creating...' : 'Create Invoice' }}
                    </button>
                  </div>
                </div>
              }
            } @else {
              <p class="text-sm text-base-content/60">No accepted quote on this case yet.</p>
            }
          </div>
        </div>
      }

      <!-- Payments -->
      @if (hasAcceptedQuote()) {
        <div class="bb-card mb-4">
          <div class="bb-card-body">
            <h3 class="bb-section-title">Payments</h3>
            <p class="text-sm text-base-content/60 mb-3">
              Request payment from the case manager once a milestone is approved by the
              client, or once the case is closed for a fixed-price engagement. This is
              settled manually, outside the app.
            </p>

            @if (paymentsLoading) {
              <p class="text-sm text-base-content/60">Loading payments...</p>
            } @else if (vendorPayments.length > 0) {
              <ul class="divide-y divide-base-300 mb-3">
                @for (p of vendorPayments; track p._id) {
                  <li class="py-2 flex flex-wrap items-center gap-2 text-sm">
                    @if (p.milestoneId) {
                      <span class="bb-chip bb-chip-neutral">{{
                        milestoneTitleFor(p.milestoneId)
                      }}</span>
                    } @else {
                      <span class="bb-chip bb-chip-neutral">Whole case</span>
                    }
                    <span class="font-medium"
                      >{{ p.currency | uppercase }} {{ formatAmount(p.amountInPaise / 100) }}</span
                    >
                    <span class="bb-chip" [ngClass]="paymentChipClass(p.status)">{{
                      p.status | titlecase
                    }}</span>
                    <span class="text-xs text-base-content/70">{{ p.description }}</span>
                  </li>
                }
              </ul>
            }

            @if (acceptedQuote(); as q) {
              @if (q.milestones && q.milestones.length > 0) {
                @for (m of q.milestones; track m._id) {
                  @if (m.status === 'CLIENT_APPROVED' && !hasPaymentForMilestone(m._id)) {
                    <div class="flex items-center gap-2 mb-2">
                      <span class="text-sm">
                        {{
                          q.quoteType === 'MILESTONE' ? m.sequence + '. ' + m.title : 'Work approved by client'
                        }}
                        — not yet requested
                      </span>
                      <button
                        class="bb-btn bb-btn-outline bb-btn-sm"
                        (click)="openPaymentRequestForm(m)"
                      >
                        Request Payment
                      </button>
                    </div>
                  }
                }
              } @else if (caseDetail.status === 'CLOSED' && !hasPaymentForQuote()) {
                <div class="flex items-center gap-2 mb-2">
                  <span class="text-sm">Case closed — payment not yet requested</span>
                  <button class="bb-btn bb-btn-outline bb-btn-sm" (click)="openPaymentRequestForm()">
                    Request Payment
                  </button>
                </div>
              }

              @if (paymentRequestFormOpenFor) {
                <div class="mt-3 pt-3 border-t border-base-300 flex flex-col gap-3">
                  <div class="flex flex-wrap gap-3">
                    <div class="w-40">
                      <label class="bb-label" for="pay-req-amount">Amount ({{ q.currency }})</label>
                      <input
                        id="pay-req-amount"
                        class="bb-input"
                        type="number"
                        min="1"
                        [(ngModel)]="paymentRequestAmount"
                        [ngModelOptions]="{ standalone: true }"
                      />
                    </div>
                    <div class="flex-1 min-w-[12rem]">
                      <label class="bb-label" for="pay-req-desc">Note to case manager</label>
                      <input
                        id="pay-req-desc"
                        class="bb-input"
                        [(ngModel)]="paymentRequestDescription"
                        [ngModelOptions]="{ standalone: true }"
                        placeholder="e.g. Milestone 2 completed and approved"
                      />
                    </div>
                  </div>
                  <div class="flex gap-2 justify-end">
                    <button class="bb-btn bb-btn-ghost" (click)="cancelPaymentRequestForm()">
                      Cancel
                    </button>
                    <button
                      class="bb-btn bb-btn-primary"
                      (click)="submitPaymentRequest()"
                      [disabled]="!canSubmitPaymentRequest() || paymentRequestBusy"
                    >
                      {{ paymentRequestBusy ? 'Sending...' : 'Send Request' }}
                    </button>
                  </div>
                </div>
              }
            } @else {
              <p class="text-sm text-base-content/60">No accepted quote on this case yet.</p>
            }
          </div>
        </div>
      }

    }

    @if (!loading && !caseDetail) {
      <div class="bb-card">
        <div class="bb-empty">
          <div class="bb-empty-icon"><i class="material-icons-outlined">error_outline</i></div>
          <p class="bb-empty-title">Could not load this case</p>
        </div>
      </div>
    }
  `,
  styles: [
    `
      /* Vendor pre-quote Q&A, styled as a two-party chat thread — same
         visual language as the case manager's cm-qa-* thread, with self/
         other flipped: here the vendor (viewing this page) is "you". */
      .vc-qa-thread {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        padding: 0.75rem;
        margin-top: 0.75rem;
        margin-bottom: 0.75rem;
        border-radius: 0.75rem;
        background: var(--ivory-soft, #faf6ed);
        border: 1px solid var(--ivory-mute, #ddd5c5);
      }
      .vc-qa-bubble {
        max-width: 85%;
        padding: 0.5rem 0.75rem;
        border-radius: 0.875rem;
      }
      .vc-qa-bubble--you {
        align-self: flex-end;
        background: var(--color-primary, #1f4e79);
        border-bottom-right-radius: 0.25rem;
      }
      .vc-qa-bubble--you .vc-qa-bubble-label {
        color: rgba(255, 255, 255, 0.75);
      }
      .vc-qa-bubble--you .vc-qa-bubble-text {
        color: #fff;
      }
      .vc-qa-bubble--cm {
        align-self: flex-start;
        background: var(--field-bg, #fff);
        border: 1px solid var(--field-border);
        border-bottom-left-radius: 0.25rem;
      }
      .vc-qa-bubble-label {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        font-size: 0.6875rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--ink-60);
        margin-bottom: 0.2rem;
      }
      .vc-qa-bubble-text {
        font-size: 0.875rem;
        line-height: 1.4;
        margin: 0;
        white-space: pre-wrap;
        color: var(--ink);
      }
      .vc-qa-waiting {
        align-self: flex-start;
        font-size: 0.75rem;
        color: var(--ink-60, #6b7280);
        font-style: italic;
        margin: 0;
      }

      /* "Quote Requested" needs to read as an open action item, not a
         passive status label — the default subtle bb-chip-warning tint
         nearly disappeared against the header strip's own tinted
         background. */
      .vc-chip--invited {
        background: var(--saffron, #e87817);
        color: #fff;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
      }
    `,
  ],
})
export class VendorCaseDetailComponent implements OnInit {
  caseDetail: CaseDetail | null = null;
  loading = true;

  quotes: Quote[] = [];
  quotesLoading = false;

  respondingQuoteId: string | null = null;
  decliningQuoteId: string | null = null;
  revisingQuoteId: string | null = null;
  deletingQuoteId: string | null = null;
  declineReason = '';
  formBusy = false;
  milestoneBusyId: string | null = null;

  requestInfoFormId: string | null = null;
  requestInfoNote = '';
  requestInfoBusy = false;
  vendorReplyFormId: string | null = null;
  vendorReplyText = '';
  vendorReplyBusy = false;

  formQuoteType: QuoteType = 'FIXED';
  formItems: QuoteItemForm[] = [{ description: '', quantity: 1, unitPrice: 0 }];
  formTaxPercent = 18;
  formCurrency = 'INR';
  formMilestones: MilestoneForm[] = [];
  // UI-only: snapshot of the revise form as it was opened, so "Send Revised
  // Quote" only lights up once something actually changed from what's
  // already submitted — re-sending an untouched form is a no-op.
  private reviseFormSnapshot = '';

  documents: DocumentRecord[] = [];
  documentsLoading = false;
  uploadCategories = ['IDENTITY', 'PROPERTY', 'FINANCIAL', 'LEGAL', 'AGREEMENT', 'OTHER'];
  readonly amountTypeOptions = [
    { value: 'PERCENT', label: '% of total' },
    { value: 'FIXED', label: 'Fixed amount' },
  ];

  uploadCategoryOptions(): { value: string; label: string }[] {
    return this.uploadCategories.map((c) => ({ value: c, label: c }));
  }
  uploadCategory = 'OTHER';
  uploadFile: File | null = null;
  uploading = false;
  readonly allowedDocAccept = ALLOWED_DOCUMENT_FILE_ACCEPT;

  vendorInvoices: VendorInvoice[] = [];
  invoicesLoading = false;
  // Set to the milestone _id being invoiced, or the string 'CASE' for a
  // fixed-price quote invoiced against the whole case — null when the form
  // is closed.
  invoiceFormOpenFor: string | null = null;
  invoiceFormItems: InvoiceItemForm[] = [{ description: '', quantity: 1, unitPrice: 0 }];
  invoiceFormGstRate = 0;
  invoiceFormBusy = false;
  invoiceAttachmentFile: File | null = null;

  vendorPayments: Payment[] = [];
  paymentsLoading = false;
  // Set to the milestone _id being requested, or the string 'CASE' for a
  // fixed-price quote requested against the whole case — null when the
  // form is closed. Mirrors invoiceFormOpenFor above.
  paymentRequestFormOpenFor: string | null = null;
  paymentRequestAmount: number | null = null;
  paymentRequestDescription = '';
  paymentRequestBusy = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: ApiService,
    private documentsService: DocumentsService,
    private toast: ToastService,
    private confirmDialog: ConfirmDialogService,
    private pageTitleService: PageTitleService,
    private paymentsService: PaymentsService,
  ) {}

  ngOnInit(): void {
    const routeId = this.route.snapshot.paramMap.get('id') ?? '';
    this.api.get<CaseDetail>(`/cases/${routeId}`).subscribe({
      next: (c) => {
        this.caseDetail = c;
        this.pageTitleService.set(c.caseNumber + ' — My Jobs');
        this.loading = false;
        this.loadQuotes(c._id);
        this.loadDocuments(c._id);
        this.loadVendorInvoices(c._id);
        this.loadVendorPayments(c._id);
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  goBack(): void {
    this.router.navigate(['/vendor/jobs']);
  }

  getPersonName(ref: PopulatedRef | string | null | undefined): string {
    if (!ref) return '—';
    if (typeof ref === 'string') return ref;
    if (ref.name) return ref.name.trim();
    return ref.email ?? '—';
  }

  // ---------- Quotes ----------
  loadQuotes(caseId: string): void {
    this.quotesLoading = true;
    this.api.get<Quote[]>(`/quotes/case/${caseId}`).subscribe({
      next: (qs) => {
        this.quotes = qs ?? [];
        this.quotesLoading = false;
      },
      error: () => {
        this.quotes = [];
        this.quotesLoading = false;
      },
    });
  }

  anyQuoteHasUpdate(): boolean {
    return this.quotes.some((q) => q.hasUpdate);
  }

  markQuoteSeen(q: Quote): void {
    if (!q.hasUpdate) return;
    q.hasUpdate = false;
    this.api.patch(`/quotes/${q._id}/seen`, {}).subscribe({ error: () => {} });
  }

  hasAcceptedQuote(): boolean {
    return this.quotes.some((q) => q.status === 'ACCEPTED');
  }

  acceptedQuote(): Quote | undefined {
    return this.quotes.find((q) => q.status === 'ACCEPTED');
  }

  quoteStatusLabel(s: QuoteStatus): string {
    return QUOTE_STATUS_LABEL[s] ?? s;
  }

  // Once a quote has left INVITED, its full breakdown (items, milestones) is
  // relevant to the vendor regardless of what happens to it next.
  // "Submitted" in the sense of "has numbers worth showing" — true once
  // status has moved past INVITED, but also true for an INVITED quote that's
  // back for another round (requestRevision() resets status to INVITED but
  // deliberately leaves `items` alone) so the vendor's previous numbers
  // don't visually vanish just because the CM asked for a revision.
  isSubmittedQuote(q: Quote): boolean {
    return q.status !== 'INVITED' || !!(q.items && q.items.length > 0);
  }

  // Once this vendor is the one assigned to the case, the underlying
  // vendor-facing numbers are locked in — further changes go through
  // milestone/invoicing, not negotiation/revision/delete.
  isThisVendorAssigned(q: Quote): boolean {
    return !!q.vendorId?._id && this.caseDetail?.vendorId?._id === q.vendorId._id;
  }

  // Amount can still change post-submission via negotiation, so the vendor
  // can revise up until the quote is finalized (accepted/rejected/etc) — and
  // an INVITED quote that already has items is a CM-requested revision, not
  // a fresh invite, so it's revisable too (see isSubmittedQuote above).
  isRevisableQuote(q: Quote): boolean {
    if (this.isThisVendorAssigned(q)) return false;
    return (
      q.status === 'DRAFT' ||
      q.status === 'SENT' ||
      q.status === 'NEGOTIATING' ||
      (q.status === 'INVITED' && !!(q.items && q.items.length > 0))
    );
  }

  // Matches the backend's deletableStatuses for VENDOR — a submitted quote can
  // be withdrawn before the client acts on it, or cleared out once rejected.
  isDeletableQuote(q: Quote): boolean {
    if (this.isThisVendorAssigned(q)) return false;
    return q.status === 'DRAFT' || q.status === 'SENT' || q.status === 'REJECTED';
  }

  async deleteQuote(q: Quote): Promise<void> {
    if (this.deletingQuoteId) return;
    const ok = await this.confirmDialog.confirm(
      'Delete this quote? You can submit a new one afterwards.',
      { title: 'Delete quote', confirmText: 'Delete', danger: true },
    );
    if (!ok) return;
    this.deletingQuoteId = q._id;
    // The backend resets a deleted DRAFT/SENT/REJECTED quote back to INVITED
    // rather than dropping the row, so the vendor can submit again without
    // needing the CM to re-invite them — update the entry in place, don't remove it.
    this.api.delete<Quote>(`/quotes/${q._id}`).subscribe({
      next: (updated) => {
        this.deletingQuoteId = null;
        this.quotes = this.quotes.map((qq) => (qq._id === q._id ? updated : qq));
        this.toast.success('Quote deleted — you can submit a new one now');
      },
      error: (err) => {
        this.deletingQuoteId = null;
        this.toast.error(extractApiError(err, 'Failed to delete quote').message);
      },
    });
  }

  milestoneAmountLabel(q: Quote, m: QuoteMilestone): string {
    if (typeof m.computedAmount === 'number') {
      return `${q.currency} ${this.formatAmount(m.computedAmount)}`;
    }
    if (m.amountType === 'PERCENT') {
      return `${m.amountValue}% of total`;
    }
    return `${q.currency} ${this.formatAmount(m.amountValue)}`;
  }

  formatAmount(n: number): string {
    return (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  quoteChipClass(status: QuoteStatus): string {
    switch (status) {
      case 'INVITED':
        return 'bb-chip-warning';
      case 'DRAFT':
        return 'bb-chip-neutral';
      case 'SENT':
      case 'NEGOTIATING':
        return 'bb-chip-info';
      case 'ACCEPTED':
        return 'bb-chip-success';
      case 'REJECTED':
        return 'bb-chip-danger';
      case 'EXPIRED':
        return 'bb-chip-neutral';
      case 'DECLINED':
        return 'bb-chip-danger';
      default:
        return 'bb-chip-neutral';
    }
  }

  milestoneStatusLabel(status: MilestoneStatus): string {
    switch (status) {
      case 'PENDING':
        return 'Pending';
      case 'VENDOR_MARKED_DONE':
        return 'Marked done — awaiting client confirmation';
      case 'CLIENT_APPROVED':
        return 'Client confirmed — awaiting payment';
      case 'PAID':
        return 'Paid';
      default:
        return status;
    }
  }

  milestoneChipClass(status: MilestoneStatus): string {
    switch (status) {
      case 'PENDING':
        return 'bb-chip-neutral';
      case 'VENDOR_MARKED_DONE':
        return 'bb-chip-warning';
      case 'CLIENT_APPROVED':
        return 'bb-chip-info';
      case 'PAID':
        return 'bb-chip-success';
      default:
        return 'bb-chip-neutral';
    }
  }

  statusChipClass(status: string): string {
    const s = (status || '').toLowerCase();
    if (s.includes('complete') || s.includes('closed') || s.includes('resolved'))
      return 'bb-chip-success';
    if (s.includes('progress') || s.includes('active') || s.includes('assigned'))
      return 'bb-chip-info';
    if (s.includes('pending') || s.includes('wait') || s.includes('quote'))
      return 'bb-chip-warning';
    if (s.includes('cancel') || s.includes('reject') || s.includes('fail')) return 'bb-chip-danger';
    return 'bb-chip-neutral';
  }

  // ---------- Form state ----------
  closeAllForms(): void {
    this.respondingQuoteId = null;
    this.decliningQuoteId = null;
    this.revisingQuoteId = null;
    this.declineReason = '';
    this.requestInfoFormId = null;
    this.requestInfoNote = '';
    this.vendorReplyFormId = null;
    this.vendorReplyText = '';
  }

  openSubmitForm(q: Quote): void {
    this.closeAllForms();
    this.respondingQuoteId = q._id;
    this.formQuoteType = 'FIXED';
    this.formItems = [{ description: '', quantity: 1, unitPrice: 0 }];
    this.formTaxPercent = 18;
    this.formCurrency = q.currency || 'INR';
    this.formMilestones = [];
  }

  openDeclineForm(q: Quote): void {
    this.closeAllForms();
    this.decliningQuoteId = q._id;
  }

  openReviseForm(q: Quote): void {
    this.closeAllForms();
    this.revisingQuoteId = q._id;
    this.formItems = (q.items && q.items.length > 0
      ? q.items
      : [{ description: '', quantity: 1, unitPrice: 0 }]
    ).map((it) => ({ ...it }));
    this.formTaxPercent = 18;
    this.formCurrency = q.currency || 'INR';
    this.reviseFormSnapshot = this.reviseFormSnapshotNow();
  }

  private reviseFormSnapshotNow(): string {
    return JSON.stringify({
      items: this.formItems.map((it) => ({
        description: it.description,
        quantity: Number(it.quantity) || 0,
        unitPrice: Number(it.unitPrice) || 0,
      })),
      tax: Number(this.formTaxPercent) || 0,
      currency: this.formCurrency,
    });
  }

  // "Send Revised Quote" only lights up once the form actually differs from
  // what was already submitted — re-sending an unchanged revision is a no-op.
  isReviseFormDirty(): boolean {
    return this.reviseFormSnapshotNow() !== this.reviseFormSnapshot;
  }

  addFormItem(): void {
    this.formItems.push({ description: '', quantity: 1, unitPrice: 0 });
  }

  removeFormItem(i: number): void {
    if (this.formItems.length <= 1) return;
    this.formItems.splice(i, 1);
  }

  itemTotal(item: QuoteItemForm): number {
    return (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
  }

  get formSubtotal(): number {
    return this.formItems.reduce((sum, it) => sum + this.itemTotal(it), 0);
  }

  get formTaxAmount(): number {
    return this.formSubtotal * ((Number(this.formTaxPercent) || 0) / 100);
  }

  get formTotal(): number {
    return this.formSubtotal + this.formTaxAmount;
  }

  addMilestone(): void {
    this.formMilestones.push({ title: '', amountType: 'PERCENT', amountValue: 0 });
  }

  removeMilestone(i: number): void {
    this.formMilestones.splice(i, 1);
  }

  get milestonePercentTotal(): number {
    return this.formMilestones
      .filter((m) => m.amountType === 'PERCENT')
      .reduce((sum, m) => sum + (Number(m.amountValue) || 0), 0);
  }

  milestoneComputedAmount(m: MilestoneForm): number {
    if (m.amountType !== 'PERCENT') return Number(m.amountValue) || 0;
    return this.formTotal * ((Number(m.amountValue) || 0) / 100);
  }

  private itemsValid(): boolean {
    return (
      this.formItems.length > 0 &&
      this.formItems.every(
        (it) => it.description.trim().length > 0 && Number(it.quantity) > 0 && Number(it.unitPrice) > 0,
      )
    );
  }

  canSubmitItemsOnly(): boolean {
    return this.itemsValid();
  }

  canSubmitQuote(): boolean {
    if (!this.itemsValid()) return false;
    if (this.formQuoteType === 'MILESTONE') {
      if (this.formMilestones.length === 0) return false;
      const milestonesValid = this.formMilestones.every(
        (m) => m.title.trim().length > 0 && Number(m.amountValue) > 0,
      );
      if (!milestonesValid) return false;
      if (this.milestonePercentTotal > 100) return false;
    }
    return true;
  }

  submitQuote(q: Quote): void {
    if (!this.canSubmitQuote() || this.formBusy) return;
    this.formBusy = true;
    const body: {
      quoteType: QuoteType;
      items: QuoteItem[];
      taxPercent: number;
      currency: string;
      milestones?: MilestoneForm[];
    } = {
      quoteType: this.formQuoteType,
      items: this.formItems.map((it) => ({
        description: it.description.trim(),
        quantity: Number(it.quantity),
        unitPrice: Number(it.unitPrice),
      })),
      taxPercent: Number(this.formTaxPercent) || 0,
      currency: (this.formCurrency || 'INR').trim() || 'INR',
    };
    if (this.formQuoteType === 'MILESTONE') {
      body.milestones = this.formMilestones.map((m) => ({
        title: m.title.trim(),
        amountType: m.amountType,
        amountValue: Number(m.amountValue),
      }));
    }
    this.api.post<Quote>(`/quotes/${q._id}/submit`, body).subscribe({
      next: () => {
        this.formBusy = false;
        this.closeAllForms();
        if (this.caseDetail) this.loadQuotes(this.caseDetail._id);
        this.toast.success('Quote submitted');
      },
      error: (err) => {
        this.formBusy = false;
        this.toast.error(extractApiError(err, 'Failed to submit quote').message);
      },
    });
  }

  declineQuote(q: Quote): void {
    if (!this.declineReason.trim() || this.formBusy) return;
    this.formBusy = true;
    this.api.post<Quote>(`/quotes/${q._id}/decline`, { reason: this.declineReason.trim() }).subscribe({
      next: () => {
        this.formBusy = false;
        this.closeAllForms();
        if (this.caseDetail) this.loadQuotes(this.caseDetail._id);
        this.toast.success('Quote request declined');
      },
      error: (err) => {
        this.formBusy = false;
        this.toast.error(extractApiError(err, 'Failed to decline quote').message);
      },
    });
  }

  openRequestInfoForm(q: Quote): void {
    this.closeAllForms();
    this.requestInfoFormId = q._id;
    this.requestInfoNote = '';
  }

  cancelRequestInfo(): void {
    this.requestInfoFormId = null;
    this.requestInfoNote = '';
  }

  submitRequestInfo(q: Quote): void {
    if (!this.requestInfoNote.trim() || this.requestInfoBusy) return;
    this.requestInfoBusy = true;
    this.api
      .post<Quote>(`/quotes/${q._id}/request-info`, { note: this.requestInfoNote.trim() })
      .subscribe({
        next: () => {
          this.requestInfoBusy = false;
          this.cancelRequestInfo();
          if (this.caseDetail) this.loadQuotes(this.caseDetail._id);
          this.toast.success('Question sent to the case manager');
        },
        error: (err) => {
          this.requestInfoBusy = false;
          this.toast.error(extractApiError(err, 'Failed to send question').message);
        },
      });
  }

  openVendorReplyForm(q: Quote): void {
    this.closeAllForms();
    this.vendorReplyFormId = q._id;
    this.vendorReplyText = q.vendorNegotiationReply ?? '';
  }

  cancelVendorReply(): void {
    this.vendorReplyFormId = null;
    this.vendorReplyText = '';
  }

  submitVendorReply(q: Quote): void {
    if (!this.vendorReplyText.trim() || this.vendorReplyBusy) return;
    this.vendorReplyBusy = true;
    this.api
      .patch<Quote>(`/quotes/${q._id}/reply-vendor-negotiation`, {
        reply: this.vendorReplyText.trim(),
      })
      .subscribe({
        next: () => {
          this.vendorReplyBusy = false;
          this.cancelVendorReply();
          if (this.caseDetail) this.loadQuotes(this.caseDetail._id);
          this.toast.success('Reply sent to the case manager');
        },
        error: (err) => {
          this.vendorReplyBusy = false;
          this.toast.error(extractApiError(err, 'Failed to send reply').message);
        },
      });
  }

  private extractId(ref: PopulatedRef | string | null | undefined): string | null {
    if (!ref) return null;
    return typeof ref === 'string' ? ref : (ref._id ?? null);
  }

  reviseQuote(q: Quote): void {
    if (!this.canSubmitItemsOnly() || !this.isReviseFormDirty() || this.formBusy || !this.caseDetail) return;
    const items = this.formItems.map((it) => ({
      description: it.description.trim(),
      quantity: Number(it.quantity),
      unitPrice: Number(it.unitPrice),
    }));
    const taxPercent = Number(this.formTaxPercent) || 0;
    const currency = (this.formCurrency || 'INR').trim() || 'INR';
    this.formBusy = true;

    // A quote sent back by the CM for revision (requestRevision()) resets
    // status to INVITED — the same "please respond to this invite" state as
    // a fresh invite — so it resubmits through /submit like any other
    // invite response. /revise is a different, self-initiated flow that
    // only applies to an already-live DRAFT/SENT/NEGOTIATING quote (and
    // enforces its own 2-revision cap, which doesn't apply here).
    if (q.status === 'INVITED') {
      this.api
        .post<Quote>(`/quotes/${q._id}/submit`, { quoteType: 'FIXED', items, taxPercent, currency })
        .subscribe({
          next: () => {
            this.formBusy = false;
            this.closeAllForms();
            if (this.caseDetail) this.loadQuotes(this.caseDetail._id);
            this.toast.success('Revised quote sent');
          },
          error: (err) => {
            this.formBusy = false;
            this.toast.error(extractApiError(err, 'Failed to revise quote').message);
          },
        });
      return;
    }

    const vendorId = q.vendorId?._id;
    const caseManagerId = this.extractId(this.caseDetail.caseManagerId);
    const clientId = this.extractId(this.caseDetail.clientId);
    if (!vendorId || !caseManagerId || !clientId) {
      this.formBusy = false;
      this.toast.error('Missing vendor / case manager / client reference');
      return;
    }
    const body = { caseId: this.caseDetail._id, vendorId, caseManagerId, clientId, items, taxPercent, currency };
    this.api.post<Quote>(`/quotes/${q._id}/revise`, body).subscribe({
      next: () => {
        this.formBusy = false;
        this.closeAllForms();
        if (this.caseDetail) this.loadQuotes(this.caseDetail._id);
        this.toast.success('Revised quote sent');
      },
      error: (err) => {
        this.formBusy = false;
        this.toast.error(extractApiError(err, 'Failed to revise quote').message);
      },
    });
  }

  markMilestoneComplete(q: Quote, m: QuoteMilestone): void {
    if (!m._id || this.milestoneBusyId) return;
    this.milestoneBusyId = m._id;
    this.api.patch<Quote>(`/quotes/${q._id}/milestones/${m._id}/complete`, {}).subscribe({
      next: (updated) => {
        this.milestoneBusyId = null;
        this.quotes = this.quotes.map((qq) => (qq._id === q._id ? updated : qq));
        this.toast.success('Milestone marked complete — awaiting CM approval');
      },
      error: (err) => {
        this.milestoneBusyId = null;
        this.toast.error(extractApiError(err, 'Failed to mark milestone complete').message);
      },
    });
  }

  // ---------- Invoices ----------
  loadVendorInvoices(caseId: string): void {
    this.invoicesLoading = true;
    this.api.get<VendorInvoice[]>(`/vendor-invoices/case/${caseId}`).subscribe({
      next: (invs) => {
        this.vendorInvoices = invs ?? [];
        this.invoicesLoading = false;
      },
      error: () => {
        this.vendorInvoices = [];
        this.invoicesLoading = false;
      },
    });
  }

  // ---------- Payments ----------
  loadVendorPayments(caseId: string): void {
    this.paymentsLoading = true;
    this.paymentsService.getPaymentsByCase(caseId).subscribe({
      next: (rows) => {
        this.vendorPayments = rows ?? [];
        this.paymentsLoading = false;
      },
      error: () => {
        this.vendorPayments = [];
        this.paymentsLoading = false;
      },
    });
  }

  hasPaymentForMilestone(milestoneId: string | undefined): boolean {
    if (!milestoneId) return false;
    return this.vendorPayments.some((p) => p.milestoneId === milestoneId);
  }

  hasPaymentForQuote(): boolean {
    return this.vendorPayments.some((p) => !p.milestoneId);
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

  openPaymentRequestForm(milestone?: QuoteMilestone): void {
    this.paymentRequestFormOpenFor = milestone?._id ?? 'CASE';
    this.paymentRequestAmount =
      milestone?.computedAmount ?? this.acceptedQuote()?.totalAmount ?? null;
    this.paymentRequestDescription = milestone
      ? `Payment for milestone: ${milestone.title}`
      : 'Payment for completed case';
  }

  cancelPaymentRequestForm(): void {
    this.paymentRequestFormOpenFor = null;
    this.paymentRequestAmount = null;
    this.paymentRequestDescription = '';
  }

  canSubmitPaymentRequest(): boolean {
    return !!this.paymentRequestAmount && this.paymentRequestAmount > 0 && !!this.paymentRequestDescription.trim();
  }

  submitPaymentRequest(): void {
    if (!this.canSubmitPaymentRequest() || this.paymentRequestBusy || !this.caseDetail) return;
    this.paymentRequestBusy = true;
    const milestoneId =
      this.paymentRequestFormOpenFor && this.paymentRequestFormOpenFor !== 'CASE'
        ? this.paymentRequestFormOpenFor
        : undefined;
    this.paymentsService
      .requestVendorPayment({
        caseId: this.caseDetail._id,
        amountInPaise: Math.round((this.paymentRequestAmount ?? 0) * 100),
        description: this.paymentRequestDescription.trim(),
        milestoneId,
      })
      .subscribe({
        next: (payment) => {
          this.paymentRequestBusy = false;
          this.vendorPayments = [payment, ...this.vendorPayments];
          this.toast.success('Payment requested from case manager');
          this.cancelPaymentRequestForm();
        },
        error: (err) => {
          this.paymentRequestBusy = false;
          this.toast.error(extractApiError(err, 'Failed to request payment').message);
        },
      });
  }

  hasInvoiceForMilestone(milestoneId: string | undefined): boolean {
    if (!milestoneId) return false;
    return this.vendorInvoices.some((inv) => inv.milestoneId === milestoneId);
  }

  hasInvoiceForQuote(quoteId: string): boolean {
    return this.vendorInvoices.some((inv) => inv.quoteId === quoteId && !inv.milestoneId);
  }

  milestoneTitleFor(milestoneId: string | undefined): string {
    if (!milestoneId) return '';
    for (const q of this.quotes) {
      const m = q.milestones?.find((mm) => mm._id === milestoneId);
      if (m) return m.title;
    }
    return 'Milestone';
  }

  invoiceStatusLabel(status: VendorInvoiceStatus): string {
    return status === 'ACKNOWLEDGED' ? 'Acknowledged' : 'Submitted';
  }

  invoiceChipClass(status: VendorInvoiceStatus): string {
    return status === 'ACKNOWLEDGED' ? 'bb-chip-success' : 'bb-chip-info';
  }

  openInvoiceForm(q: Quote, milestone?: QuoteMilestone): void {
    this.invoiceFormOpenFor = milestone?._id ?? 'CASE';
    this.invoiceFormItems = [
      {
        description: milestone ? milestone.title : q.items?.[0]?.description || 'Service',
        quantity: 1,
        unitPrice: milestone?.computedAmount ?? q.totalAmount ?? 0,
      },
    ];
    this.invoiceFormGstRate = 0;
  }

  closeInvoiceForm(): void {
    this.invoiceFormOpenFor = null;
    this.invoiceFormItems = [{ description: '', quantity: 1, unitPrice: 0 }];
    this.invoiceFormGstRate = 0;
    this.invoiceAttachmentFile = null;
  }

  onInvoiceAttachmentSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.invoiceAttachmentFile = input.files && input.files.length > 0 ? input.files[0] : null;
  }

  addInvoiceFormItem(): void {
    this.invoiceFormItems.push({ description: '', quantity: 1, unitPrice: 0 });
  }

  removeInvoiceFormItem(i: number): void {
    if (this.invoiceFormItems.length <= 1) return;
    this.invoiceFormItems.splice(i, 1);
  }

  private invoiceItemTotal(item: InvoiceItemForm): number {
    return (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
  }

  get invoiceFormSubtotal(): number {
    return this.invoiceFormItems.reduce((sum, it) => sum + this.invoiceItemTotal(it), 0);
  }

  get invoiceFormTotal(): number {
    const gst = this.invoiceFormSubtotal * ((Number(this.invoiceFormGstRate) || 0) / 100);
    return this.invoiceFormSubtotal + gst;
  }

  canSubmitInvoice(): boolean {
    return (
      this.invoiceFormItems.length > 0 &&
      this.invoiceFormItems.every((it) => it.description.trim() && it.quantity > 0)
    );
  }

  submitVendorInvoice(q: Quote): void {
    if (!this.invoiceFormOpenFor || !this.canSubmitInvoice() || this.invoiceFormBusy || !this.caseDetail)
      return;
    this.invoiceFormBusy = true;
    const milestoneId = this.invoiceFormOpenFor !== 'CASE' ? this.invoiceFormOpenFor : undefined;

    const submit = (attachmentDocumentId?: string) => {
      const body = {
        caseId: this.caseDetail?._id,
        quoteId: q._id,
        milestoneId,
        items: this.invoiceFormItems.map((it) => ({
          description: it.description,
          quantity: Number(it.quantity) || 0,
          unitPrice: Number(it.unitPrice) || 0,
        })),
        gstRate: Number(this.invoiceFormGstRate) || 0,
        attachmentDocumentId,
      };
      this.api.post<VendorInvoice>('/vendor-invoices', body).subscribe({
        next: (created) => {
          this.invoiceFormBusy = false;
          this.vendorInvoices = [created, ...this.vendorInvoices];
          this.closeInvoiceForm();
          this.toast.success(`Invoice ${created.invoiceNumber} created`);
        },
        error: (err) => {
          this.invoiceFormBusy = false;
          this.toast.error(extractApiError(err, 'Failed to create invoice').message);
        },
      });
    };

    const file = this.invoiceAttachmentFile;
    if (!file) {
      submit();
      return;
    }

    this.documentsService
      .requestUploadUrl({
        caseId: this.caseDetail._id,
        category: 'FINANCIAL',
        name: `Invoice attachment — ${file.name}`,
        originalFileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
      })
      .subscribe({
        next: ({ uploadUrl, documentId }) => {
          fetch(uploadUrl, {
            method: 'PUT',
            headers: { 'Content-Type': file.type || 'application/octet-stream' },
            body: file,
          })
            .then((res) => {
              if (!res.ok) throw new Error('Upload failed while sending file to storage');
              this.documentsService.confirmUpload(documentId).subscribe({
                next: () => submit(documentId),
                error: () => {
                  this.invoiceFormBusy = false;
                  this.toast.error('Attachment uploaded but could not be confirmed');
                },
              });
            })
            .catch(() => {
              this.invoiceFormBusy = false;
              this.toast.error('Failed to upload attachment');
            });
        },
        error: (err) => {
          this.invoiceFormBusy = false;
          this.toast.error(extractApiError(err, 'Failed to prepare attachment upload').message);
        },
      });
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
    if (!this.caseDetail || !this.uploadFile || !this.canUpload()) return;
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
        caseId: this.caseDetail._id,
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
                if (this.caseDetail) this.loadDocuments(this.caseDetail._id);
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
