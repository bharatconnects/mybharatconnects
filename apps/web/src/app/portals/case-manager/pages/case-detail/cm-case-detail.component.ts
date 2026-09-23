import { Component, ElementRef, HostListener, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Location } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../../core/services/api.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';
import { DocumentsService } from '../../../../core/services/documents.service';
import {
  ALLOWED_DOCUMENT_FILE_ACCEPT,
  isAllowedDocumentFile,
  isDocumentFileTooLarge,
} from '../../../../shared/utils/document-file-types.util';
import {
  PaymentsService,
  Payment as CasePayment,
  PaymentPurpose,
} from '../../../../core/services/payments.service';
import { BbSelectComponent } from '../../../../shared/components/bb-select/bb-select.component';
import { extractApiError } from '../../../../core/services/api-error';
import { PageTitleService } from '../../../../core/services/page-title.service';
import { CITY_OPTIONS } from '../../../../shared/data/cities';
import { VERTICAL_NAMES } from '../../../../shared/data/service-catalog';
import {
  CaseStatus,
  STAGE_LABEL,
  VALID_TRANSITIONS,
  stageCssClass,
} from '../../../../core/models/case-status.model';
import { CaseStageTimelineComponent } from '../../../../shared/components/case-stage-timeline/case-stage-timeline.component';

interface Note {
  _id?: string;
  author: string | { _id: string; name?: string; role?: string; email?: string };
  text: string;
  createdAt: string;
}

const NOTE_AUTHOR_ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Admin',
  OPS_FINANCE: 'Ops & Finance',
  QA: 'QA',
  CASE_MANAGER: 'Case Manager',
  VENDOR: 'Vendor',
  CLIENT: 'Client',
};

interface Vendor {
  _id: string;
  name: string;
  serviceType: string;
  city: string;
}

interface VendorUserRef {
  _id?: string;
  name?: string;
  email?: string;
}

interface VendorSearchResult {
  _id: string;
  businessName: string;
  serviceTypes: string[];
  cities: string[];
  rating: number;
  isAvailable: boolean;
  currentJobs?: number;
  maxConcurrentJobs?: number;
  userId?: VendorUserRef;
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
  vendorMarkedDoneAt?: string;
  clientApprovedAt?: string;
  paidAt?: string;
}

interface QuoteItem {
  description: string;
  quantity: number;
  unitPrice: number;
  // Client-item-only: how this line's unitPrice was marked up over the
  // vendor's own price at the same position.
  marginType?: 'PERCENT' | 'FIXED';
  marginValue?: number;
}

interface Quote {
  _id: string;
  status: QuoteStatus;
  totalAmount: number;
  currency: string;
  items?: QuoteItem[];
  validUntil?: string;
  revisionNumber?: number;
  vendorId?: { _id: string; businessName?: string; userId?: { email?: string } };
  caseManagerId?: { name?: string };
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
  cmInfoResponse?: string;
  rejectionReason?: string;
  clientResponse?: string;
  cmNegotiationReply?: string;
  cmNegotiationRepliedAt?: string;
  // UI-only: draft text for the "request clarity / negotiate" note, never sent as-is.
  requestNote?: string;
  // Client-facing quote — CM-editable, starts as a copy of the vendor's items.
  clientItems?: QuoteItem[];
  clientTaxPercent?: number;
  clientTotalAmount?: number;
  previousVendorQuote?: { items: QuoteItem[]; totalAmount: number; revisionNumber: number; capturedAt: string };
  previousClientQuote?: { items: QuoteItem[]; totalAmount: number; capturedAt: string };
  // UI-only: toggles the "previous client quote" readout.
  showClientQuoteHistory?: boolean;
  // Set by the backend: something changed on this quote since the CM last opened it.
  hasUpdate?: boolean;
  // Client rejected the CM-curated offer — surfaced here so the CM can
  // renegotiate with the vendor or formally reject; never touches the
  // vendor-visible status.
  clientRejectedAt?: string;
  clientRejectionReason?: string;
  // UI-only: snapshot of the last-saved client items/tax, so the send
  // button can tell "still matches what was already sent" apart from
  // "actually edited since then".
  clientQuoteSnapshot?: string;
}

const QUOTE_STATUS_LABEL: Record<QuoteStatus, string> = {
  INVITED: 'Invited',
  DRAFT: 'Draft',
  SENT: 'Sent',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
  NEGOTIATING: 'Negotiating',
  EXPIRED: 'Expired',
  DECLINED: 'Declined',
};

interface PopulatedUserRef {
  _id: string;
  name?: string;
  email?: string;
}

interface CaseDetail {
  _id: string;
  caseNumber: string;
  title: string;
  description: string;
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  status: CaseStatus;
  priority: string;
  serviceType: string;
  createdAt: string;
  updatedAt: string;
  assignedVendor?: Vendor;
  // Populated refs from GET /cases/:id (see cases.service.ts findById)
  clientId?: string | PopulatedUserRef;
  caseManagerId?: string | PopulatedUserRef;
  vendorId?: {
    _id: string;
    businessName?: string;
    serviceTypes?: string[];
    cities?: string[];
    rating?: number;
  };
  notes: Note[];
  stageHistory: { stage: string; changedAt: string; changedBy?: string; note?: string }[];
  pausedAt?: string;
  pauseReason?: string;
  resumedAt?: string;
  holdReleaseScheduledAt?: string;
  closingPack?: ClosingPack;
}

interface ClosingPack {
  totalDocs?: number;
  s3Key?: string;
  generatedAt?: string;
  expiresAt?: string;
}

type DocumentVerificationStatus = 'PENDING' | 'VERIFIED' | 'NEEDS_REVIEW' | 'REJECTED' | string;

interface DocumentRecord {
  _id: string;
  name?: string;
  category?: string;
  caseId?: string;
  uploadDate?: string;
  createdAt?: string;
  verificationStatus?: DocumentVerificationStatus;
  clientVisible?: boolean;
  vendorVisible?: boolean;
  visibilityBusy?: boolean;
  uploadedBy?: string | { _id: string; name?: string; role?: string };
}

interface CaseInvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

interface CaseInvoice {
  _id: string;
  invoiceNumber?: string;
  status: 'DRAFT' | 'ISSUED' | 'PAID' | 'CANCELLED' | string;
  totalAmount?: number;
  currency?: string;
  createdAt?: string;
  externalReceiptUrl?: string;
  sourcePaymentId?: string;
  busy?: boolean;
}

interface CaseVendorInvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

interface CaseVendorInvoiceOption {
  _id: string;
  invoiceNumber: string;
  vendorId?: { _id: string; businessName?: string } | string;
  items?: CaseVendorInvoiceItem[];
  totalAmount?: number;
  status: string;
  selected?: boolean;
}

@Component({
  selector: 'app-cm-case-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, CaseStageTimelineComponent, BbSelectComponent],
  template: `
    @if (loading) {
      <div class="flex justify-center py-16">
        <span class="loading loading-spinner loading-md text-primary" aria-label="Loading"></span>
      </div>
    }

    @if (!loading && caseDetail) {
      <!-- Header -->
      <a class="bb-btn bb-btn-ghost bb-btn-sm mb-3 self-start w-fit" (click)="goBack()">
        <i class="material-icons-outlined text-base">arrow_back</i>
        <span>Back to Cases</span>
      </a>

      <!-- Info Cards Row -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div class="bb-card">
          <div class="bb-card-body">
            <div class="flex items-center justify-between gap-2">
              <h3 class="bb-section-title !mb-0">Client</h3>
              <span class="bb-chip" [ngClass]="stageChipClass(caseDetail.status)">
                {{ stageLabel(caseDetail.status) }}
              </span>
            </div>
            <p class="font-semibold mt-2">{{ getClientDisplayName() }}</p>
            <p class="text-sm text-base-content/60">{{ getClientDisplayEmail() }}</p>
          </div>
        </div>
        <div class="bb-card">
          <div class="bb-card-body">
            <h3 class="bb-section-title">Details</h3>
            <p class="text-sm">
              Service: <strong>{{ caseDetail.serviceType }}</strong>
            </p>
            <p class="text-sm">
              Priority:
              <span class="font-semibold" [ngClass]="priorityClass(caseDetail.priority)">{{
                caseDetail.priority
              }}</span>
            </p>
          </div>
        </div>
      </div>

      <!-- Description -->
      <div class="bb-card mb-4">
        <div class="bb-card-body">
          <div class="flex items-center justify-between gap-2 flex-wrap">
            <h3 class="bb-section-title !mb-0">Description</h3>
            <div class="flex items-center gap-2">
              @if (caseDetail.pausedAt) {
                <span class="bb-chip bb-chip-warning" aria-label="Case paused">
                  <i class="material-icons-outlined text-sm mr-1">pause_circle</i>
                  Paused
                </span>
                <button
                  class="bb-btn bb-btn-outline bb-btn-sm"
                  (click)="resumeCase()"
                  [disabled]="pauseBusy"
                >
                  <i class="material-icons-outlined text-base">play_arrow</i>
                  {{ pauseBusy ? 'Working...' : 'Resume' }}
                </button>
              } @else {
                <button
                  class="bb-btn bb-btn-outline bb-btn-sm"
                  (click)="togglePauseForm()"
                  [disabled]="pauseBusy"
                >
                  <i class="material-icons-outlined text-base">pause</i>
                  Pause
                </button>
              }
              @if (!editingDescription) {
                <button
                  type="button"
                  class="bb-btn bb-btn-ghost bb-btn-sm"
                  (click)="startEditDescription()"
                >
                  <i class="material-icons-outlined text-base">edit</i>
                  Edit
                </button>
              }
            </div>
          </div>
          @if (showPauseForm && !caseDetail.pausedAt) {
            <div
              class="flex flex-col sm:flex-row sm:items-end gap-2 px-4 py-3 rounded-lg mt-3 bg-warning/10 border border-warning/20"
            >
              <div class="flex-1">
                <label class="bb-label" for="cm-pause-reason">Reason for pause</label>
                <input
                  id="cm-pause-reason"
                  class="bb-input"
                  [(ngModel)]="pauseReason"
                  placeholder="e.g. waiting on client documents"
                  aria-label="Pause reason"
                />
              </div>
              <div class="flex gap-2 sm:pb-0.5">
                <button class="bb-btn bb-btn-ghost bb-btn-sm" (click)="cancelPauseForm()">
                  Cancel
                </button>
                <button
                  class="bb-btn bb-btn-primary bb-btn-sm"
                  (click)="pauseCase()"
                  [disabled]="pauseBusy || !pauseReason.trim()"
                >
                  {{ pauseBusy ? 'Pausing...' : 'Confirm Pause' }}
                </button>
              </div>
            </div>
          }
          @if (caseDetail.pausedAt) {
            <div
              class="flex items-start gap-2 px-4 py-2.5 rounded-lg mt-3 text-sm bg-warning/10 text-warning border border-warning/20"
            >
              <i class="material-icons-outlined text-base mt-0.5">pause_circle</i>
              <div>
                <p class="m-0">
                  <strong>Paused</strong> at {{ caseDetail.pausedAt | date: 'medium' }}
                  @if (caseDetail.pauseReason) {
                    <span>, {{ caseDetail.pauseReason }}</span>
                  }
                </p>
                @if (caseDetail.holdReleaseScheduledAt) {
                  <p class="text-xs m-0 mt-0.5 opacity-80">
                    Hold release scheduled: {{ caseDetail.holdReleaseScheduledAt | date: 'mediumDate' }}
                  </p>
                }
              </div>
            </div>
          }
          @if (editingDescription) {
            <div class="mt-2 flex flex-col gap-2">
              <textarea
                class="bb-textarea"
                rows="3"
                [(ngModel)]="descriptionDraft"
                placeholder="Describe the case (required)..."
                aria-label="Case description"
              ></textarea>
              <div class="flex gap-2 justify-end">
                <button
                  class="bb-btn bb-btn-ghost bb-btn-sm"
                  (click)="cancelEditDescription()"
                  [disabled]="savingDescription"
                >
                  Cancel
                </button>
                <button
                  class="bb-btn bb-btn-primary bb-btn-sm"
                  (click)="saveDescription()"
                  [disabled]="savingDescription || !descriptionDraft.trim()"
                >
                  {{ savingDescription ? 'Saving...' : 'Save' }}
                </button>
              </div>
            </div>
          } @else {
            <p class="text-sm whitespace-pre-line mt-2">
              {{ caseDetail.description || 'No description provided — add one before opening the case.' }}
            </p>
          }
        </div>
      </div>

      <!-- Progress Track -->
      <div class="bb-card mb-4">
        <div class="bb-card-body">
          <div class="flex items-center justify-between gap-2 flex-wrap mb-1">
            <h3 class="bb-section-title !mb-0">Progress Track</h3>
            <span class="text-xs text-base-content/60">
              Created {{ caseDetail.createdAt | date: 'mediumDate' }} · Updated
              {{ caseDetail.updatedAt | date: 'mediumDate' }}
            </span>
          </div>
          <app-case-stage-timeline
            [currentStage]="caseDetail.status"
            [stageHistory]="caseDetail.stageHistory"
            [showNotes]="true"
          ></app-case-stage-timeline>
        </div>
      </div>

      <!-- Stage Transition -->
      <div class="bb-card mb-4">
        <div class="bb-card-body">
          <h3 class="bb-section-title">Transition Stage</h3>
          @if (nextStages.length > 0) {
            <div class="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
              <div>
                <label class="bb-label" for="cm-new-status">New Status</label>
                <app-bb-select
                  id="cm-new-status"
                  [(ngModel)]="newStatus"
                  ariaLabel="New status"
                  [options]="nextStageOptions()"
                ></app-bb-select>
              </div>
              <div>
                <label class="bb-label" for="cm-stage-note">Note (optional)</label>
                <input
                  id="cm-stage-note"
                  class="bb-input"
                  [(ngModel)]="stageNote"
                  placeholder="Add a transition note..."
                  aria-label="Transition note"
                />
              </div>
              <button
                class="bb-btn bb-btn-primary"
                (click)="transitionStage()"
                [disabled]="transitioning || !newStatus"
              >
                {{ transitioning ? 'Saving...' : 'Update Stage' }}
              </button>
            </div>
          } @else {
            <p class="text-sm text-base-content/60 py-2">
              No further transitions available from {{ stageLabel(caseDetail.status) }}.
            </p>
          }

          @if (caseDetail.status === 'QA_REVIEW') {
            <div class="mt-4 pt-4 border-t border-base-300">
              <p class="text-sm text-base-content/70 mb-2">
                Once QA has verified all documents, notify the client to confirm case completion.
              </p>
              <button
                class="bb-btn bb-btn-primary bb-btn-sm"
                (click)="requestCloseConfirmation()"
                [disabled]="requestingCloseConfirmation"
              >
                <i class="material-icons-outlined text-base">mark_email_read</i>
                {{
                  requestingCloseConfirmation
                    ? 'Requesting...'
                    : 'Request Close Confirmation from Client'
                }}
              </button>
            </div>
          }

          @if (caseDetail.status === 'CLIENT_REVIEW') {
            <div
              class="flex items-start gap-2 px-4 py-2.5 rounded-lg mt-4 text-sm bg-info/10 text-info border border-info/20"
            >
              <i class="material-icons-outlined text-base mt-0.5">hourglass_top</i>
              <p class="m-0">Awaiting client confirmation to close this case.</p>
            </div>
          }
        </div>
      </div>

      <!-- Vendor Assignment -->
      <div class="bb-card mb-4" #vendorAssignmentCard>
        <div class="bb-card-body">
          <div class="flex items-center justify-between gap-2 flex-wrap">
            <h3 class="bb-section-title !mb-0">Vendor Assignment</h3>
            <button
              type="button"
              class="bb-btn bb-btn-ghost bb-btn-sm"
              (click)="vendorSectionExpanded = !vendorSectionExpanded"
            >
              <i class="material-icons-outlined text-base">{{
                vendorSectionExpanded ? 'expand_less' : 'expand_more'
              }}</i>
              {{
                vendorSectionExpanded
                  ? 'Hide'
                  : caseDetail.assignedVendor
                    ? 'Change Vendor'
                    : 'Find Vendor'
              }}
            </button>
          </div>

          @if (caseDetail.assignedVendor) {
            <div class="flex items-center justify-between gap-4 mt-3">
              <div class="flex items-center gap-4 min-w-0">
                <div
                  class="w-10 h-10 rounded-full bg-base-200 flex items-center justify-center text-[var(--saffron)] shrink-0"
                >
                  <i class="material-icons-outlined">store</i>
                </div>
                <div class="min-w-0">
                  <strong class="block truncate">{{ caseDetail.assignedVendor.name }}</strong>
                  <p class="text-sm text-base-content/60 truncate">
                    {{ caseDetail.assignedVendor.serviceType }} — {{ caseDetail.assignedVendor.city }}
                  </p>
                </div>
              </div>
              <button
                type="button"
                class="bb-btn bb-btn-danger bb-btn-sm shrink-0"
                (click)="unassignVendor()"
                [disabled]="unassigningVendor"
              >
                <i class="material-icons-outlined text-base">person_remove</i>
                {{ unassigningVendor ? 'Removing…' : 'Remove Vendor' }}
              </button>
            </div>
          } @else if (!vendorSectionExpanded) {
            <p class="text-sm text-base-content/60 mt-3">
              No vendor assigned yet. Click "Find Vendor" to search and assign one.
            </p>
          }

          @if (vendorSectionExpanded) {
            <div class="mt-4 pt-4 border-t border-base-300">
              <div class="flex flex-wrap gap-3 items-end">
                <div class="flex-[1_1_200px] relative" #vendorCityWrap>
                  <label class="bb-label">City</label>
                  <button
                    type="button"
                    class="bb-input text-left w-full truncate flex items-center justify-between gap-2"
                    (click)="vendorCityOpen = !vendorCityOpen"
                  >
                    <span class="truncate">{{ vendorCitySummary() }}</span>
                    <i class="material-icons-outlined text-base">arrow_drop_down</i>
                  </button>
                  @if (vendorCityOpen) {
                    <div
                      class="absolute z-50 mt-1 w-64 bg-base-100 border border-base-300 rounded-lg shadow-lg p-2"
                    >
                      <label
                        class="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-base-200 text-sm font-semibold border-b border-base-200 mb-1"
                      >
                        <input
                          type="checkbox"
                          class="checkbox checkbox-sm checkbox-accent"
                          [checked]="isAllVendorCitiesSelected()"
                          (change)="toggleAllVendorCities()"
                        />
                        Select All
                      </label>
                      <ul class="max-h-52 overflow-y-auto space-y-0.5">
                        @for (c of vendorCityOptions; track c) {
                          <li>
                            <label
                              class="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-base-200 text-sm"
                            >
                              <input
                                type="checkbox"
                                class="checkbox checkbox-sm checkbox-accent"
                                [checked]="vendorSelectedCities.includes(c)"
                                (change)="toggleVendorCity(c)"
                              />
                              {{ c }}
                            </label>
                          </li>
                        }
                      </ul>
                    </div>
                  }
                </div>

                <div class="flex-[1_1_160px]">
                  <label class="bb-label" for="vs-service">Service type</label>
                  <app-bb-select
                    id="vs-service"
                    [(ngModel)]="vendorServiceType"
                    [options]="vendorServiceTypeOptions()"
                    placeholder="Any"
                  ></app-bb-select>
                </div>

                <div class="w-24 shrink-0">
                  <label class="bb-label" for="vs-min">Min rating</label>
                  <input
                    id="vs-min"
                    class="bb-input"
                    type="number"
                    min="0"
                    max="5"
                    step="0.1"
                    [(ngModel)]="vendorMinRating"
                  />
                </div>
                <div class="w-24 shrink-0">
                  <label class="bb-label" for="vs-max">Max rating</label>
                  <input
                    id="vs-max"
                    class="bb-input"
                    type="number"
                    min="0"
                    max="5"
                    step="0.1"
                    [(ngModel)]="vendorMaxRating"
                  />
                </div>

                <button
                  type="button"
                  class="bb-btn bb-btn-primary"
                  (click)="searchVendors()"
                  [disabled]="vendorSearching || !vendorSelectedCities.length"
                >
                  <i class="material-icons-outlined text-base">search</i>
                  {{ vendorSearching ? 'Searching…' : 'Find Vendors' }}
                </button>
              </div>

              @if (vendorSearching) {
                <div class="flex justify-center py-8">
                  <span class="loading loading-spinner loading-md text-primary"></span>
                </div>
              }

              @if (!vendorSearching && vendorSearched) {
                @if (vendorResults.length === 0) {
                  <div class="bb-empty mt-4">
                    <div class="bb-empty-icon"><i class="material-icons-outlined">store_mall_directory</i></div>
                    <p class="bb-empty-title">No vendors match</p>
                    <p>Try a different city or service type.</p>
                  </div>
                } @else {
                  <div class="flex flex-col gap-2 mt-4">
                    @for (v of vendorResults; track v._id) {
                      <div
                        class="flex flex-col sm:flex-row sm:items-center gap-3 border border-base-300 rounded-lg p-3 w-full"
                      >
                        @if (!isAssignedVendor(v) && !vendorQuoteFor(v)) {
                          <input
                            type="checkbox"
                            class="checkbox checkbox-sm checkbox-accent shrink-0"
                            [checked]="isInviteVendorSelected(v)"
                            (change)="toggleInviteVendor(v)"
                            [attr.aria-label]="'Select ' + v.businessName + ' to invite for a quote'"
                          />
                        }
                        <div
                          class="w-10 h-10 rounded-full bg-base-200 flex items-center justify-center text-[var(--saffron)] shrink-0"
                        >
                          <i class="material-icons-outlined">store</i>
                        </div>
                        <div class="flex-1 min-w-0">
                          <div class="font-semibold truncate">{{ v.businessName }}</div>
                          <div class="text-xs text-base-content/60 truncate">
                            {{ (v.serviceTypes || []).join(', ') || '—' }} —
                            {{ (v.cities || []).join(', ') || '—' }}
                          </div>
                        </div>
                        <div class="flex items-center gap-2 flex-wrap shrink-0">
                          <span class="inline-flex items-center gap-1 text-sm font-bold">
                            <i class="material-icons-outlined text-base" style="color: var(--saffron)"
                              >star</i
                            >
                            {{ v.rating | number: '1.1-1' }}
                          </span>
                          <span
                            class="bb-chip"
                            [ngClass]="v.isAvailable ? 'bb-chip-success' : 'bb-chip-danger'"
                          >
                            {{ v.isAvailable ? 'Available' : 'Unavailable' }}
                          </span>
                        </div>
                        @if (isAssignedVendor(v)) {
                          <span class="bb-chip bb-chip-success shrink-0">
                            <i class="material-icons-outlined text-sm">check_circle</i>
                            Assigned to this case
                          </span>
                        } @else {
                          @if (vendorQuoteFor(v); as vq) {
                            <span class="bb-chip shrink-0" [ngClass]="quoteChipClass(vq.status)">
                              {{ quoteStatusLabel(vq.status) }}
                            </span>
                            @if (vq.status === 'INVITED') {
                              <button
                                type="button"
                                class="bb-btn bb-btn-danger bb-btn-sm shrink-0"
                                (click)="revokeInvite(vq)"
                                [disabled]="revokingQuoteId === vq._id"
                              >
                                {{ revokingQuoteId === vq._id ? 'Revoking…' : 'Revoke Invite' }}
                              </button>
                            }
                          }
                        }
                      </div>
                    }
                  </div>

                  @if (inviteVendorIds.length > 0) {
                    <div
                      class="mt-4 pt-4 border-t border-base-300 flex flex-wrap items-end gap-3"
                    >
                      <div class="w-full sm:w-40">
                        <label class="bb-label" for="invite-deadline">Response window (hrs)</label>
                        <input
                          id="invite-deadline"
                          class="bb-input"
                          type="number"
                          min="1"
                          [(ngModel)]="inviteRespondByHours"
                          placeholder="Flexible"
                          aria-label="Vendor response window in hours"
                        />
                      </div>
                      <div class="flex-1 min-w-[200px]">
                        <label class="bb-label" for="invite-note">Note to vendors (optional)</label>
                        <input
                          id="invite-note"
                          class="bb-input"
                          [(ngModel)]="inviteNote"
                          placeholder="e.g. Please quote for the full scope described above"
                          aria-label="Note to invited vendors"
                        />
                      </div>
                      <button
                        type="button"
                        class="bb-btn bb-btn-primary"
                        (click)="sendVendorInvites()"
                        [disabled]="invitingVendors"
                      >
                        <i class="material-icons-outlined text-base">send</i>
                        {{
                          invitingVendors
                            ? 'Sending…'
                            : 'Invite ' + inviteVendorIds.length + ' vendor(s) to quote'
                        }}
                      </button>
                    </div>
                  }
                }
              }
            </div>
          }
        </div>
      </div>

      <!-- Quotes -->
      <div class="bb-card mb-4">
        <div class="bb-card-body">
          <h3 class="bb-section-title flex items-center gap-2">
            Quotes
            @if (anyQuoteHasUpdate()) {
              <span class="bb-update-dot" title="New updates on one or more quotes"></span>
            }
          </h3>
          @if (quotes.length === 0) {
            <div class="flex items-center justify-between gap-3 flex-wrap">
              <p class="text-sm text-base-content/60 m-0">No quotes yet for this case.</p>
              <button
                type="button"
                class="bb-btn bb-btn-primary bb-btn-sm"
                (click)="goInviteVendor()"
              >
                <i class="material-icons-outlined text-base">store</i>
                Invite a Vendor to Quote
              </button>
            </div>
          }
          @for (q of quotes; track q._id) {
            <div class="rounded-xl border border-base-300 overflow-hidden mb-4 last:mb-0 bg-base-100">
              <!-- Header strip -->
              <div
                class="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-base-300"
                style="background: var(--navy-50)"
              >
                <div class="flex flex-wrap items-center gap-2 min-w-0">
                  @if (q.hasUpdate) {
                    <span class="bb-update-dot" title="New update on this quote"></span>
                  }
                  @if (q.vendorId?.businessName) {
                    <span class="font-semibold">{{ q.vendorId!.businessName }}</span>
                  }
                  @if (q.vendorId?.userId?.email) {
                    <span class="bb-chip bb-chip-neutral normal-case">
                      <i class="material-icons-outlined text-sm">mail_outline</i>
                      {{ q.vendorId!.userId!.email }}
                    </span>
                  }
                  <span class="bb-chip" [ngClass]="quoteChipClass(q.status)">{{
                    quoteStatusLabel(q.status)
                  }}</span>
                  @if (q.revisionNumber && q.revisionNumber > 1) {
                    <span class="bb-chip bb-chip-neutral">rev {{ q.revisionNumber }}</span>
                  }
                  @if (isVendorIdAssigned(q.vendorId?._id)) {
                    <span class="bb-chip bb-chip-success">
                      <i class="material-icons-outlined text-sm">check_circle</i>
                      Assigned
                    </span>
                  }
                </div>
                <div class="flex items-center gap-3 shrink-0">
                  @if (q.items && q.items.length > 0) {
                    <div class="text-right">
                      <div class="text-[0.65rem] font-semibold uppercase tracking-wide text-base-content/50">
                        Vendor total
                      </div>
                      <strong class="text-lg leading-tight text-[var(--saffron)]"
                        >{{ q.currency }} {{ q.totalAmount | number: '1.0-2' }}</strong
                      >
                      @if (q.clientTotalAmount) {
                        <div class="text-xs text-base-content/60">
                          client sees {{ q.currency }} {{ q.clientTotalAmount | number: '1.0-2' }}
                        </div>
                      }
                    </div>
                  }
                  <button
                    type="button"
                    class="bb-btn bb-btn-ghost bb-btn-sm"
                    (click)="toggleQuoteDetails(q)"
                  >
                    <i class="material-icons-outlined text-base">{{
                      expandedQuoteId === q._id ? 'expand_less' : 'expand_more'
                    }}</i>
                    {{ expandedQuoteId === q._id ? 'Hide' : 'Details' }}
                  </button>
                </div>
              </div>

              @if (expandedQuoteId === q._id) {
              <div class="px-4 py-3">
                @if (q.status === 'DECLINED' && q.declineReason) {
                  <div
                    class="flex items-start gap-2 px-3 py-2.5 rounded-md mb-3 text-sm"
                    style="background: rgba(220, 38, 38, 0.08); border: 1px solid rgba(220, 38, 38, 0.25)"
                  >
                    <i class="material-icons-outlined text-base text-error shrink-0">block</i>
                    <div class="min-w-0">
                      <p class="font-semibold text-error m-0">Vendor declined this invite</p>
                      <p class="text-base-content/80 m-0 mt-0.5">{{ q.declineReason }}</p>
                    </div>
                  </div>
                }
                @if (q.status === 'REJECTED' && q.rejectionReason) {
                  <div
                    class="flex items-start gap-2 px-3 py-2.5 rounded-md mb-3 text-sm"
                    style="background: rgba(220, 38, 38, 0.08); border: 1px solid rgba(220, 38, 38, 0.25)"
                  >
                    <i class="material-icons-outlined text-base text-error shrink-0">cancel</i>
                    <div class="min-w-0">
                      <p class="font-semibold text-error m-0">Quote rejected</p>
                      <p class="text-base-content/80 m-0 mt-0.5">{{ q.rejectionReason }}</p>
                    </div>
                  </div>
                }
                @if (q.respondBy || q.validUntil) {
                  <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-base-content/60 mb-2">
                    @if (q.status === 'INVITED' && q.respondBy) {
                      <span>respond by {{ q.respondBy | date: 'MMM d, y, h:mm a' }}</span>
                    }
                    @if (q.validUntil) {
                      <span>valid until {{ q.validUntil | date: 'mediumDate' }}</span>
                    }
                  </div>
                }

                @if (q.vendorInfoRequest) {
                  <div class="cm-qa-thread">
                    <div class="cm-qa-bubble cm-qa-bubble--vendor">
                      <div class="cm-qa-bubble-label">
                        <i class="material-icons-outlined text-sm">store</i>
                        {{ q.vendorId?.businessName || 'Vendor' }}
                      </div>
                      <p class="cm-qa-bubble-text">{{ q.vendorInfoRequest }}</p>
                    </div>

                    @if (q.cmInfoResponse) {
                      <div class="cm-qa-bubble cm-qa-bubble--cm">
                        <div class="cm-qa-bubble-label">
                          <i class="material-icons-outlined text-sm">support_agent</i>
                          You
                        </div>
                        <p class="cm-qa-bubble-text">{{ q.cmInfoResponse }}</p>
                      </div>
                    } @else if (answerInfoFormId === q._id) {
                      <div class="cm-qa-composer">
                        <textarea
                          class="bb-textarea"
                          rows="2"
                          [(ngModel)]="answerInfoText"
                          [ngModelOptions]="{ standalone: true }"
                          placeholder="Type your answer for the vendor…"
                        ></textarea>
                        <div class="flex gap-2 justify-end mt-2">
                          <button
                            type="button"
                            class="bb-btn bb-btn-ghost bb-btn-sm"
                            (click)="cancelAnswerInfo()"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            class="bb-btn bb-btn-primary bb-btn-sm"
                            (click)="submitAnswerInfo(q)"
                            [disabled]="!answerInfoText.trim() || answerInfoBusy"
                          >
                            {{ answerInfoBusy ? 'Sending…' : 'Send Answer' }}
                          </button>
                        </div>
                      </div>
                    } @else {
                      <button
                        type="button"
                        class="bb-btn bb-btn-outline bb-btn-sm cm-qa-answer-btn"
                        (click)="openAnswerInfoForm(q)"
                      >
                        <i class="material-icons-outlined text-base">reply</i>
                        Answer
                      </button>
                    }
                  </div>
                }

                <div class="flex items-center gap-2 flex-wrap justify-end mb-1">
                  @if (q.status === 'INVITED') {
                    <button
                      class="bb-btn bb-btn-danger bb-btn-sm"
                      (click)="revokeInvite(q)"
                      [disabled]="revokingQuoteId === q._id"
                    >
                      {{ revokingQuoteId === q._id ? 'Revoking…' : 'Revoke Invite' }}
                    </button>
                  }
                  @if (q.status === 'REJECTED') {
                    <button
                      class="bb-btn bb-btn-danger bb-btn-sm"
                      (click)="deleteQuote(q)"
                      [disabled]="deletingQuoteId === q._id"
                    >
                      {{ deletingQuoteId === q._id ? 'Deleting…' : 'Delete Quote' }}
                    </button>
                  }
                </div>

                @if (q.items && q.items.length > 0) {
                  <div class="rounded-lg border border-base-300 overflow-hidden mb-3">
                    <div
                      class="px-3 py-2 border-b border-base-300"
                      style="background: var(--navy-50)"
                    >
                      <h4 class="text-xs font-semibold uppercase tracking-wide text-base-content/70 m-0">
                        Vendor Quote
                      </h4>
                    </div>
                    <div class="px-3 py-3">
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
                    </div>
                  </div>
                }

                @if (q.status === 'INVITED' && q.inviteNote) {
                  <div class="flex items-start gap-2 px-3 py-2 rounded-lg mb-3 bg-warning/10 border border-warning/20">
                    <i class="material-icons-outlined text-base text-warning">forum</i>
                    <div class="min-w-0">
                      <div class="text-xs font-semibold text-warning uppercase tracking-wide">
                        Your note to vendor
                      </div>
                      <p class="text-sm text-base-content mt-0.5 m-0">{{ q.inviteNote }}</p>
                    </div>
                  </div>
                  @if (q.vendorNegotiationReply) {
                    <div class="mt-2 flex items-start gap-2 px-3 py-2 rounded-lg mb-3 bg-base-200 border border-base-300">
                      <i class="material-icons-outlined text-base text-base-content/60">reply</i>
                      <div class="min-w-0">
                        <div class="text-xs font-semibold text-base-content/60 uppercase tracking-wide">
                          Vendor's reply
                        </div>
                        <p class="text-sm text-base-content mt-0.5 m-0">{{ q.vendorNegotiationReply }}</p>
                      </div>
                    </div>
                  } @else {
                    <p class="text-xs text-base-content/50 italic mt-1 mb-3">Waiting on the vendor's reply…</p>
                  }
                }

                @if (
                  isQuoteActionableByCm(q) ||
                  (isRespondedQuote(q) && !isVendorIdAssigned(q.vendorId?._id))
                ) {
                  <div class="mb-3 flex flex-col sm:flex-row sm:items-end gap-2">
                    @if (isQuoteActionableByCm(q)) {
                      <div class="flex-1">
                        <label class="bb-label" [attr.for]="'qreq-note-' + q._id"
                          >Note to vendor (request clarity / negotiate)</label
                        >
                        <input
                          [id]="'qreq-note-' + q._id"
                          class="bb-input"
                          [(ngModel)]="q.requestNote"
                          [ngModelOptions]="{ standalone: true }"
                          placeholder="e.g. Can you break down the itemized cost?"
                          [attr.aria-label]="'Note to ' + (q.vendorId?.businessName || 'vendor') + ' requesting clarification'"
                        />
                      </div>
                    }
                    <div class="flex gap-2 flex-wrap sm:ml-auto">
                      @if (isQuoteActionableByCm(q)) {
                        <button
                          type="button"
                          class="bb-btn bb-btn-danger bb-btn-sm"
                          (click)="rejectQuoteByCm(q)"
                          [disabled]="quoteActionBusyId === q._id"
                        >
                          {{ quoteActionBusyId === q._id ? 'Working…' : 'Reject' }}
                        </button>
                        <button
                          type="button"
                          class="bb-btn bb-btn-outline bb-btn-sm"
                          (click)="requestQuoteRevision(q)"
                          [disabled]="!q.requestNote?.trim() || quoteActionBusyId === q._id"
                        >
                          {{ quoteActionBusyId === q._id ? 'Sending…' : 'Request Quote' }}
                        </button>
                      }
                      @if (isRespondedQuote(q) && !isVendorIdAssigned(q.vendorId?._id)) {
                        <button
                          type="button"
                          class="bb-btn bb-btn-primary bb-btn-sm"
                          (click)="assignVendorFromQuote(q)"
                          [disabled]="assigningVendorId === q.vendorId?._id"
                        >
                          <i class="material-icons-outlined text-base">assignment_ind</i>
                          {{ assigningVendorId === q.vendorId?._id ? 'Assigning…' : 'Assign to case' }}
                        </button>
                      }
                    </div>
                  </div>
                }

                @if (
                  isVendorIdAssigned(q.vendorId?._id) ||
                  (!caseDetail.assignedVendor && isRespondedQuote(q)) ||
                  (q.clientItems && q.clientItems.length > 0)
                ) {
                  <div class="rounded-lg border-2 border-[var(--saffron)]/50 overflow-hidden shadow-sm">
                    <div
                      class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 px-3 py-2.5 border-b border-[var(--saffron)]/30"
                      style="background: rgba(232, 120, 23, 0.1)"
                    >
                      <div class="flex items-center gap-2 min-w-0">
                        <i class="material-icons-outlined text-base text-[var(--saffron)]">visibility</i>
                        <h4 class="text-xs font-bold uppercase tracking-wide text-base-content m-0">
                          Client Quote
                        </h4>
                      </div>
                      <div class="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                        <div class="sm:text-right">
                          <div class="text-[0.65rem] font-semibold uppercase tracking-wide text-base-content/50">
                            Client total
                          </div>
                          <strong class="text-lg leading-tight text-[var(--saffron)] whitespace-nowrap">
                            {{ q.currency }} {{ clientQuoteTotal(q) | number: '1.0-2' }}
                          </strong>
                        </div>
                        @if (q.previousClientQuote) {
                          <button
                            type="button"
                            class="bb-btn bb-btn-ghost bb-btn-sm"
                            (click)="toggleClientQuoteHistory(q)"
                          >
                            <i class="material-icons-outlined text-base">history</i>
                            {{ q.showClientQuoteHistory ? 'Hide' : 'Show' }} previous
                          </button>
                        }
                      </div>
                    </div>

                    <div class="px-3 py-3">
                      @if (q.clientRejectedAt) {
                        <div
                          class="flex items-start gap-2 px-3 py-2.5 rounded-md mb-3 text-sm"
                          style="background: rgba(220, 38, 38, 0.08); border: 1px solid rgba(220, 38, 38, 0.25)"
                        >
                          <i class="material-icons-outlined text-base text-error shrink-0">report</i>
                          <div class="min-w-0">
                            <p class="font-semibold text-error m-0">Client rejected this quote</p>
                            @if (q.clientRejectionReason) {
                              <p class="text-base-content/80 m-0 mt-0.5">"{{ q.clientRejectionReason }}"</p>
                            }
                            <p class="text-xs text-base-content/60 m-0 mt-1">
                              This hasn't been sent to the vendor — negotiate a new price with them below, or
                              reject the quote outright.
                            </p>
                          </div>
                        </div>
                      }
                      @if (q.previousVendorQuote || (q.showClientQuoteHistory && q.previousClientQuote)) {
                        <div class="flex flex-wrap gap-2 mb-3">
                          @if (q.previousVendorQuote) {
                            <div
                              class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm font-medium text-base-content/80"
                              style="background: var(--navy-50)"
                            >
                              <i class="material-icons-outlined text-base">store</i>
                              Vendor's previous quote: {{ q.currency }}
                              {{ q.previousVendorQuote.totalAmount | number: '1.0-2' }}
                              <span class="bb-chip bb-chip-neutral">rev {{ q.previousVendorQuote.revisionNumber }}</span>
                            </div>
                          }
                          @if (q.showClientQuoteHistory && q.previousClientQuote) {
                            <div
                              class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm font-medium text-base-content/80"
                              style="background: rgba(232, 120, 23, 0.1)"
                            >
                              <i class="material-icons-outlined text-base">visibility</i>
                              Previous client quote: {{ q.currency }}
                              {{ q.previousClientQuote.totalAmount | number: '1.0-2' }}
                            </div>
                          }
                        </div>
                      }

                      <div class="bb-table-wrap">
                        <div class="bb-table-scroll">
                          <table class="bb-table bb-table--compact">
                            <thead>
                              <tr>
                                <th>Item</th>
                                <th class="w-24 text-right">Qty</th>
                                <th class="w-28 text-right">Vendor price</th>
                                <th class="w-44">Margin</th>
                                <th class="w-28 text-right">Client price</th>
                                <th class="w-16"></th>
                              </tr>
                            </thead>
                            <tbody>
                              @for (item of q.clientItems; track $index; let i = $index) {
                                <tr>
                                  <td>
                                    <input
                                      [id]="'cq-desc-' + q._id + '-' + i"
                                      class="bb-input"
                                      [(ngModel)]="item.description"
                                      [ngModelOptions]="{ standalone: true }"
                                      [attr.aria-label]="'Item description ' + (i + 1)"
                                    />
                                  </td>
                                  <td>
                                    <input
                                      [id]="'cq-qty-' + q._id + '-' + i"
                                      class="bb-input text-right"
                                      type="number"
                                      min="1"
                                      [(ngModel)]="item.quantity"
                                      (ngModelChange)="recomputeClientItem(q, i)"
                                      [ngModelOptions]="{ standalone: true }"
                                      [attr.aria-label]="'Item quantity ' + (i + 1)"
                                    />
                                  </td>
                                  @if (vendorUnitPriceFor(q, i); as vendorPrice) {
                                    <td class="text-right font-medium text-base-content whitespace-nowrap">
                                      {{ vendorPrice | number: '1.0-2' }}
                                    </td>
                                    <td>
                                      <div class="flex items-center gap-1">
                                        <select
                                          [id]="'cq-margin-type-' + q._id + '-' + i"
                                          class="bb-select"
                                          style="width: 5.5rem; padding-left: 0.4rem"
                                          [(ngModel)]="item.marginType"
                                          (ngModelChange)="recomputeClientItem(q, i)"
                                          [ngModelOptions]="{ standalone: true }"
                                          [attr.aria-label]="'Margin type for item ' + (i + 1)"
                                        >
                                          <option value="PERCENT">%</option>
                                          <option value="FIXED">Fixed</option>
                                        </select>
                                        <input
                                          [id]="'cq-margin-value-' + q._id + '-' + i"
                                          class="bb-input text-right"
                                          type="number"
                                          [(ngModel)]="item.marginValue"
                                          (ngModelChange)="recomputeClientItem(q, i)"
                                          [ngModelOptions]="{ standalone: true }"
                                          [attr.aria-label]="'Margin value for item ' + (i + 1)"
                                        />
                                      </div>
                                    </td>
                                    <td class="text-right font-semibold whitespace-nowrap">
                                      {{ q.currency }} {{ item.unitPrice | number: '1.0-2' }}
                                    </td>
                                  } @else {
                                    <td class="text-right text-base-content/40">—</td>
                                    <td class="text-xs text-base-content/50">manual item</td>
                                    <td>
                                      <input
                                        [id]="'cq-price-' + q._id + '-' + i"
                                        class="bb-input text-right"
                                        type="number"
                                        min="0"
                                        [(ngModel)]="item.unitPrice"
                                        [ngModelOptions]="{ standalone: true }"
                                        [attr.aria-label]="'Item unit price ' + (i + 1)"
                                      />
                                    </td>
                                  }
                                  <td class="text-right">
                                    <button
                                      type="button"
                                      class="bb-btn bb-btn-danger bb-btn-icon"
                                      (click)="removeClientQuoteItem(q, i)"
                                      [disabled]="(q.clientItems?.length ?? 0) <= 1"
                                      aria-label="Remove item"
                                      title="Remove item"
                                    >
                                      <i class="material-icons-outlined">delete</i>
                                    </button>
                                  </td>
                                </tr>
                              }
                              <tr>
                                <td colspan="5" class="p-0">
                                  <div class="bb-table-add-rule"></div>
                                </td>
                                <td class="text-right py-2 pl-0">
                                  <button
                                    type="button"
                                    class="bb-btn bb-btn-secondary bb-btn-icon"
                                    (click)="addClientQuoteItem(q)"
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
                      <div class="flex flex-wrap items-end gap-3 justify-end mt-3">
                        <div class="w-28">
                          <label class="bb-label" [attr.for]="'cq-tax-' + q._id">Tax %</label>
                          <input
                            [id]="'cq-tax-' + q._id"
                            class="bb-input"
                            type="number"
                            min="0"
                            [ngModel]="q.clientTaxPercent ?? 18"
                            (ngModelChange)="q.clientTaxPercent = $event"
                            [ngModelOptions]="{ standalone: true }"
                          />
                        </div>
                        <div class="flex items-center gap-4 text-sm py-2">
                          <span
                            >Subtotal:
                            <strong>{{ q.currency }} {{ clientQuoteSubtotal(q) | number: '1.0-2' }}</strong></span
                          >
                          <span
                            >Total:
                            <strong>{{ q.currency }} {{ clientQuoteTotal(q) | number: '1.0-2' }}</strong></span
                          >
                        </div>
                      </div>
                      <div class="flex items-center justify-end gap-2 mt-3">
                        <button
                          type="button"
                          class="bb-btn bb-btn-primary bb-btn-sm"
                          (click)="saveClientQuote(q)"
                          [disabled]="clientQuoteBusyId === q._id || !isClientQuoteDirty(q)"
                        >
                          <i class="material-icons-outlined text-base">send</i>
                          {{ clientQuoteBusyId === q._id ? 'Sending…' : 'Send Client Quote' }}
                        </button>
                      </div>

                      @if (q.status === 'NEGOTIATING' && q.clientResponse) {
                        <div class="mt-3 flex items-start gap-2 px-3 py-2 rounded-lg bg-warning/10 border border-warning/20">
                          <i class="material-icons-outlined text-base text-warning">forum</i>
                          <div class="min-w-0">
                            <div class="text-xs font-semibold text-warning uppercase tracking-wide">
                              Client's negotiation note
                            </div>
                            <p class="text-sm text-base-content mt-0.5 m-0">{{ q.clientResponse }}</p>
                          </div>
                        </div>

                        @if (q.cmNegotiationReply) {
                          <div class="mt-2 flex items-start gap-2 px-3 py-2 rounded-lg bg-base-200 border border-base-300">
                            <i class="material-icons-outlined text-base text-base-content/60">support_agent</i>
                            <div class="min-w-0">
                              <div class="text-xs font-semibold text-base-content/60 uppercase tracking-wide">
                                Your reply
                              </div>
                              <p class="text-sm text-base-content mt-0.5 m-0">{{ q.cmNegotiationReply }}</p>
                            </div>
                          </div>
                        } @else if (negotiationReplyFormId === q._id) {
                          <div class="cm-qa-composer mt-2">
                            <textarea
                              class="bb-textarea"
                              rows="2"
                              [(ngModel)]="negotiationReplyText"
                              [ngModelOptions]="{ standalone: true }"
                              placeholder="Type your reply to the client…"
                            ></textarea>
                            <div class="flex gap-2 justify-end mt-2">
                              <button
                                type="button"
                                class="bb-btn bb-btn-ghost bb-btn-sm"
                                (click)="cancelNegotiationReply()"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                class="bb-btn bb-btn-primary bb-btn-sm"
                                (click)="submitNegotiationReply(q)"
                                [disabled]="!negotiationReplyText.trim() || negotiationReplyBusy"
                              >
                                {{ negotiationReplyBusy ? 'Sending…' : 'Send Reply' }}
                              </button>
                            </div>
                          </div>
                        } @else {
                          <div class="flex justify-end mt-2">
                            <button
                              type="button"
                              class="bb-btn bb-btn-outline bb-btn-sm"
                              (click)="openNegotiationReplyForm(q)"
                            >
                              <i class="material-icons-outlined text-base">reply</i>
                              Reply to client
                            </button>
                          </div>
                        }
                      }
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
                          <span class="text-xs text-base-content/50 italic">Awaiting client validation</span>
                        }
                        @if (m.status === 'CLIENT_APPROVED') {
                          <button
                            class="bb-btn bb-btn-primary bb-btn-sm"
                            (click)="markMilestonePaid(q, m)"
                            [disabled]="milestoneBusyId === m._id"
                          >
                            {{ milestoneBusyId === m._id ? 'Saving…' : 'Mark Paid' }}
                          </button>
                        }
                      </div>
                    }
                  </div>
                }
              </div>
              }
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
            <p class="text-sm text-base-content/60">No documents on this case.</p>
          } @else {
            <ul class="divide-y divide-base-300">
              @for (d of documents; track d._id) {
                <li class="py-2 flex flex-col sm:flex-row sm:items-center gap-2">
                  <div class="flex-1 min-w-0">
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="text-sm font-medium truncate">{{ d.name || 'Document' }}</span>
                      @if (d.category) {
                        <span class="bb-chip bb-chip-neutral">{{ d.category }}</span>
                      }
                      @if (d.verificationStatus) {
                        <span class="bb-chip bb-chip-neutral">{{ d.verificationStatus }}</span>
                      }
                    </div>
                  </div>
                  <div class="flex flex-wrap items-center gap-4 shrink-0">
                    @if (uploaderRole(d) !== 'CLIENT') {
                      <label class="flex items-center gap-2 text-xs cursor-pointer">
                        Visible to client
                        <input
                          type="checkbox"
                          class="toggle toggle-sm toggle-primary"
                          [checked]="d.clientVisible"
                          (change)="toggleDocVisibility(d, 'clientVisible')"
                          [disabled]="!!d.visibilityBusy"
                          [attr.aria-label]="'Toggle client visibility for ' + (d.name || 'document')"
                        />
                      </label>
                    }
                    @if (uploaderRole(d) !== 'VENDOR') {
                      <label class="flex items-center gap-2 text-xs cursor-pointer">
                        Visible to vendor
                        <input
                          type="checkbox"
                          class="toggle toggle-sm toggle-primary"
                          [checked]="d.vendorVisible"
                          (change)="toggleDocVisibility(d, 'vendorVisible')"
                          [disabled]="!!d.visibilityBusy"
                          [attr.aria-label]="'Toggle vendor visibility for ' + (d.name || 'document')"
                        />
                      </label>
                    }
                    <button
                      class="bb-btn bb-btn-ghost bb-btn-icon"
                      (click)="downloadDocument(d)"
                      aria-label="Download document"
                      title="Download"
                    >
                      <i class="material-icons-outlined text-base">download</i>
                    </button>
                    <button
                      class="bb-btn bb-btn-ghost bb-btn-icon text-error"
                      (click)="deleteDocument(d)"
                      [disabled]="deletingDocId === d._id"
                      aria-label="Delete document"
                      title="Delete"
                    >
                      <i class="material-icons-outlined text-base">delete</i>
                    </button>
                  </div>
                </li>
              }
            </ul>
          }

          <div class="divider my-3"></div>
          <h4 class="text-sm font-semibold text-base-content mb-2">Upload Document</h4>
          <div>
            <label class="bb-label" for="cm-up-category">Category</label>
            <app-bb-select
              id="cm-up-category"
              [(ngModel)]="uploadCategory"
              [options]="uploadCategoryOptions()"
            ></app-bb-select>
          </div>
          <div class="mt-3 flex flex-col sm:flex-row sm:items-end gap-3">
            <div class="flex-1">
              <label class="bb-label" for="cm-up-file">File</label>
              <input
                id="cm-up-file"
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
      <div class="bb-card mb-4">
        <div class="bb-card-body">
          <div class="flex items-center justify-between gap-2 flex-wrap">
            <h3 class="bb-section-title !mb-0">Invoices</h3>
            <button
              type="button"
              class="bb-btn bb-btn-ghost bb-btn-sm"
              (click)="toggleInvoiceForm()"
            >
              <i class="material-icons-outlined text-base">{{
                invoiceFormOpen ? 'expand_less' : 'add'
              }}</i>
              {{ invoiceFormOpen ? 'Cancel' : 'Create Invoice' }}
            </button>
          </div>

          @if (invoicesLoading) {
            <p class="text-sm text-base-content/60 mt-2">Loading invoices...</p>
          } @else if (caseInvoices.length === 0 && !invoiceFormOpen) {
            <p class="text-sm text-base-content/60 mt-2">No invoices created for this case yet.</p>
          }

          @if (caseInvoices.length > 0) {
            <div class="bb-table-wrap mt-3">
              <div class="bb-table-scroll">
                <table class="bb-table bb-table--compact">
                  <thead>
                    <tr>
                      <th>Invoice #</th>
                      <th class="text-right">Amount</th>
                      <th>Status</th>
                      <th class="hidden sm:table-cell">Created</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (inv of caseInvoices; track inv._id) {
                      <tr>
                        <td class="font-medium">
                          {{ inv.invoiceNumber || inv._id }}
                          <div class="sm:hidden text-[0.6875rem] text-base-content/50 mt-0.5">
                            {{ inv.createdAt | date: 'mediumDate' }}
                          </div>
                        </td>
                        <td class="text-right">
                          {{ inv.currency || 'INR' }} {{ formatInvoiceAmount(inv.totalAmount) }}
                        </td>
                        <td>
                          <span class="bb-chip" [ngClass]="invoiceStatusChip(inv.status)">{{
                            inv.status
                          }}</span>
                        </td>
                        <td class="hidden sm:table-cell">{{ inv.createdAt | date: 'mediumDate' }}</td>
                        <td class="text-right">
                          <div class="flex flex-wrap items-center gap-1 justify-end">
                            @if (inv.externalReceiptUrl) {
                              <a
                                class="bb-btn bb-btn-ghost bb-btn-sm"
                                [href]="inv.externalReceiptUrl"
                                target="_blank"
                                rel="noopener"
                              >
                                Receipt
                              </a>
                            }
                            @if (inv.status === 'DRAFT') {
                              <button
                                class="bb-btn bb-btn-outline bb-btn-sm"
                                (click)="issueInvoice(inv)"
                                [disabled]="issuingInvoiceId === inv._id"
                              >
                                {{ issuingInvoiceId === inv._id ? 'Issuing…' : 'Issue' }}
                              </button>
                            }
                            @if (inv.status === 'ISSUED') {
                              <button
                                class="bb-btn bb-btn-outline bb-btn-sm"
                                (click)="markInvoicePaid(inv)"
                                [disabled]="issuingInvoiceId === inv._id"
                              >
                                {{ issuingInvoiceId === inv._id ? 'Saving…' : 'Mark Paid' }}
                              </button>
                            }
                          </div>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          }

          @if (invoiceFormOpen) {
            <div class="mt-4 pt-4 border-t border-base-300">
              @if (invoiceForm.sourcePaymentId) {
                <div
                  class="flex items-center gap-2 px-3 py-2 rounded-lg mb-3 text-sm bg-info/10 border border-info/20"
                >
                  <i class="material-icons-outlined text-base text-info">receipt_long</i>
                  Pre-filled from this payment's Stripe receipt — items below were auto-filled,
                  billing address still needs to be entered.
                </div>
              }
              <div class="flex items-center justify-between gap-2">
                <label class="bb-label mb-0">Build from vendor invoice (optional)</label>
                <button
                  type="button"
                  class="bb-btn bb-btn-ghost bb-btn-sm"
                  (click)="loadVendorInvoicesForInvoice()"
                  [disabled]="loadingVendorInvoicesForInvoice"
                >
                  <i class="material-icons-outlined text-base">sync</i>
                  {{ loadingVendorInvoicesForInvoice ? 'Loading...' : 'Load vendor invoices for this case' }}
                </button>
              </div>
              @if (vendorInvoicesLoadedForInvoice) {
                @if (vendorInvoiceOptionsForInvoice.length === 0) {
                  <p class="bb-hint mt-2">No acknowledged vendor invoices found for this case.</p>
                } @else {
                  <div class="flex flex-col gap-2 mt-2">
                    @for (vi of vendorInvoiceOptionsForInvoice; track vi._id) {
                      <label class="bb-row-card flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          class="checkbox checkbox-sm checkbox-accent"
                          [(ngModel)]="vi.selected"
                          [ngModelOptions]="{ standalone: true }"
                          (ngModelChange)="applyVendorInvoiceSelectionForInvoice()"
                        />
                        <span class="font-mono text-xs">{{ vi.invoiceNumber }}</span>
                        <span class="text-sm text-base-content/70 flex-1">{{
                          vendorNameForInvoice(vi)
                        }}</span>
                        <span class="text-sm font-medium"
                          >₹{{ vi.totalAmount | number: '1.0-2' }}</span
                        >
                      </label>
                    }
                  </div>
                  <p class="bb-hint mt-1">
                    Selecting one or more pre-fills the items below — still fully editable before
                    you save.
                  </p>
                }
              }

              <div class="divider my-3"></div>
              <h4 class="bb-section-title text-base mb-3">Billing address</h4>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="bb-label" for="cm-bill-name">Name</label>
                  <input
                    id="cm-bill-name"
                    class="bb-input"
                    [(ngModel)]="invoiceForm.billingAddress.name"
                    [ngModelOptions]="{ standalone: true }"
                  />
                </div>
                <div>
                  <label class="bb-label" for="cm-bill-gstin"
                    >GSTIN <span class="normal-case text-base-content/50">(optional)</span></label
                  >
                  <input
                    id="cm-bill-gstin"
                    class="bb-input"
                    [(ngModel)]="invoiceForm.billingAddress.gstin"
                    [ngModelOptions]="{ standalone: true }"
                  />
                </div>
                <div class="sm:col-span-2">
                  <label class="bb-label" for="cm-bill-line1">Address line 1</label>
                  <input
                    id="cm-bill-line1"
                    class="bb-input"
                    [(ngModel)]="invoiceForm.billingAddress.line1"
                    [ngModelOptions]="{ standalone: true }"
                  />
                </div>
                <div>
                  <label class="bb-label" for="cm-bill-city">City</label>
                  <input
                    id="cm-bill-city"
                    class="bb-input"
                    [(ngModel)]="invoiceForm.billingAddress.city"
                    [ngModelOptions]="{ standalone: true }"
                  />
                </div>
                <div>
                  <label class="bb-label" for="cm-bill-state">State</label>
                  <input
                    id="cm-bill-state"
                    class="bb-input"
                    [(ngModel)]="invoiceForm.billingAddress.state"
                    [ngModelOptions]="{ standalone: true }"
                    placeholder="e.g. MH"
                  />
                </div>
                <div>
                  <label class="bb-label" for="cm-bill-pincode">Pincode</label>
                  <input
                    id="cm-bill-pincode"
                    class="bb-input"
                    [(ngModel)]="invoiceForm.billingAddress.pincode"
                    [ngModelOptions]="{ standalone: true }"
                  />
                </div>
                <div>
                  <label class="bb-label" for="cm-bill-country">Country</label>
                  <input
                    id="cm-bill-country"
                    class="bb-input"
                    [(ngModel)]="invoiceForm.billingAddress.country"
                    [ngModelOptions]="{ standalone: true }"
                  />
                </div>
              </div>

              <div class="divider my-3"></div>
              <h4 class="bb-section-title text-base mb-3">Items</h4>
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
                      @for (item of invoiceForm.items; track $index; let i = $index) {
                        <tr>
                          <td>
                            <input
                              [id]="'cm-item-desc-' + i"
                              class="bb-input"
                              [(ngModel)]="item.description"
                              [ngModelOptions]="{ standalone: true }"
                              [attr.aria-label]="'Item ' + (i + 1) + ' description'"
                            />
                          </td>
                          <td>
                            <input
                              [id]="'cm-item-qty-' + i"
                              class="bb-input text-right"
                              type="number"
                              min="1"
                              [(ngModel)]="item.quantity"
                              [ngModelOptions]="{ standalone: true }"
                              [attr.aria-label]="'Item ' + (i + 1) + ' quantity'"
                            />
                          </td>
                          <td>
                            <input
                              [id]="'cm-item-price-' + i"
                              class="bb-input text-right"
                              type="number"
                              min="0"
                              [(ngModel)]="item.unitPrice"
                              [ngModelOptions]="{ standalone: true }"
                              [attr.aria-label]="'Item ' + (i + 1) + ' unit price'"
                            />
                          </td>
                          <td class="text-right">
                            <button
                              type="button"
                              class="bb-btn bb-btn-danger bb-btn-icon"
                              (click)="removeInvoiceItem(i)"
                              [disabled]="invoiceForm.items.length === 1"
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
                            (click)="addInvoiceItem()"
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
                  <label class="bb-label" for="cm-inv-gst">GST %</label>
                  <input
                    id="cm-inv-gst"
                    class="bb-input"
                    type="number"
                    min="0"
                    [(ngModel)]="invoiceForm.gstRate"
                    [ngModelOptions]="{ standalone: true }"
                    aria-label="GST rate"
                  />
                </div>
                <div class="w-28">
                  <label class="bb-label" for="cm-inv-currency">Currency</label>
                  <input
                    id="cm-inv-currency"
                    class="bb-input"
                    [(ngModel)]="invoiceForm.currency"
                    [ngModelOptions]="{ standalone: true }"
                    aria-label="Currency"
                  />
                </div>
              </div>

              <div class="divider my-3"></div>
              <h4 class="bb-section-title text-base mb-3">
                Attach a file <span class="normal-case text-base-content/50">(optional)</span>
              </h4>
              <div class="flex flex-col sm:flex-row sm:items-center gap-3">
                <input
                  type="file"
                  class="file-input file-input-bordered w-full sm:max-w-xs"
                  (change)="onInvoiceAttachmentSelected($event)"
                  aria-label="Attach a bill or slip"
                />
                @if (invoiceForm.attachmentFile) {
                  <span class="text-sm text-base-content/60">{{ invoiceForm.attachmentFile.name }}</span>
                }
              </div>

              <div class="flex flex-wrap gap-2 mt-4 justify-end">
                <button type="button" class="bb-btn bb-btn-ghost" (click)="toggleInvoiceForm()">
                  Cancel
                </button>
                <button
                  class="bb-btn bb-btn-primary"
                  (click)="createCaseInvoice()"
                  [disabled]="invoiceCreating || !canCreateCaseInvoice()"
                >
                  <i class="material-icons-outlined text-base">receipt_long</i>
                  {{ invoiceCreating ? 'Creating...' : 'Create Invoice' }}
                </button>
              </div>
            </div>
          }
        </div>
      </div>

      <!-- Payments -->
      <div class="bb-card mb-4">
        <div class="bb-card-body">
          <div class="flex items-center justify-between gap-2 flex-wrap">
            <h3 class="bb-section-title !mb-0">Payments</h3>
            <button
              type="button"
              class="bb-btn bb-btn-ghost bb-btn-sm"
              (click)="togglePaymentRequestForm()"
            >
              <i class="material-icons-outlined text-base">{{
                paymentRequestFormOpen ? 'expand_less' : 'add'
              }}</i>
              {{ paymentRequestFormOpen ? 'Cancel' : 'Request Payment' }}
            </button>
          </div>

          @if (paymentRequestFormOpen) {
            <div class="mt-3 pb-4 border-b border-base-300 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="bb-label" for="pay-req-amount">Amount ($)</label>
                <input
                  id="pay-req-amount"
                  class="bb-input"
                  type="number"
                  min="1"
                  [(ngModel)]="paymentRequestForm.amountInRupees"
                  [ngModelOptions]="{ standalone: true }"
                  placeholder="e.g. 25000"
                />
              </div>
              <div>
                <label class="bb-label" for="pay-req-purpose">Purpose</label>
                <app-bb-select
                  id="pay-req-purpose"
                  [(ngModel)]="paymentRequestForm.purpose"
                  [ngModelOptions]="{ standalone: true }"
                  [options]="paymentPurposeOptions"
                ></app-bb-select>
              </div>
              @if (paymentRequestForm.purpose === 'MILESTONE') {
                <div>
                  <label class="bb-label" for="pay-req-milestone">Milestone</label>
                  <app-bb-select
                    id="pay-req-milestone"
                    [(ngModel)]="paymentRequestForm.milestoneId"
                    [ngModelOptions]="{ standalone: true }"
                    [options]="milestoneOptionsForPayment()"
                    placeholder="Select a milestone"
                  ></app-bb-select>
                </div>
              }
              <div [class.sm:col-span-2]="paymentRequestForm.purpose !== 'MILESTONE'">
                <label class="bb-label" for="pay-req-desc">Description</label>
                <input
                  id="pay-req-desc"
                  class="bb-input"
                  [(ngModel)]="paymentRequestForm.description"
                  [ngModelOptions]="{ standalone: true }"
                  placeholder="e.g. Advance for documentation services"
                />
              </div>
              <div class="sm:col-span-2 flex justify-end">
                <button
                  type="button"
                  class="bb-btn bb-btn-primary"
                  (click)="submitPaymentRequest()"
                  [disabled]="!canRequestPayment() || paymentRequestBusy"
                >
                  {{ paymentRequestBusy ? 'Sending…' : 'Send Request' }}
                </button>
              </div>
            </div>
          }

          @if (paymentsLoading) {
            <p class="text-sm text-base-content/60 mt-2">Loading payments...</p>
          } @else if (casePayments.length === 0 && !paymentRequestFormOpen) {
            <p class="text-sm text-base-content/60 mt-2">No payments requested for this case yet.</p>
          }

          @if (casePayments.length > 0) {
            <div class="bb-table-wrap mt-3">
              <div class="bb-table-scroll">
                <table class="bb-table bb-table--compact">
                  <thead>
                    <tr>
                      <th>From / To</th>
                      <th class="hidden md:table-cell">Purpose</th>
                      <th class="text-right">Amount</th>
                      <th>Status</th>
                      <th class="hidden md:table-cell">Description</th>
                      <th class="hidden sm:table-cell">Requested</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (p of casePayments; track p._id) {
                      <tr>
                        <td>
                          @if (p.direction === 'CM_TO_VENDOR') {
                            <span class="bb-chip bb-chip-neutral">To: {{ p.vendorName || 'Vendor' }}</span>
                          } @else {
                            <span class="bb-chip bb-chip-neutral">From: Client</span>
                          }
                          <div class="sm:hidden text-[0.6875rem] text-base-content/50 mt-0.5">
                            {{ (p.requestedAt || p.createdAt) | date: 'mediumDate' }}
                          </div>
                        </td>
                        <td class="hidden md:table-cell">{{ paymentPurposeLabel(p.purpose) }}</td>
                        <td class="text-right font-medium">
                          {{ p.currency | uppercase }} {{ p.amountInPaise / 100 | number: '1.0-2' }}
                        </td>
                        <td>
                          <span class="bb-chip" [ngClass]="paymentStatusChip(p.status)">{{
                            p.status | titlecase
                          }}</span>
                        </td>
                        <td class="hidden md:table-cell text-xs text-base-content/70 max-w-[200px] truncate">
                          {{ p.description || '—' }}
                        </td>
                        <td class="hidden sm:table-cell">{{ (p.requestedAt || p.createdAt) | date: 'mediumDate' }}</td>
                        <td class="text-right">
                          <div class="flex flex-wrap items-center gap-1 justify-end max-w-[220px] ml-auto">
                            @if (p.receiptDocumentId; as docId) {
                              <button
                                class="bb-btn bb-btn-ghost bb-btn-icon"
                                (click)="downloadReceipt(docId)"
                                aria-label="Download receipt"
                                title="Download receipt"
                              >
                                <i class="material-icons-outlined text-base">receipt</i>
                              </button>
                            }
                            @if (p.receiptUrl && !hasInvoiceForPayment(p._id)) {
                              <button
                                class="bb-btn bb-btn-outline bb-btn-sm"
                                (click)="openInvoiceFormFromPayment(p)"
                                title="Create an invoice referencing this payment's Stripe receipt"
                              >
                                Use Stripe Receipt
                              </button>
                            }
                            @if (p.status === 'pending' && markPaidFormId !== p._id) {
                              <button
                                class="bb-btn bb-btn-outline bb-btn-sm"
                                (click)="openMarkPaidForm(p)"
                              >
                                Mark Paid
                              </button>
                            }
                            <button
                              type="button"
                              class="bb-btn bb-btn-outline bb-btn-icon"
                              (click)="toggleDetailsPaymentId(p)"
                              [attr.aria-label]="detailsPaymentId === p._id ? 'Hide payment details' : 'Show payment details'"
                              [attr.title]="detailsPaymentId === p._id ? 'Hide details' : 'Details'"
                            >
                              @if (detailsPaymentId === p._id) {
                                <svg
                                  class="bb-icon-svg"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  stroke-width="2"
                                  stroke-linecap="round"
                                  stroke-linejoin="round"
                                  aria-hidden="true"
                                >
                                  <polyline points="18 15 12 9 6 15"></polyline>
                                </svg>
                              } @else {
                                <svg
                                  class="bb-icon-svg"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  stroke-width="2"
                                  stroke-linecap="round"
                                  stroke-linejoin="round"
                                  aria-hidden="true"
                                >
                                  <circle cx="12" cy="12" r="9"></circle>
                                  <line x1="12" y1="11" x2="12" y2="16"></line>
                                  <circle cx="12" cy="7.5" r="1" fill="currentColor" stroke="none"></circle>
                                </svg>
                              }
                            </button>
                            @if (
                              p.status === 'pending' &&
                              p.direction !== 'CM_TO_VENDOR' &&
                              editPaymentId !== p._id
                            ) {
                              <button
                                class="bb-btn bb-btn-ghost bb-btn-icon"
                                (click)="openEditPaymentForm(p)"
                                aria-label="Edit payment request"
                                title="Edit payment request"
                              >
                                <i class="material-icons-outlined text-base">edit</i>
                              </button>
                              <button
                                class="bb-btn bb-btn-ghost bb-btn-icon text-error"
                                (click)="deletePaymentRequest(p)"
                                [disabled]="deletingPaymentId === p._id"
                                aria-label="Delete payment request"
                                title="Delete payment request"
                              >
                                <i class="material-icons-outlined text-base">delete</i>
                              </button>
                            }
                          </div>
                        </td>
                      </tr>
                      @if (detailsPaymentId === p._id) {
                        <tr>
                          <td colspan="7" class="max-w-0">
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 py-2 text-xs">
                              <div class="min-w-0">
                                <div class="text-base-content/50">Payment ID</div>
                                <div class="font-mono break-all">{{ p._id }}</div>
                              </div>
                              @if (p.transactionId) {
                                <div class="min-w-0">
                                  <div class="text-base-content/50">Stripe Payment Intent</div>
                                  <div class="font-mono break-all">{{ p.transactionId }}</div>
                                  <a
                                    class="text-info hover:underline"
                                    [href]="'https://dashboard.stripe.com/test/payments/' + p.transactionId"
                                    target="_blank"
                                    rel="noopener"
                                  >
                                    View payment on Stripe
                                  </a>
                                </div>
                              }
                              <div class="min-w-0">
                                <div class="text-base-content/50">Requested</div>
                                <div>{{ p.requestedAt || p.createdAt | date: 'medium' }}</div>
                              </div>
                              <div class="min-w-0">
                                <div class="text-base-content/50">Last updated</div>
                                <div>{{ p.updatedAt | date: 'medium' }}</div>
                              </div>
                              @if (p.receiptUrl) {
                                <div class="min-w-0">
                                  <div class="text-base-content/50">Stripe receipt</div>
                                  <a
                                    class="text-info hover:underline"
                                    [href]="p.receiptUrl"
                                    target="_blank"
                                    rel="noopener"
                                  >
                                    View receipt
                                  </a>
                                </div>
                              }
                              @if (p.receiptDocumentId) {
                                <div class="min-w-0">
                                  <div class="text-base-content/50">Uploaded receipt</div>
                                  <button
                                    type="button"
                                    class="text-info hover:underline"
                                    (click)="downloadReceipt(p.receiptDocumentId)"
                                  >
                                    Download
                                  </button>
                                </div>
                              }
                            </div>
                          </td>
                        </tr>
                      }
                      @if (editPaymentId === p._id) {
                        <tr>
                          <td colspan="7">
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2">
                              <div>
                                <label class="bb-label" [attr.for]="'edit-pay-amount-' + p._id"
                                  >Amount ($)</label
                                >
                                <input
                                  [id]="'edit-pay-amount-' + p._id"
                                  class="bb-input"
                                  type="number"
                                  min="1"
                                  [(ngModel)]="editPaymentForm.amountInRupees"
                                  [ngModelOptions]="{ standalone: true }"
                                />
                              </div>
                              <div>
                                <label class="bb-label" [attr.for]="'edit-pay-purpose-' + p._id"
                                  >Purpose</label
                                >
                                <app-bb-select
                                  [id]="'edit-pay-purpose-' + p._id"
                                  [(ngModel)]="editPaymentForm.purpose"
                                  [ngModelOptions]="{ standalone: true }"
                                  [options]="paymentPurposeOptions"
                                ></app-bb-select>
                              </div>
                              <div class="sm:col-span-2">
                                <label class="bb-label" [attr.for]="'edit-pay-desc-' + p._id"
                                  >Description</label
                                >
                                <input
                                  [id]="'edit-pay-desc-' + p._id"
                                  class="bb-input"
                                  [(ngModel)]="editPaymentForm.description"
                                  [ngModelOptions]="{ standalone: true }"
                                />
                              </div>
                              <div class="sm:col-span-2 flex justify-end gap-2">
                                <button
                                  type="button"
                                  class="bb-btn bb-btn-ghost bb-btn-sm"
                                  (click)="cancelEditPayment()"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  class="bb-btn bb-btn-primary bb-btn-sm"
                                  (click)="saveEditPayment(p)"
                                  [disabled]="!canSaveEditPayment() || editPaymentBusy"
                                >
                                  {{ editPaymentBusy ? 'Saving…' : 'Save Changes' }}
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      }
                      @if (markPaidFormId === p._id) {
                        <tr>
                          <td colspan="7">
                            <div class="flex flex-col sm:flex-row sm:items-end gap-3 py-2">
                              <div class="flex-1">
                                <label class="bb-label" [attr.for]="'receipt-' + p._id"
                                  >Receipt (optional)</label
                                >
                                <input
                                  [id]="'receipt-' + p._id"
                                  type="file"
                                  class="file-input file-input-bordered file-input-sm w-full"
                                  (change)="onReceiptFileSelected($event)"
                                />
                              </div>
                              <div class="flex gap-2">
                                <button
                                  type="button"
                                  class="bb-btn bb-btn-ghost bb-btn-sm"
                                  (click)="cancelMarkPaid()"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  class="bb-btn bb-btn-primary bb-btn-sm"
                                  (click)="markPaymentPaid(p)"
                                  [disabled]="markPaidBusyId === p._id"
                                >
                                  {{ markPaidBusyId === p._id ? 'Saving…' : 'Confirm Received' }}
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      }
                    }
                  </tbody>
                </table>
              </div>
            </div>
          }
        </div>
      </div>

      <!-- Closing Pack -->
      @if (showClosingPack && caseDetail.status === 'CLOSED') {
        <div class="bb-card mb-4">
          <div class="bb-card-body">
            <h3 class="bb-section-title">Closing Pack</h3>
            @if (caseDetail.closingPack?.generatedAt) {
              <div
                class="flex items-start gap-2 px-4 py-2.5 rounded-lg mb-3 text-sm bg-success/10 text-success border border-success/20"
              >
                <i class="material-icons-outlined text-base mt-0.5">check_circle</i>
                <div>
                  <p class="m-0">
                    <strong>Generated</strong> at
                    {{ caseDetail.closingPack!.generatedAt | date: 'medium' }}
                  </p>
                  <p class="text-xs m-0 mt-0.5 opacity-80">
                    Docs: {{ caseDetail.closingPack!.totalDocs ?? 0 }} · Key:
                    <code class="font-mono">{{ caseDetail.closingPack!.s3Key }}</code>
                    @if (caseDetail.closingPack!.expiresAt) {
                      · Expires {{ caseDetail.closingPack!.expiresAt | date: 'mediumDate' }}
                    }
                  </p>
                </div>
              </div>
            }
            <button
              class="bb-btn bb-btn-primary"
              (click)="generateClosingPack()"
              [disabled]="generatingClosingPack || !!caseDetail.closingPack?.generatedAt"
            >
              <i class="material-icons-outlined text-base">archive</i>
              {{
                generatingClosingPack
                  ? 'Generating...'
                  : caseDetail.closingPack?.generatedAt
                    ? 'Pack generated'
                    : 'Generate Closing Pack'
              }}
            </button>
          </div>
        </div>
      }

      <!-- Internal Notes -->
      <div class="bb-card mb-4">
        <div class="bb-card-body">
          <h3 class="bb-section-title">Internal Notes</h3>
          @for (note of caseDetail.notes; track note._id || note.createdAt) {
            <div class="py-3 border-b border-base-300 last:border-b-0">
              <div class="text-xs text-base-content/60 mb-1">
                <strong>{{ noteAuthor(note) }}</strong> · {{ note.createdAt | date: 'short' }}
              </div>
              <p class="text-sm whitespace-pre-line m-0">{{ note.text }}</p>
            </div>
          }
          @if (caseDetail.notes.length === 0) {
            <p class="text-sm text-base-content/60">No internal notes yet.</p>
          }
          <div class="flex flex-col sm:flex-row sm:items-end gap-3 mt-3">
            <div class="flex-1">
              <label class="bb-label" for="cm-new-note">Add Internal Note</label>
              <textarea
                id="cm-new-note"
                class="bb-textarea"
                [(ngModel)]="newNote"
                rows="3"
                placeholder="Type a note..."
                aria-label="Add internal note"
              ></textarea>
            </div>
            <button
              class="bb-btn bb-btn-secondary sm:self-end"
              (click)="addNote()"
              [disabled]="addingNote || !newNote.trim()"
            >
              {{ addingNote ? 'Saving...' : 'Add Note' }}
            </button>
          </div>
        </div>
      </div>

    }

    @if (!loading && !caseDetail) {
      <div class="bb-card">
        <div class="bb-empty">
          <div class="bb-empty-icon"><i class="material-icons-outlined">error_outline</i></div>
          <p class="bb-empty-title">Case not found</p>
          <a class="bb-btn bb-btn-outline bb-btn-sm" (click)="goBack()">Back to Cases</a>
        </div>
      </div>
    }
  `,
  styles: [
    `
      /* Vendor pre-quote Q&A, styled as a two-party chat thread */
      .cm-qa-thread {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        padding: 0.75rem;
        margin-bottom: 0.75rem;
        border-radius: 0.75rem;
        background: var(--ivory-soft, #faf6ed);
        border: 1px solid var(--ivory-mute, #ddd5c5);
      }
      .cm-qa-bubble {
        max-width: 85%;
        padding: 0.5rem 0.75rem;
        border-radius: 0.875rem;
      }
      .cm-qa-bubble--vendor {
        align-self: flex-start;
        background: var(--field-bg, #fff);
        border: 1px solid var(--field-border);
        border-bottom-left-radius: 0.25rem;
      }
      .cm-qa-bubble--cm {
        align-self: flex-end;
        background: var(--color-primary, #1f4e79);
        border-bottom-right-radius: 0.25rem;
      }
      .cm-qa-bubble--cm .cm-qa-bubble-label {
        color: rgba(255, 255, 255, 0.75);
      }
      .cm-qa-bubble--cm .cm-qa-bubble-text {
        color: #fff;
      }
      .cm-qa-bubble-label {
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
      .cm-qa-bubble-text {
        font-size: 0.875rem;
        line-height: 1.4;
        margin: 0;
        white-space: pre-wrap;
        color: var(--ink);
      }
      .cm-qa-composer {
        align-self: flex-end;
        width: 100%;
        padding: 0.625rem;
        border-radius: 0.875rem;
        background: var(--field-bg, #fff);
        border: 1px solid var(--field-border);
      }
      .cm-qa-answer-btn {
        align-self: flex-end;
      }
    `,
  ],
})
export class CmCaseDetailComponent implements OnInit {
  loading = true;
  caseDetail: CaseDetail | null = null;

  newStatus: CaseStatus | '' = '';
  stageNote = '';
  transitioning = false;

  newNote = '';
  addingNote = false;

  quotes: Quote[] = [];
  expandedQuoteId = '';

  pauseBusy = false;
  showPauseForm = false;
  pauseReason = '';

  // Invoices
  caseInvoices: CaseInvoice[] = [];
  invoicesLoading = false;
  invoiceFormOpen = false;
  invoiceCreating = false;
  issuingInvoiceId: string | null = null;
  vendorInvoiceOptionsForInvoice: CaseVendorInvoiceOption[] = [];
  vendorInvoicesLoadedForInvoice = false;
  loadingVendorInvoicesForInvoice = false;
  invoiceForm: {
    billingAddress: {
      name: string;
      line1: string;
      city: string;
      state: string;
      pincode: string;
      country: string;
      gstin: string;
    };
    items: CaseInvoiceItem[];
    gstRate: number;
    currency: string;
    attachmentFile: File | null;
    sourceVendorInvoiceIds: string[];
    externalReceiptUrl: string;
    sourcePaymentId: string;
  } = {
    billingAddress: {
      name: '',
      line1: '',
      city: '',
      state: '',
      pincode: '',
      country: 'India',
      gstin: '',
    },
    items: [{ description: '', quantity: 1, unitPrice: 0 }],
    gstRate: 18,
    currency: 'INR',
    attachmentFile: null,
    sourceVendorInvoiceIds: [],
    externalReceiptUrl: '',
    sourcePaymentId: '',
  };

  // Payments
  casePayments: CasePayment[] = [];
  paymentsLoading = false;
  paymentRequestFormOpen = false;
  paymentRequestBusy = false;
  paymentRequestForm: {
    amountInRupees: number | null;
    purpose: PaymentPurpose;
    milestoneId: string;
    description: string;
  } = { amountInRupees: null, purpose: 'FULL', milestoneId: '', description: '' };
  markPaidFormId: string | null = null;
  markPaidBusyId: string | null = null;
  markPaidReceiptFile: File | null = null;
  editPaymentId: string | null = null;
  editPaymentForm: {
    amountInRupees: number | null;
    purpose: PaymentPurpose;
    description: string;
  } = { amountInRupees: null, purpose: 'FULL', description: '' };
  editPaymentBusy = false;
  deletingPaymentId: string | null = null;
  detailsPaymentId: string | null = null;

  // Documents
  documents: DocumentRecord[] = [];
  documentsLoading = false;
  deletingDocId: string | null = null;
  uploadCategories = ['IDENTITY', 'PROPERTY', 'FINANCIAL', 'LEGAL', 'AGREEMENT', 'OTHER'];
  uploadCategory = 'OTHER';
  uploadFile: File | null = null;
  uploading = false;
  readonly allowedDocAccept = ALLOWED_DOCUMENT_FILE_ACCEPT;

  // Closing pack — hidden until real ZIP generation is implemented; the
  // backend currently only stubs the metadata (see cases.service.ts).
  readonly showClosingPack = false;
  generatingClosingPack = false;

  // Description edit
  editingDescription = false;
  descriptionDraft = '';
  savingDescription = false;

  // Close confirmation
  requestingCloseConfirmation = false;

  // Milestones
  milestoneBusyId: string | null = null;

  // Vendor pre-quote Q&A
  answerInfoFormId: string | null = null;
  answerInfoText = '';
  answerInfoBusy = false;

  negotiationReplyFormId: string | null = null;
  negotiationReplyText = '';
  negotiationReplyBusy = false;

  // Vendor Assignment
  vendorSectionExpanded = false;
  vendorCityOptions = CITY_OPTIONS;
  vendorSelectedCities: string[] = [...CITY_OPTIONS];
  vendorCityOpen = false;
  vendorServiceType = '';
  verticalOptions = VERTICAL_NAMES;
  vendorMinRating?: number;
  vendorMaxRating?: number;
  vendorResults: VendorSearchResult[] = [];
  vendorSearching = false;
  vendorSearched = false;
  assigningVendorId = '';
  unassigningVendor = false;
  revokingQuoteId: string | null = null;
  deletingQuoteId: string | null = null;
  quoteActionBusyId: string | null = null;
  clientQuoteBusyId: string | null = null;

  // Vendor invite (multi-quote RFP)
  inviteVendorIds: string[] = [];
  inviteRespondByHours: number | null = null;
  inviteNote = '';
  invitingVendors = false;

  @ViewChild('vendorCityWrap') vendorCityWrapRef?: ElementRef<HTMLElement>;
  @ViewChild('vendorAssignmentCard') vendorAssignmentCardRef?: ElementRef<HTMLElement>;

  readonly stageCssClass = stageCssClass;

  constructor(
    private route: ActivatedRoute,
    private api: ApiService,
    private toast: ToastService,
    private confirmDialog: ConfirmDialogService,
    private pageTitleService: PageTitleService,
    private location: Location,
    private documentsService: DocumentsService,
    private paymentsService: PaymentsService,
  ) {}

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (
      this.vendorCityOpen &&
      this.vendorCityWrapRef &&
      !this.vendorCityWrapRef.nativeElement.contains(event.target as Node)
    ) {
      this.vendorCityOpen = false;
    }
  }

  goBack(): void {
    this.location.back();
  }

  ngOnInit(): void {
    // The route param is whatever identifier the URL used to get here (the
    // human-readable caseNumber — see cases.service.ts's findById fallback).
    // Every call after this one must use the loaded case's own _id instead,
    // never this raw param — the case-scoped endpoints below all expect a
    // real case id, not necessarily what's in the address bar.
    const routeId = this.route.snapshot.paramMap.get('id') ?? '';
    this.api.get<CaseDetail>(`/cases/${routeId}`).subscribe({
      next: (c) => {
        this.mapVendorFromCase(c);
        this.caseDetail = c;
        this.pageTitleService.set(c.caseNumber + ' · ' + c.title);
        this.newStatus = this.nextStages[0] ?? '';
        this.loading = false;
        this.loadQuotes(c._id);
        this.loadDocuments(c._id);
        this.loadInvoices(c._id);
        this.loadPayments(c._id);
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  // ---------- Invoices ----------
  private getClientId(): string | null {
    const c = this.caseDetail?.clientId;
    if (!c) return null;
    return typeof c === 'string' ? c : (c._id ?? null);
  }

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

  toggleInvoiceForm(): void {
    this.invoiceFormOpen = !this.invoiceFormOpen;
    if (!this.invoiceFormOpen) this.resetInvoiceForm();
  }

  loadVendorInvoicesForInvoice(): void {
    if (!this.caseDetail) return;
    this.loadingVendorInvoicesForInvoice = true;
    this.vendorInvoicesLoadedForInvoice = false;
    this.api.get<CaseVendorInvoiceOption[]>(`/vendor-invoices/case/${this.caseDetail._id}`).subscribe({
      next: (rows) => {
        this.vendorInvoiceOptionsForInvoice = (rows ?? [])
          .filter((v) => v.status === 'ACKNOWLEDGED')
          .map((v) => ({ ...v, selected: false }));
        this.vendorInvoicesLoadedForInvoice = true;
        this.loadingVendorInvoicesForInvoice = false;
      },
      error: (err) => {
        this.loadingVendorInvoicesForInvoice = false;
        this.toast.error(extractApiError(err, 'Failed to load vendor invoices').message);
      },
    });
  }

  vendorNameForInvoice(vi: CaseVendorInvoiceOption): string {
    const v = vi.vendorId;
    if (v && typeof v === 'object') return v.businessName || v._id;
    return typeof v === 'string' ? v : '—';
  }

  applyVendorInvoiceSelectionForInvoice(): void {
    const selected = this.vendorInvoiceOptionsForInvoice.filter((v) => v.selected);
    this.invoiceForm.sourceVendorInvoiceIds = selected.map((v) => v._id);
    const items = selected.flatMap((v) =>
      (v.items ?? []).map((it) => ({
        description: it.description,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
      })),
    );
    if (items.length > 0) {
      this.invoiceForm.items = items;
    }
  }

  addInvoiceItem(): void {
    this.invoiceForm.items.push({ description: '', quantity: 1, unitPrice: 0 });
  }

  removeInvoiceItem(i: number): void {
    if (this.invoiceForm.items.length <= 1) return;
    this.invoiceForm.items.splice(i, 1);
  }

  onInvoiceAttachmentSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.invoiceForm.attachmentFile = input.files && input.files.length > 0 ? input.files[0] : null;
  }

  canCreateCaseInvoice(): boolean {
    const addr = this.invoiceForm.billingAddress;
    return (
      !!this.getClientId() &&
      addr.name.trim().length > 0 &&
      addr.line1.trim().length > 0 &&
      addr.city.trim().length > 0 &&
      addr.state.trim().length > 0 &&
      addr.pincode.trim().length > 0 &&
      addr.country.trim().length > 0 &&
      this.invoiceForm.items.every(
        (it) =>
          it.description.trim().length > 0 && Number(it.quantity) > 0 && Number(it.unitPrice) > 0,
      )
    );
  }

  private buildInvoiceCreatePayload(attachmentDocumentId?: string): Record<string, unknown> {
    const addr = this.invoiceForm.billingAddress;
    return {
      caseId: this.caseDetail?._id,
      clientId: this.getClientId(),
      billingAddress: {
        name: addr.name.trim(),
        line1: addr.line1.trim(),
        city: addr.city.trim(),
        state: addr.state.trim(),
        pincode: addr.pincode.trim(),
        country: addr.country.trim(),
        gstin: addr.gstin.trim() || undefined,
      },
      items: this.invoiceForm.items.map((it) => ({
        description: it.description.trim(),
        quantity: Number(it.quantity),
        unitPrice: Number(it.unitPrice),
      })),
      gstRate: Number(this.invoiceForm.gstRate) || 0,
      currency: (this.invoiceForm.currency || 'INR').trim() || 'INR',
      sourceVendorInvoiceIds:
        this.invoiceForm.sourceVendorInvoiceIds.length > 0
          ? this.invoiceForm.sourceVendorInvoiceIds
          : undefined,
      attachmentDocumentId,
      externalReceiptUrl: this.invoiceForm.externalReceiptUrl || undefined,
      sourcePaymentId: this.invoiceForm.sourcePaymentId || undefined,
    };
  }

  private resetInvoiceForm(): void {
    this.invoiceForm.items = [{ description: '', quantity: 1, unitPrice: 0 }];
    this.invoiceForm.attachmentFile = null;
    this.invoiceForm.sourceVendorInvoiceIds = [];
    this.invoiceForm.externalReceiptUrl = '';
    this.invoiceForm.sourcePaymentId = '';
    this.vendorInvoiceOptionsForInvoice = [];
    this.vendorInvoicesLoadedForInvoice = false;
  }

  // "Use Stripe Receipt" — pre-fills the invoice form from a captured
  // payment's Stripe-hosted receipt instead of a blank form or manual
  // upload; the CM still fills the billing address (a GST invoice needs it
  // regardless of payment method), but skips typing out line items and
  // never has to download+reupload anything Stripe already generated.
  openInvoiceFormFromPayment(p: CasePayment): void {
    this.invoiceFormOpen = true;
    this.invoiceForm.items = [
      { description: p.description || 'Payment received', quantity: 1, unitPrice: p.amountInPaise / 100 },
    ];
    this.invoiceForm.externalReceiptUrl = p.receiptUrl || '';
    this.invoiceForm.sourcePaymentId = p._id;
  }

  hasInvoiceForPayment(paymentId: string): boolean {
    return this.caseInvoices.some((inv) => inv.sourcePaymentId === paymentId);
  }

  issueInvoice(inv: CaseInvoice): void {
    if (this.issuingInvoiceId) return;
    this.issuingInvoiceId = inv._id;
    this.api.post<CaseInvoice>(`/invoices/${inv._id}/issue`, {}).subscribe({
      next: (updated) => {
        this.issuingInvoiceId = null;
        this.caseInvoices = this.caseInvoices.map((i) => (i._id === inv._id ? updated : i));
        this.toast.success('Invoice issued — the client can now see it');
      },
      error: (err) => {
        this.issuingInvoiceId = null;
        this.toast.error(extractApiError(err, 'Failed to issue invoice').message);
      },
    });
  }

  markInvoicePaid(inv: CaseInvoice): void {
    if (this.issuingInvoiceId) return;
    this.issuingInvoiceId = inv._id;
    this.api.post<CaseInvoice>(`/invoices/${inv._id}/mark-paid`, {}).subscribe({
      next: (updated) => {
        this.issuingInvoiceId = null;
        this.caseInvoices = this.caseInvoices.map((i) => (i._id === inv._id ? updated : i));
        this.toast.success('Invoice marked as paid');
      },
      error: (err) => {
        this.issuingInvoiceId = null;
        this.toast.error(extractApiError(err, 'Failed to mark invoice paid').message);
      },
    });
  }

  createCaseInvoice(): void {
    if (!this.canCreateCaseInvoice() || this.invoiceCreating || !this.caseDetail) return;
    this.invoiceCreating = true;

    const submit = (attachmentDocumentId?: string) => {
      this.api.post<CaseInvoice>('/invoices', this.buildInvoiceCreatePayload(attachmentDocumentId)).subscribe({
        next: (inv) => {
          this.invoiceCreating = false;
          if (inv) this.caseInvoices = [inv, ...this.caseInvoices];
          this.toast.success('Invoice created');
          this.invoiceFormOpen = false;
          this.resetInvoiceForm();
        },
        error: (err) => {
          this.invoiceCreating = false;
          this.toast.error(extractApiError(err, 'Failed to create invoice').message);
        },
      });
    };

    const file = this.invoiceForm.attachmentFile;
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
                  this.invoiceCreating = false;
                  this.toast.error('Attachment uploaded but could not be confirmed');
                },
              });
            })
            .catch(() => {
              this.invoiceCreating = false;
              this.toast.error('Failed to upload attachment');
            });
        },
        error: (err) => {
          this.invoiceCreating = false;
          this.toast.error(extractApiError(err, 'Failed to prepare attachment upload').message);
        },
      });
  }

  formatInvoiceAmount(n: number | undefined): string {
    return (Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  }

  invoiceStatusChip(status: string): string {
    switch ((status || '').toUpperCase()) {
      case 'DRAFT':
        return 'bb-chip-neutral';
      case 'ISSUED':
        return 'bb-chip-info';
      case 'PAID':
        return 'bb-chip-success';
      case 'CANCELLED':
        return 'bb-chip-neutral';
      default:
        return 'bb-chip-neutral';
    }
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

  readonly paymentPurposeOptions = [
    { value: 'TOKEN', label: 'Token / Advance' },
    { value: 'PARTIAL', label: 'Partial payment' },
    { value: 'MILESTONE', label: 'Milestone payment' },
    { value: 'FULL', label: 'Full payment' },
  ];

  milestoneOptionsForPayment(): { value: string; label: string }[] {
    const options: { value: string; label: string }[] = [];
    for (const q of this.quotes) {
      if (q.status !== 'ACCEPTED' || !q.milestones) continue;
      for (const m of q.milestones) {
        if (m._id) options.push({ value: m._id, label: `${m.sequence}. ${m.title}` });
      }
    }
    return options;
  }

  togglePaymentRequestForm(): void {
    this.paymentRequestFormOpen = !this.paymentRequestFormOpen;
    if (!this.paymentRequestFormOpen) {
      this.paymentRequestForm = {
        amountInRupees: null,
        purpose: 'FULL',
        milestoneId: '',
        description: '',
      };
    }
  }

  canRequestPayment(): boolean {
    const f = this.paymentRequestForm;
    if (!f.amountInRupees || f.amountInRupees <= 0) return false;
    if (!f.description.trim()) return false;
    if (f.purpose === 'MILESTONE' && !f.milestoneId) return false;
    return true;
  }

  submitPaymentRequest(): void {
    if (!this.canRequestPayment() || this.paymentRequestBusy || !this.caseDetail) return;
    const clientId = this.getClientId();
    if (!clientId) {
      this.toast.error('This case has no client on record');
      return;
    }
    this.paymentRequestBusy = true;
    this.paymentsService
      .requestPayment({
        caseId: this.caseDetail._id,
        clientId,
        amountInPaise: Math.round((this.paymentRequestForm.amountInRupees ?? 0) * 100),
        purpose: this.paymentRequestForm.purpose,
        description: this.paymentRequestForm.description.trim(),
        milestoneId:
          this.paymentRequestForm.purpose === 'MILESTONE'
            ? this.paymentRequestForm.milestoneId
            : undefined,
      })
      .subscribe({
        next: (payment) => {
          this.paymentRequestBusy = false;
          this.casePayments = [payment, ...this.casePayments];
          this.toast.success('Payment requested from client');
          this.togglePaymentRequestForm();
        },
        error: (err) => {
          this.paymentRequestBusy = false;
          this.toast.error(extractApiError(err, 'Failed to request payment').message);
        },
      });
  }

  openEditPaymentForm(payment: CasePayment): void {
    this.cancelMarkPaid();
    this.editPaymentId = payment._id;
    this.editPaymentForm = {
      amountInRupees: payment.amountInPaise / 100,
      purpose: payment.purpose ?? 'FULL',
      description: payment.description,
    };
  }

  cancelEditPayment(): void {
    this.editPaymentId = null;
    this.editPaymentForm = { amountInRupees: null, purpose: 'FULL', description: '' };
  }

  canSaveEditPayment(): boolean {
    const f = this.editPaymentForm;
    return !!f.amountInRupees && f.amountInRupees > 0 && !!f.description.trim();
  }

  saveEditPayment(payment: CasePayment): void {
    if (!this.canSaveEditPayment() || this.editPaymentBusy) return;
    this.editPaymentBusy = true;
    this.paymentsService
      .updatePaymentRequest(payment._id, {
        amountInPaise: Math.round((this.editPaymentForm.amountInRupees ?? 0) * 100),
        purpose: this.editPaymentForm.purpose,
        description: this.editPaymentForm.description.trim(),
      })
      .subscribe({
        next: (updated) => {
          this.editPaymentBusy = false;
          this.casePayments = this.casePayments.map((p) => (p._id === payment._id ? updated : p));
          this.toast.success('Payment request updated');
          this.cancelEditPayment();
        },
        error: (err) => {
          this.editPaymentBusy = false;
          this.toast.error(extractApiError(err, 'Failed to update payment request').message);
        },
      });
  }

  async deletePaymentRequest(payment: CasePayment): Promise<void> {
    if (this.deletingPaymentId) return;
    const ok = await this.confirmDialog.confirm(
      `Withdraw this ${payment.currency.toUpperCase()} ${(payment.amountInPaise / 100).toLocaleString('en-US')} payment request?`,
      { title: 'Withdraw payment request', confirmText: 'Withdraw', danger: true },
    );
    if (!ok) return;
    this.deletingPaymentId = payment._id;
    this.paymentsService.deletePaymentRequest(payment._id).subscribe({
      next: () => {
        this.deletingPaymentId = null;
        this.casePayments = this.casePayments.filter((p) => p._id !== payment._id);
        this.toast.success('Payment request withdrawn');
      },
      error: (err) => {
        this.deletingPaymentId = null;
        this.toast.error(extractApiError(err, 'Failed to withdraw payment request').message);
      },
    });
  }

  toggleDetailsPaymentId(payment: CasePayment): void {
    this.detailsPaymentId = this.detailsPaymentId === payment._id ? null : payment._id;
  }

  openMarkPaidForm(payment: CasePayment): void {
    this.cancelEditPayment();
    this.markPaidFormId = payment._id;
    this.markPaidReceiptFile = null;
  }

  cancelMarkPaid(): void {
    this.markPaidFormId = null;
    this.markPaidReceiptFile = null;
  }

  onReceiptFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.markPaidReceiptFile = input.files && input.files.length > 0 ? input.files[0] : null;
  }

  markPaymentPaid(payment: CasePayment): void {
    if (this.markPaidBusyId || !this.caseDetail) return;
    this.markPaidBusyId = payment._id;

    const finish = (receiptDocumentId?: string) => {
      this.paymentsService.markPaid(payment._id, receiptDocumentId).subscribe({
        next: (updated) => {
          this.markPaidBusyId = null;
          this.casePayments = this.casePayments.map((p) => (p._id === payment._id ? updated : p));
          this.cancelMarkPaid();
          this.toast.success('Payment marked as received');
        },
        error: (err) => {
          this.markPaidBusyId = null;
          this.toast.error(extractApiError(err, 'Failed to mark payment paid').message);
        },
      });
    };

    const file = this.markPaidReceiptFile;
    if (!file || !this.caseDetail) {
      finish();
      return;
    }

    this.documentsService
      .requestUploadUrl({
        caseId: this.caseDetail._id,
        category: 'FINANCIAL',
        name: `Payment receipt — ${file.name}`,
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
                next: () => {
                  // Receipt should be downloadable by the client — visibility
                  // failing shouldn't block recording the payment itself.
                  this.api
                    .patch('/documents/visibility', {
                      documentIds: [documentId],
                      clientVisible: true,
                    })
                    .subscribe({
                      next: () => finish(documentId),
                      error: () => finish(documentId),
                    });
                },
                error: () => {
                  this.markPaidBusyId = null;
                  this.toast.error('Receipt uploaded but could not be confirmed');
                },
              });
            })
            .catch(() => {
              this.markPaidBusyId = null;
              this.toast.error('Failed to upload receipt');
            });
        },
        error: (err) => {
          this.markPaidBusyId = null;
          this.toast.error(extractApiError(err, 'Failed to prepare receipt upload').message);
        },
      });
  }

  paymentStatusChip(status: CasePayment['status']): string {
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

  paymentPurposeLabel(p?: PaymentPurpose): string {
    switch (p) {
      case 'TOKEN':
        return 'Token';
      case 'PARTIAL':
        return 'Partial';
      case 'MILESTONE':
        return 'Milestone';
      case 'FULL':
        return 'Full';
      default:
        return '—';
    }
  }

  downloadReceipt(documentId: string): void {
    this.api.get<{ downloadUrl: string }>(`/documents/${documentId}/download`).subscribe({
      next: (res) => {
        if (res.downloadUrl) window.open(res.downloadUrl, '_blank');
      },
      error: (err) => {
        this.toast.error(extractApiError(err, 'Failed to download receipt').message);
      },
    });
  }

  // ---------- Documents ----------
  loadDocuments(caseId: string): void {
    this.documentsLoading = true;
    this.api.get<DocumentRecord[]>(`/documents`, { caseId }).subscribe({
      next: (rows) => {
        this.documents = rows ?? [];
        this.documentsLoading = false;
      },
      error: () => {
        this.documents = [];
        this.documentsLoading = false;
      },
    });
  }

  downloadDocument(doc: DocumentRecord): void {
    this.api.get<{ downloadUrl: string }>(`/documents/${doc._id}/download`).subscribe({
      next: (res) => {
        if (res.downloadUrl) window.open(res.downloadUrl, '_blank');
      },
      error: (err) => {
        this.toast.error(extractApiError(err, 'Failed to download document').message);
      },
    });
  }

  uploaderRole(d: DocumentRecord): string | undefined {
    return typeof d.uploadedBy === 'object' ? d.uploadedBy.role : undefined;
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
    this.api
      .post<{ uploadUrl: string; documentId: string }>('/documents/upload-request', {
        caseId: this.caseDetail._id,
        category: this.uploadCategory,
        name: file.name,
        originalFileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
      })
      .subscribe({
        next: async ({ uploadUrl, documentId }) => {
          try {
            const uploadRes = await fetch(uploadUrl, {
              method: 'PUT',
              headers: { 'Content-Type': file.type || 'application/octet-stream' },
              body: file,
            });
            if (!uploadRes.ok) {
              throw new Error('Upload failed while sending file to storage');
            }
            this.api.post(`/documents/${documentId}/confirm`, {}).subscribe({
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

  // ---------- Closing pack ----------
  generateClosingPack(): void {
    if (!this.caseDetail || this.generatingClosingPack) return;
    if (this.caseDetail.closingPack?.generatedAt) return;
    this.generatingClosingPack = true;
    this.api
      .post<CaseDetail | ClosingPack>(`/cases/${this.caseDetail._id}/closing-pack`, {})
      .subscribe({
        next: (res) => {
          this.generatingClosingPack = false;
          // Backend may return either the updated case or just the closingPack object.
          if (res && typeof res === 'object' && 'closingPack' in (res as CaseDetail)) {
            this.caseDetail = res as CaseDetail;
          } else if (this.caseDetail) {
            this.caseDetail = { ...this.caseDetail, closingPack: res as ClosingPack };
          }
          this.toast.success('Closing pack generated');
        },
        error: (err) => {
          this.generatingClosingPack = false;
          if (err?.status === 404) {
            this.toast.info('Closing pack coming soon');
          } else {
            this.toast.error(extractApiError(err, 'Failed to generate closing pack').message);
          }
        },
      });
  }

  togglePauseForm(): void {
    this.showPauseForm = !this.showPauseForm;
    if (!this.showPauseForm) this.pauseReason = '';
  }

  cancelPauseForm(): void {
    this.showPauseForm = false;
    this.pauseReason = '';
  }

  pauseCase(): void {
    if (!this.caseDetail || !this.pauseReason.trim() || this.pauseBusy) return;
    this.pauseBusy = true;
    this.api
      .patch<CaseDetail>(`/cases/${this.caseDetail._id}/pause`, { reason: this.pauseReason.trim() })
      .subscribe({
        next: (updated) => {
          this.caseDetail = updated;
          this.pauseBusy = false;
          this.showPauseForm = false;
          this.pauseReason = '';
          this.toast.success('Case paused');
        },
        error: (err) => {
          this.pauseBusy = false;
          this.toast.error(extractApiError(err, 'Failed to pause case').message);
        },
      });
  }

  resumeCase(): void {
    if (!this.caseDetail || this.pauseBusy) return;
    this.pauseBusy = true;
    this.api.patch<CaseDetail>(`/cases/${this.caseDetail._id}/resume`, {}).subscribe({
      next: (updated) => {
        this.caseDetail = updated;
        this.pauseBusy = false;
        this.toast.success('Case resumed');
      },
      error: (err) => {
        this.pauseBusy = false;
        this.toast.error(extractApiError(err, 'Failed to resume case').message);
      },
    });
  }

  getClientDisplayName(): string {
    if (this.caseDetail?.clientName) return this.caseDetail.clientName;
    const c = this.caseDetail?.clientId;
    if (!c || typeof c === 'string') return '—';
    return c.name || c.email || '—';
  }

  getClientDisplayEmail(): string {
    if (this.caseDetail?.clientEmail) return this.caseDetail.clientEmail;
    const c = this.caseDetail?.clientId;
    if (!c || typeof c === 'string') return '';
    return c.email || '';
  }

  loadQuotes(caseId: string): void {
    this.api.get<Quote[]>(`/quotes/case/${caseId}`).subscribe({
      next: (qs) => {
        this.quotes = qs ?? [];
        this.quotes.forEach((q) => {
          q.clientQuoteSnapshot = this.clientQuoteSnapshotOf(q);
        });
      },
      error: () => {
        this.quotes = [];
      },
    });
  }

  private clientQuoteSnapshotOf(q: Quote): string {
    return JSON.stringify({
      items: (q.clientItems ?? []).map((it) => ({
        description: it.description,
        quantity: Number(it.quantity) || 0,
        unitPrice: Number(it.unitPrice) || 0,
        marginType: it.marginType ?? null,
        marginValue: it.marginValue ?? null,
      })),
      tax: Number(q.clientTaxPercent) || 18,
    });
  }

  // Once a quote has already been sent, re-sending an untouched form is a
  // no-op the CM shouldn't be able to trigger by accident — the button only
  // lights up once something in the client-facing offer actually changed.
  // A quote that's never been sent (still DRAFT) has nothing to compare
  // against, so it's always eligible.
  isClientQuoteDirty(q: Quote): boolean {
    // Same "not yet visible to the client" set as saveClientQuote() — the
    // send button must stay enabled even with unchanged numbers, since a
    // save alone won't get this in front of the client.
    if (q.status === 'DRAFT' || q.status === 'INVITED' || q.status === 'DECLINED') return true;
    return this.clientQuoteSnapshotOf(q) !== q.clientQuoteSnapshot;
  }

  quoteStatusLabel(s: QuoteStatus): string {
    return QUOTE_STATUS_LABEL[s] ?? s;
  }


  openAnswerInfoForm(q: Quote): void {
    this.answerInfoFormId = q._id;
    this.answerInfoText = '';
  }

  cancelAnswerInfo(): void {
    this.answerInfoFormId = null;
    this.answerInfoText = '';
  }

  submitAnswerInfo(q: Quote): void {
    if (!this.answerInfoText.trim() || this.answerInfoBusy) return;
    this.answerInfoBusy = true;
    this.api
      .patch<Quote>(`/quotes/${q._id}/answer-info`, { answer: this.answerInfoText.trim() })
      .subscribe({
        next: (updated) => {
          this.answerInfoBusy = false;
          this.cancelAnswerInfo();
          this.quotes = this.quotes.map((qq) => (qq._id === q._id ? updated : qq));
          this.toast.success('Answer sent to the vendor');
        },
        error: (err) => {
          this.answerInfoBusy = false;
          this.toast.error(extractApiError(err, 'Failed to send answer').message);
        },
      });
  }

  openNegotiationReplyForm(q: Quote): void {
    this.negotiationReplyFormId = q._id;
    this.negotiationReplyText = '';
  }

  cancelNegotiationReply(): void {
    this.negotiationReplyFormId = null;
    this.negotiationReplyText = '';
  }

  submitNegotiationReply(q: Quote): void {
    if (!this.negotiationReplyText.trim() || this.negotiationReplyBusy) return;
    this.negotiationReplyBusy = true;
    this.api
      .patch<Quote>(`/quotes/${q._id}/reply-negotiation`, { reply: this.negotiationReplyText.trim() })
      .subscribe({
        next: (updated) => {
          this.negotiationReplyBusy = false;
          this.cancelNegotiationReply();
          this.quotes = this.quotes.map((qq) => (qq._id === q._id ? updated : qq));
          this.toast.success('Reply sent to the client');
        },
        error: (err) => {
          this.negotiationReplyBusy = false;
          this.toast.error(extractApiError(err, 'Failed to send reply').message);
        },
      });
  }

  // Every other stage is a valid target — the case can move forward or
  // backward. CLIENT_REVIEW/CLOSED are also reachable here directly, in
  // addition to the dedicated close-confirmation actions below.
  get nextStages(): CaseStatus[] {
    if (!this.caseDetail) return [];
    return VALID_TRANSITIONS[this.caseDetail.status] ?? [];
  }

  nextStageOptions(): { value: string; label: string }[] {
    return this.nextStages.map((s) => ({ value: s, label: this.stageLabel(s) }));
  }

  vendorServiceTypeOptions(): { value: string; label: string }[] {
    return [{ value: '', label: 'Any' }, ...this.verticalOptions.map((v) => ({ value: v, label: v }))];
  }

  uploadCategoryOptions(): { value: string; label: string }[] {
    return this.uploadCategories.map((c) => ({ value: c, label: c }));
  }

  // ---------- Description edit ----------
  startEditDescription(): void {
    if (!this.caseDetail) return;
    this.descriptionDraft = this.caseDetail.description ?? '';
    this.editingDescription = true;
  }

  cancelEditDescription(): void {
    this.editingDescription = false;
    this.descriptionDraft = '';
  }

  saveDescription(): void {
    if (!this.caseDetail || !this.descriptionDraft.trim() || this.savingDescription) return;
    this.savingDescription = true;
    this.api
      .patch<CaseDetail>(`/cases/${this.caseDetail._id}`, {
        description: this.descriptionDraft.trim(),
      })
      .subscribe({
        next: (updated) => {
          this.caseDetail!.description = updated.description;
          this.savingDescription = false;
          this.editingDescription = false;
          this.toast.success('Description updated');
        },
        error: (err) => {
          this.savingDescription = false;
          this.toast.error(extractApiError(err, 'Failed to update description').message);
        },
      });
  }

  // ---------- Close confirmation ----------
  requestCloseConfirmation(): void {
    if (!this.caseDetail || this.requestingCloseConfirmation) return;
    this.requestingCloseConfirmation = true;
    this.api
      .post<CaseDetail>(`/cases/${this.caseDetail._id}/request-close-confirmation`, {})
      .subscribe({
        next: (updated) => {
          this.mapVendorFromCase(updated);
          this.caseDetail = updated;
          this.requestingCloseConfirmation = false;
          this.newStatus = this.nextStages[0] ?? '';
          this.toast.success('Client notified to confirm case completion');
        },
        error: (err) => {
          this.requestingCloseConfirmation = false;
          this.toast.error(
            extractApiError(err, 'Failed to request close confirmation').message,
          );
        },
      });
  }

  // ---------- Vendor invites (multi-quote RFP) ----------
  toggleInviteVendor(v: VendorSearchResult): void {
    const idx = this.inviteVendorIds.indexOf(v._id);
    if (idx === -1) this.inviteVendorIds.push(v._id);
    else this.inviteVendorIds.splice(idx, 1);
  }

  isInviteVendorSelected(v: VendorSearchResult): boolean {
    return this.inviteVendorIds.includes(v._id);
  }

  sendVendorInvites(): void {
    if (!this.caseDetail || !this.inviteVendorIds.length || this.invitingVendors) return;
    this.invitingVendors = true;
    const body: { caseId: string; vendorIds: string[]; respondByHours?: number; note?: string } = {
      caseId: this.caseDetail._id,
      vendorIds: [...this.inviteVendorIds],
    };
    if (this.inviteRespondByHours) body.respondByHours = Number(this.inviteRespondByHours);
    if (this.inviteNote.trim()) body.note = this.inviteNote.trim();
    this.api.post<Quote[]>('/quotes/invite', body).subscribe({
      next: () => {
        this.invitingVendors = false;
        this.inviteVendorIds = [];
        this.inviteRespondByHours = null;
        this.inviteNote = '';
        if (this.caseDetail) this.loadQuotes(this.caseDetail._id);
        this.toast.success('Vendors invited to quote');
      },
      error: (err) => {
        this.invitingVendors = false;
        this.toast.error(extractApiError(err, 'Failed to invite vendors').message);
      },
    });
  }

  // ---------- Milestones ----------
  milestoneStatusLabel(status: MilestoneStatus): string {
    switch (status) {
      case 'PENDING':
        return 'Pending';
      case 'VENDOR_MARKED_DONE':
        return 'Vendor marked done';
      case 'CLIENT_APPROVED':
        return 'Client approved — ready for payment';
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

  markMilestonePaid(q: Quote, m: QuoteMilestone): void {
    if (!m._id || this.milestoneBusyId) return;
    this.milestoneBusyId = m._id;
    this.api.patch<Quote>(`/quotes/${q._id}/milestones/${m._id}/mark-paid`, {}).subscribe({
      next: (updated) => {
        this.milestoneBusyId = null;
        this.quotes = this.quotes.map((qq) => (qq._id === q._id ? updated : qq));
        this.toast.success('Milestone marked as paid');
      },
      error: (err) => {
        this.milestoneBusyId = null;
        this.toast.error(extractApiError(err, 'Failed to mark milestone paid').message);
      },
    });
  }

  // ---------- Document visibility ----------
  toggleDocVisibility(doc: DocumentRecord, field: 'clientVisible' | 'vendorVisible'): void {
    if (doc.visibilityBusy) return;
    const value = !doc[field];
    doc.visibilityBusy = true;
    this.api
      .patch<{ modifiedCount: number }>('/documents/visibility', {
        documentIds: [doc._id],
        [field]: value,
      })
      .subscribe({
        next: () => {
          doc[field] = value;
          doc.visibilityBusy = false;
          this.toast.success('Document visibility updated');
        },
        error: (err) => {
          doc.visibilityBusy = false;
          this.toast.error(extractApiError(err, 'Failed to update visibility').message);
        },
      });
  }

  async deleteDocument(doc: DocumentRecord): Promise<void> {
    if (this.deletingDocId) return;
    const ok = await this.confirmDialog.confirm(
      `Delete "${doc.name || 'this document'}"? This cannot be undone.`,
      { title: 'Delete document', confirmText: 'Delete', danger: true },
    );
    if (!ok) return;
    this.deletingDocId = doc._id;
    this.api.delete<{ success: boolean }>(`/documents/${doc._id}`).subscribe({
      next: () => {
        this.documents = this.documents.filter((d) => d._id !== doc._id);
        this.deletingDocId = null;
        this.toast.success('Document deleted');
      },
      error: (err) => {
        this.deletingDocId = null;
        this.toast.error(extractApiError(err, 'Failed to delete document').message);
      },
    });
  }

  stageLabel(s: CaseStatus | string): string {
    return STAGE_LABEL[s as CaseStatus] ?? String(s);
  }

  noteAuthor(note: Note): string {
    if (typeof note.author === 'string') return 'Team member';
    const a = note.author;
    const name = a.name || 'Team member';
    const roleLabel = a.role ? (NOTE_AUTHOR_ROLE_LABEL[a.role] ?? a.role) : '';
    const label = roleLabel ? `${name} (${roleLabel})` : name;
    return a.email ? `${label} · ${a.email}` : label;
  }

  private mapVendorFromCase(c: CaseDetail): void {
    if (c.vendorId?._id && !c.assignedVendor) {
      c.assignedVendor = {
        _id: c.vendorId._id,
        name: c.vendorId.businessName ?? 'Assigned Vendor',
        serviceType: c.vendorId.serviceTypes?.[0] ?? '',
        city: c.vendorId.cities?.[0] ?? '',
      };
    }
  }

  // ---------- Vendor search & assign ----------
  vendorCitySummary(): string {
    const n = this.vendorSelectedCities.length;
    if (n === 0) return 'Select cities';
    if (n === this.vendorCityOptions.length) return 'All cities';
    if (n === 1) return this.vendorSelectedCities[0];
    return `${n} cities selected`;
  }

  isAllVendorCitiesSelected(): boolean {
    return this.vendorSelectedCities.length === this.vendorCityOptions.length;
  }

  toggleAllVendorCities(): void {
    this.vendorSelectedCities = this.isAllVendorCitiesSelected()
      ? []
      : [...this.vendorCityOptions];
  }

  toggleVendorCity(city: string): void {
    const idx = this.vendorSelectedCities.indexOf(city);
    if (idx === -1) this.vendorSelectedCities.push(city);
    else this.vendorSelectedCities.splice(idx, 1);
  }

  isAssignedVendor(v: VendorSearchResult): boolean {
    return this.caseDetail?.assignedVendor?._id === v._id;
  }

  private sortVendorsWithAssignedFirst(list: VendorSearchResult[]): VendorSearchResult[] {
    const assignedId = this.caseDetail?.assignedVendor?._id;
    if (!assignedId) return list;
    return [...list].sort((a, b) => {
      const aAssigned = a._id === assignedId ? 1 : 0;
      const bAssigned = b._id === assignedId ? 1 : 0;
      return bAssigned - aAssigned;
    });
  }

  searchVendors(): void {
    this.vendorCityOpen = false;
    if (!this.vendorSelectedCities.length) {
      this.toast.info('Select at least one city');
      return;
    }
    this.vendorSearching = true;
    this.vendorSearched = false;
    const params: Record<string, string> = { city: this.vendorSelectedCities.join(',') };
    if (this.vendorServiceType) params['serviceType'] = this.vendorServiceType;
    if (this.vendorMinRating !== undefined && this.vendorMinRating !== null) {
      params['minRating'] = String(this.vendorMinRating);
    }
    if (this.vendorMaxRating !== undefined && this.vendorMaxRating !== null) {
      params['maxRating'] = String(this.vendorMaxRating);
    }
    this.api.get<VendorSearchResult[]>('/vendors/route', params).subscribe({
      next: (results) => {
        this.vendorResults = this.sortVendorsWithAssignedFirst(results ?? []);
        this.vendorSearching = false;
        this.vendorSearched = true;
      },
      error: () => {
        this.vendorSearching = false;
        this.vendorSearched = true;
        this.toast.error('Failed to fetch vendors');
      },
    });
  }

  // Vendors are only assignable once they've responded to an invite (see
  // Quotes card) — vendor search is for finding/inviting candidates only.
  private assignVendorById(
    vendorId: string,
    businessName: string,
    serviceTypes?: string[],
    cities?: string[],
  ): void {
    if (!this.caseDetail || this.assigningVendorId) return;
    this.assigningVendorId = vendorId;
    this.api
      .patch<unknown>(`/cases/${this.caseDetail._id}/assign-vendor`, { vendorId })
      .subscribe({
        next: () => {
          this.assigningVendorId = '';
          this.caseDetail!.assignedVendor = {
            _id: vendorId,
            name: businessName,
            serviceType: (serviceTypes ?? [])[0] ?? '',
            city: (cities ?? [])[0] ?? '',
          };
          this.vendorResults = this.sortVendorsWithAssignedFirst(this.vendorResults);
          this.toast.success(`Assigned ${businessName} to this case`);
        },
        error: (err) => {
          this.assigningVendorId = '';
          this.toast.error(extractApiError(err, 'Failed to assign vendor').message);
        },
      });
  }

  assignVendorFromQuote(q: Quote): void {
    if (!q.vendorId) return;
    this.assignVendorById(q.vendorId._id, q.vendorId.businessName ?? 'Vendor');
  }

  isVendorIdAssigned(vendorId?: string): boolean {
    return !!vendorId && this.caseDetail?.assignedVendor?._id === vendorId;
  }

  isRespondedQuote(q: Quote): boolean {
    return (['DRAFT', 'SENT', 'NEGOTIATING', 'ACCEPTED'] as QuoteStatus[]).includes(q.status);
  }

  // The vendor's own quote is accepted/negotiated/rejected by the CM only —
  // never blocked by whatever else is going on with the case's vendor
  // assignment. DRAFT/SENT/NEGOTIATING are always actionable (NEGOTIATING is
  // just the client haggling with the CM over the client-facing price — the
  // CM can renegotiate with the vendor in parallel); an INVITED quote that
  // already has items is a pending revision request the CM just sent —
  // still negotiable (send another note, or reject outright) until the
  // vendor resubmits or the quote is finalized, not just a one-shot ask. An
  // ACCEPTED quote is negotiable too, but only once its vendor is no longer
  // the one assigned to the case (e.g. "Remove Vendor" was used after
  // acceptance) — otherwise rejecting or renegotiating an actively-assigned,
  // already-accepted quote would undercut work already in progress. Mirrors
  // isQuoteActionableByCm on the backend (quotes.service.ts).
  isQuoteActionableByCm(q: Quote): boolean {
    // Once a vendor is assigned to the case, negotiation is over for
    // everyone — the winner moves on to the client-quote/finalization step,
    // and every other vendor's still-open quote gets auto-REJECTED by the
    // backend (cases.service.ts revokeOtherVendorQuotes), which naturally
    // drops it out of the status checks below.
    if (this.caseDetail?.assignedVendor) return false;
    if (q.status === 'DRAFT' || q.status === 'SENT' || q.status === 'NEGOTIATING') return true;
    if (q.status === 'INVITED') return !!(q.items && q.items.length > 0);
    return q.status === 'ACCEPTED';
  }

  vendorQuoteFor(v: VendorSearchResult): Quote | undefined {
    return this.quotes.find((q) => q.vendorId?._id === v._id);
  }

  async unassignVendor(): Promise<void> {
    if (!this.caseDetail || !this.caseDetail.assignedVendor || this.unassigningVendor) return;
    const ok = await this.confirmDialog.confirm('Remove the assigned vendor from this case?', {
      title: 'Remove vendor',
      confirmText: 'Remove',
      danger: true,
    });
    if (!ok) return;
    this.unassigningVendor = true;
    this.api.delete<unknown>(`/cases/${this.caseDetail._id}/vendor`).subscribe({
      next: () => {
        this.unassigningVendor = false;
        this.caseDetail!.assignedVendor = undefined;
        this.caseDetail!.vendorId = undefined;
        this.vendorResults = this.sortVendorsWithAssignedFirst(this.vendorResults);
        this.toast.success('Vendor removed from case');
      },
      error: (err) => {
        this.unassigningVendor = false;
        this.toast.error(extractApiError(err, 'Failed to remove vendor').message);
      },
    });
  }

  // Quotes only ever originate from an invited vendor — an empty Quotes card
  // needs a direct path back to that flow rather than a dead-end message.
  goInviteVendor(): void {
    this.vendorSectionExpanded = true;
    setTimeout(() => {
      this.vendorAssignmentCardRef?.nativeElement.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  }

  async revokeInvite(q: Quote): Promise<void> {
    if (this.revokingQuoteId) return;
    const ok = await this.confirmDialog.confirm(
      `Revoke the invite sent to ${q.vendorId?.businessName ?? 'this vendor'}?`,
      { title: 'Revoke invite', confirmText: 'Revoke', danger: true },
    );
    if (!ok) return;
    this.revokingQuoteId = q._id;
    this.api.delete<unknown>(`/quotes/${q._id}`).subscribe({
      next: () => {
        this.revokingQuoteId = null;
        this.quotes = this.quotes.filter((qq) => qq._id !== q._id);
        this.toast.success('Invite revoked');
      },
      error: (err) => {
        this.revokingQuoteId = null;
        this.toast.error(extractApiError(err, 'Failed to revoke invite').message);
      },
    });
  }

  async deleteQuote(q: Quote): Promise<void> {
    if (this.deletingQuoteId) return;
    const ok = await this.confirmDialog.confirm(
      `Delete the rejected quote from ${q.vendorId?.businessName ?? 'this vendor'}? They'll be re-invited to submit a new one.`,
      { title: 'Delete quote', confirmText: 'Delete', danger: true },
    );
    if (!ok) return;
    this.deletingQuoteId = q._id;
    // The backend resets a deleted REJECTED quote back to INVITED rather than
    // dropping the row, so the same vendor can submit again — update in place.
    this.api.delete<Quote>(`/quotes/${q._id}`).subscribe({
      next: (updated) => {
        this.deletingQuoteId = null;
        this.quotes = this.quotes.map((qq) => (qq._id === q._id ? updated : qq));
        this.toast.success('Quote deleted — vendor re-invited to submit a new one');
      },
      error: (err) => {
        this.deletingQuoteId = null;
        this.toast.error(extractApiError(err, 'Failed to delete quote').message);
      },
    });
  }

  async rejectQuoteByCm(q: Quote): Promise<void> {
    if (this.quoteActionBusyId) return;
    const ok = await this.confirmDialog.confirm(
      `Reject the quote from ${q.vendorId?.businessName ?? 'this vendor'}?`,
      { title: 'Reject quote', confirmText: 'Reject', danger: true },
    );
    if (!ok) return;
    this.quoteActionBusyId = q._id;
    this.api.post<Quote>(`/quotes/${q._id}/reject-by-cm`, {}).subscribe({
      next: (updated) => {
        this.quoteActionBusyId = null;
        this.quotes = this.quotes.map((qq) => (qq._id === q._id ? updated : qq));
        this.toast.success('Quote rejected');
      },
      error: (err) => {
        this.quoteActionBusyId = null;
        this.toast.error(extractApiError(err, 'Failed to reject quote').message);
      },
    });
  }

  requestQuoteRevision(q: Quote): void {
    const note = q.requestNote?.trim();
    if (!note || this.quoteActionBusyId) return;
    this.quoteActionBusyId = q._id;
    this.api.post<Quote>(`/quotes/${q._id}/request-revision`, { note }).subscribe({
      next: (updated) => {
        this.quoteActionBusyId = null;
        this.quotes = this.quotes.map((qq) => (qq._id === q._id ? { ...updated, requestNote: '' } : qq));
        this.toast.success('Requested the vendor to revise their quote');
      },
      error: (err) => {
        this.quoteActionBusyId = null;
        this.toast.error(extractApiError(err, 'Failed to request revision').message);
      },
    });
  }

  anyQuoteHasUpdate(): boolean {
    return this.quotes.some((q) => q.hasUpdate);
  }

  toggleQuoteDetails(q: Quote): void {
    const opening = this.expandedQuoteId !== q._id;
    this.expandedQuoteId = opening ? q._id : '';
    if (opening && q.hasUpdate) {
      q.hasUpdate = false;
      this.api.patch(`/quotes/${q._id}/seen`, {}).subscribe({ error: () => {} });
    }
  }

  toggleClientQuoteHistory(q: Quote): void {
    q.showClientQuoteHistory = !q.showClientQuoteHistory;
  }

  addClientQuoteItem(q: Quote): void {
    if (!q.clientItems) q.clientItems = [];
    q.clientItems.push({ description: '', quantity: 1, unitPrice: 0 });
  }

  removeClientQuoteItem(q: Quote, i: number): void {
    if (!q.clientItems || q.clientItems.length <= 1) return;
    q.clientItems.splice(i, 1);
  }

  clientQuoteSubtotal(q: Quote): number {
    return (q.clientItems ?? []).reduce((sum, it) => sum + (it.quantity || 0) * (it.unitPrice || 0), 0);
  }

  // The vendor's own price for the item at the same position, if one exists
  // — a client item beyond the vendor's own item count (CM-added) has none.
  vendorUnitPriceFor(q: Quote, i: number): number | null {
    return q.items?.[i]?.unitPrice ?? null;
  }

  // Live preview only — recomputes this line's client-facing unitPrice from
  // the vendor's price + the CM's chosen margin, so the number updates as
  // they type. The server independently recomputes the same thing on save
  // and is the source of truth.
  recomputeClientItem(q: Quote, i: number): void {
    const item = q.clientItems?.[i];
    const vendorUnitPrice = this.vendorUnitPriceFor(q, i);
    if (!item || vendorUnitPrice === null || !item.marginType || item.marginValue == null) return;
    const marginAmount =
      item.marginType === 'PERCENT'
        ? (vendorUnitPrice * Number(item.marginValue)) / 100
        : Number(item.marginValue);
    item.unitPrice = Math.round((vendorUnitPrice + marginAmount) * 100) / 100;
  }

  clientQuoteTotal(q: Quote): number {
    const subtotal = this.clientQuoteSubtotal(q);
    const taxPercent = q.clientTaxPercent ?? 18;
    return Math.round((subtotal + (subtotal * taxPercent) / 100) * 100) / 100;
  }

  // While DRAFT, saving and sending are the same click — there's no reason
  // to make the CM press two separate buttons to get a quote to the client.
  // Once it's already SENT/NEGOTIATING/etc. this just saves the edit.
  saveClientQuote(q: Quote): void {
    if (!q.clientItems || q.clientItems.length === 0 || this.clientQuoteBusyId) return;
    if (!this.isClientQuoteDirty(q)) return;
    // The client-visibility filter (stripVendorFieldsForClient on the
    // backend) hides any quote still in INVITED/DRAFT/DECLINED — so
    // whenever the underlying vendor quote is in one of those, saving the
    // client-facing numbers isn't enough on its own; POST /:id/send must
    // also fire to flip status so the client can actually see it. This
    // matters beyond fresh DRAFT quotes: a quote sent back for revision
    // (requestRevision()) resets status to INVITED but deliberately leaves
    // clientItems alone, so the Client Quote panel stays open and editable
    // even in that state.
    const NOT_YET_CLIENT_VISIBLE: QuoteStatus[] = ['INVITED', 'DRAFT', 'DECLINED'];
    const shouldSend = NOT_YET_CLIENT_VISIBLE.includes(q.status);
    this.clientQuoteBusyId = q._id;
    this.api
      .patch<Quote>(`/quotes/${q._id}/client-quote`, {
        items: q.clientItems.map((it) => ({
          description: it.description,
          quantity: Number(it.quantity),
          unitPrice: Number(it.unitPrice),
          marginType: it.marginType,
          marginValue: it.marginValue != null ? Number(it.marginValue) : undefined,
        })),
        taxPercent: Number(q.clientTaxPercent) || 18,
      })
      .subscribe({
        next: (updated) => {
          if (!shouldSend) {
            this.clientQuoteBusyId = null;
            const merged = { ...q, ...updated, vendorId: q.vendorId };
            merged.clientQuoteSnapshot = this.clientQuoteSnapshotOf(merged);
            this.quotes = this.quotes.map((qq) => (qq._id === q._id ? merged : qq));
            this.toast.success('Client quote updated');
            return;
          }
          this.api.post<Quote>(`/quotes/${q._id}/send`, {}).subscribe({
            next: () => {
              this.clientQuoteBusyId = null;
              if (this.caseDetail) this.loadQuotes(this.caseDetail._id);
              this.toast.success('Quote sent to client');
            },
            error: (err) => {
              this.clientQuoteBusyId = null;
              const merged = { ...q, ...updated, vendorId: q.vendorId };
              merged.clientQuoteSnapshot = this.clientQuoteSnapshotOf(merged);
              this.quotes = this.quotes.map((qq) => (qq._id === q._id ? merged : qq));
              this.toast.error(
                extractApiError(err, 'Client quote saved, but sending it failed').message,
              );
            },
          });
        },
        error: (err) => {
          this.clientQuoteBusyId = null;
          this.toast.error(extractApiError(err, 'Failed to update client quote').message);
        },
      });
  }

  transitionStage(): void {
    if (!this.caseDetail || !this.newStatus) return;
    this.transitioning = true;
    this.api
      .patch<CaseDetail>(`/cases/${this.caseDetail._id}/stage`, {
        newStatus: this.newStatus,
        note: this.stageNote,
      })
      .subscribe({
        next: (updated) => {
          this.mapVendorFromCase(updated);
          this.caseDetail = updated;
          this.stageNote = '';
          this.newStatus = this.nextStages[0] ?? '';
          this.transitioning = false;
          this.toast.success('Stage updated successfully');
        },
        error: () => {
          this.transitioning = false;
          this.toast.error('Failed to update stage');
        },
      });
  }

  addNote(): void {
    if (!this.caseDetail || !this.newNote.trim()) return;
    this.addingNote = true;
    this.api.post<Note>(`/cases/${this.caseDetail._id}/notes`, { text: this.newNote }).subscribe({
      next: (note) => {
        this.caseDetail!.notes.push(note);
        this.newNote = '';
        this.addingNote = false;
        this.toast.success('Note added');
      },
      error: () => {
        this.addingNote = false;
        this.toast.error('Failed to add note');
      },
    });
  }

  priorityClass(priority: string): string {
    switch ((priority || '').toUpperCase()) {
      case 'HIGH':
        return 'text-error';
      case 'MEDIUM':
        return 'text-warning';
      case 'LOW':
        return 'text-success';
      default:
        return 'text-base-content';
    }
  }

  stageChipClass(status: CaseStatus | string): string {
    switch (status) {
      case CaseStatus.LEAD_CAPTURED:
        return 'bb-chip-neutral';
      case CaseStatus.FRQ_INTAKE:
        return 'bb-chip-info';
      case CaseStatus.VENDOR_SELECTION:
        return 'bb-chip-info';
      case CaseStatus.QUOTE_SENT:
        return 'bb-chip-info';
      case CaseStatus.CASE_OPEN:
        return 'bb-chip-success';
      case CaseStatus.VENDOR_WORKING:
        return 'bb-chip-warning';
      case CaseStatus.DOCUMENT_COLLECTION:
        return 'bb-chip-warning';
      case CaseStatus.QA_REVIEW:
        return 'bb-chip-info';
      case CaseStatus.CLIENT_REVIEW:
        return 'bb-chip-info';
      case CaseStatus.CLOSED:
        return 'bb-chip-neutral';
      default:
        return 'bb-chip-neutral';
    }
  }

  quoteChipClass(status: QuoteStatus): string {
    switch (status) {
      case 'INVITED':
        return 'bb-chip-warning';
      case 'DRAFT':
        return 'bb-chip-neutral';
      case 'SENT':
        return 'bb-chip-info';
      case 'ACCEPTED':
        return 'bb-chip-success';
      case 'REJECTED':
        return 'bb-chip-danger';
      case 'NEGOTIATING':
        return 'bb-chip-warning';
      case 'EXPIRED':
        return 'bb-chip-neutral';
      case 'DECLINED':
        return 'bb-chip-danger';
      default:
        return 'bb-chip-neutral';
    }
  }

}
