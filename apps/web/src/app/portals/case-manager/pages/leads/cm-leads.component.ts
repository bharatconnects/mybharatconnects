import { Component, ElementRef, HostListener, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../../../core/services/api.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { Role } from '../../../../core/models/user.model';
import { ToastService } from '../../../../core/services/toast.service';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';
import { PageTitleService } from '../../../../core/services/page-title.service';
import { DateSortOrder, sortByDate } from '../../../../shared/utils/sort-by-date.util';
import { BbSelectComponent } from '../../../../shared/components/bb-select/bb-select.component';

interface Lead {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  country: string;
  serviceType: string;
  status: string;
  intentTag?: string;
  actionTaken?: string;
  actionDate?: string;
  meetingLink?: string;
  nextFollowUpAt?: string;
  internalNote?: string;
  createdAt: string;
  updatedAt?: string;
  caseId?: string | { _id: string; caseNumber: string };
  caseInitiatedAt?: string;
  isHidden?: boolean;
  hiddenBy?: string | { _id: string; name?: string; email?: string };
  hiddenAt?: string;
}

const STATUS_CHIP: Record<string, string> = {
  HOT: 'bb-chip-danger',
  WARM: 'bb-chip-warning',
  COLD: 'bb-chip-info',
  CANCELLED: 'bb-chip-neutral',
};

const INTENT_LABEL: Record<string, string> = {
  urgent: 'Urgent',
  'high-value': 'High Value',
  'cross-sell': 'Cross-sell',
  general: 'Exploring',
};

const INTENT_CHIP: Record<string, string> = {
  urgent: 'bb-chip-danger',
  'high-value': 'bb-chip-warning',
  'cross-sell': 'bb-chip-info',
  general: 'bb-chip-neutral',
};

@Component({
  selector: 'app-cm-leads',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, BbSelectComponent],
  template: `
    <div class="flex items-center justify-end gap-3 mb-5">
      @if (!loading) {
        <span class="bb-page-count">{{ filtered.length }} of {{ leads.length }}</span>
      }
    </div>

    <div class="bb-filter-card cm-leads-filter-card sticky top-14 z-20">
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
          class="flex flex-col md:flex-row gap-3 items-end flex-wrap"
          [class.bb-filter-row--collapsed]="!filtersExpanded"
        >
          <div class="w-full md:w-40 shrink-0">
            <label class="bb-label" for="cm-leads-status">Status</label>
            <app-bb-select
              id="cm-leads-status"
              [(ngModel)]="statusFilter"
              (ngModelChange)="applyFilter()"
              ariaLabel="Filter leads by status"
              [options]="statusFilterOptions"
              placeholder="All statuses"
            ></app-bb-select>
          </div>

          <div class="w-full md:w-auto md:flex-1 min-w-0 relative" #searchWrap>
            <label class="bb-label" for="cm-leads-search">Search</label>
            <input
              id="cm-leads-search"
              class="bb-input"
              [class.pr-24]="selectedNames.length > 0"
              [(ngModel)]="searchTerm"
              (ngModelChange)="onSearchChange()"
              (focus)="onFocus()"
              placeholder="Name, email, service…"
              autocomplete="off"
            />
            @if (selectedNames.length > 0) {
              <span
                class="absolute right-2 top-[2.15rem] bb-chip bb-chip-info pointer-events-none"
                aria-hidden="true"
              >
                {{ selectedNames.length }} selected
              </span>
            }
            @if (showSuggestions && suggestions.length > 0) {
              <div class="bb-search-dd-panel bg-base-100 border border-base-300 rounded-xl shadow-lg">
                <label class="flex items-center gap-3 px-4 py-2.5 hover:bg-base-200 cursor-pointer border-b border-base-200 font-semibold text-sm">
                  <input
                    type="checkbox"
                    class="checkbox checkbox-sm checkbox-accent shrink-0"
                    [checked]="isAllSuggestionsSelected()"
                    (change)="toggleAllSuggestions()"
                  />
                  Select All
                </label>
                <div class="max-h-52 overflow-y-auto">
                  @for (s of suggestions; track s.name) {
                    <label class="flex items-center gap-3 px-4 py-2.5 hover:bg-base-200 cursor-pointer border-b border-base-200 last:border-b-0">
                      <input
                        type="checkbox"
                        class="checkbox checkbox-sm checkbox-accent shrink-0"
                        [checked]="pendingNames.includes(s.name)"
                        (change)="togglePending(s.name)"
                      />
                      <div class="flex flex-col min-w-0">
                        <span class="text-sm font-bold text-base-content truncate">{{ s.name }}</span>
                        <span class="text-xs text-base-content/70 truncate">{{ s.email }}</span>
                      </div>
                    </label>
                  }
                </div>
                <div class="px-4 py-2.5 border-t border-base-200 flex items-center justify-between gap-2">
                  <span class="text-xs text-base-content/50 whitespace-nowrap" style="min-width: 6.5rem">
                    {{ pendingNames.length ? pendingNames.length + ' selected' : 'None selected' }}
                  </span>
                  <div class="flex gap-2">
                    <button type="button" class="bb-btn bb-btn-ghost bb-btn-sm" (click)="clearSelection()">Clear</button>
                    <button type="button" class="bb-btn bb-btn-primary bb-btn-sm" (click)="applySelection()">Apply</button>
                  </div>
                </div>
              </div>
            }
          </div>

          <div class="w-full md:w-40 shrink-0">
            <label class="bb-label" for="cm-leads-meeting">Meeting link</label>
            <app-bb-select
              id="cm-leads-meeting"
              [(ngModel)]="meetingFilter"
              (ngModelChange)="applyFilter()"
              ariaLabel="Filter leads by meeting link"
              [options]="meetingFilterOptions"
              placeholder="All"
            ></app-bb-select>
          </div>

          <div class="w-full md:w-40 shrink-0">
            <label class="bb-label" for="cm-leads-action">Action</label>
            <app-bb-select
              id="cm-leads-action"
              [(ngModel)]="actionFilter"
              (ngModelChange)="applyFilter()"
              ariaLabel="Filter leads by action"
              [options]="actionFilterOptions()"
              placeholder="All actions"
            ></app-bb-select>
          </div>

          <div class="w-full md:w-40 shrink-0">
            <label class="bb-label" for="cm-leads-sort">Sort by</label>
            <app-bb-select
              id="cm-leads-sort"
              [(ngModel)]="sortOrder"
              (ngModelChange)="applyFilter()"
              ariaLabel="Sort by last update date"
              [options]="sortOrderOptions"
            ></app-bb-select>
          </div>

          <button
            type="button"
            class="bb-btn bb-btn-ghost shrink-0 self-end"
            [class.invisible]="!(statusFilter || selectedNames.length || meetingFilter || actionFilter)"
            (click)="clearFilters()"
            [disabled]="!(statusFilter || selectedNames.length || meetingFilter || actionFilter)"
            aria-label="Clear filters"
          >
            <i class="material-icons-outlined text-base">clear</i>
            Clear
          </button>
        </div>
    </div>

    @if (loading) {
      <div class="flex justify-center py-16 mt-4">
        <span class="loading loading-spinner loading-md text-primary" aria-label="Loading"></span>
      </div>
    } @else if (filtered.length === 0) {
      <div class="bb-card">
        <div class="bb-empty">
          <div class="bb-empty-icon"><i class="material-icons-outlined">inbox</i></div>
          <p class="bb-empty-title">No leads found</p>
          <p>New leads from the public website will appear here.</p>
        </div>
      </div>
    } @else {
      <div class="flex flex-col gap-3 mt-4">
        @for (l of pagedLeads; track l._id) {
          <div class="bb-row-card cm-lead-card">
            <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
              <div class="cm-lead-info-row min-w-0">
                <span class="cm-lead-name">{{ l.name }}</span>
                <div class="cm-lead-email">
                  <i class="material-icons-outlined text-sm">mail</i>
                  <span>{{ l.email }}</span>
                </div>
                @if (caseNumberOf(l); as caseNumber) {
                  <a [routerLink]="['/case-manager/cases', caseNumber]" class="cm-lead-case-badge">
                    <i class="material-icons-outlined text-sm">folder_open</i>
                    Case {{ caseNumber }}
                  </a>
                }
                <span class="cm-lead-tag">{{ l.country || 'Unknown country' }}</span>
                @if (l.serviceType) {
                  <span class="cm-lead-tag">{{ l.serviceType }}</span>
                }
              </div>
              <div class="flex flex-wrap items-center gap-2">
                @if (l.isHidden) {
                  <span class="bb-chip bb-chip-neutral">
                    <i class="material-icons-outlined text-sm align-middle">visibility_off</i>
                    Hidden
                  </span>
                }
                @if (l.intentTag; as intentTag) {
                  <span class="bb-chip" [ngClass]="intentChipClass(intentTag)">{{
                    intentLabel(intentTag)
                  }}</span>
                }
                <span class="bb-chip" [ngClass]="statusChipClass(l.status)">{{ l.status }}</span>
                <button
                  type="button"
                  class="bb-btn bb-btn-ghost bb-btn-sm"
                  (click)="toggleDetails(l)"
                >
                  <i class="material-icons-outlined text-base">{{
                    expandedLeadId === l._id ? 'expand_less' : 'expand_more'
                  }}</i>
                  {{ expandedLeadId === l._id ? 'Hide' : 'Update' }}
                </button>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3 cm-lead-meta">
              <div class="cm-lead-meta-item">
                <span class="cm-lead-meta-label">Created:</span>
                <span>{{ l.createdAt | date: 'mediumDate' }}</span>
              </div>
              <div class="cm-lead-meta-item">
                <span class="cm-lead-meta-label">Action:</span>
                <span>{{ l.actionTaken || '—' }}</span>
              </div>
              <div class="cm-lead-meta-item">
                <span class="cm-lead-meta-label">Action date:</span>
                <span>{{ l.actionDate ? (l.actionDate | date: 'mediumDate') : '—' }}</span>
              </div>
            </div>

            @if (l.meetingLink) {
              <p class="text-sm mt-2 cm-lead-link-row">
                Meeting link:
                <a [href]="l.meetingLink" target="_blank" rel="noopener" class="font-mono text-xs text-[var(--saffron)] hover:underline"
                  >Open</a
                >
              </p>
            }

            @if (l.isHidden) {
              <p class="text-xs mt-2 text-base-content/60">
                <i class="material-icons-outlined text-sm align-middle">visibility_off</i>
                Hidden by {{ hiddenByName(l) }}{{ l.hiddenAt ? ' · ' + (l.hiddenAt | date: 'medium') : '' }}
              </p>
            }

            @if (expandedLeadId === l._id) {
              <div class="mt-3 pt-3 border-t border-base-300 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label class="bb-label">Status</label>
                  <app-bb-select
                    [(ngModel)]="draftByLead[l._id].status"
                    [options]="draftStatusOptions"
                  ></app-bb-select>
                </div>
                <div>
                  <label class="bb-label">Action Taken</label>
                  <input class="bb-input" [(ngModel)]="draftByLead[l._id].actionTaken" />
                </div>
                <div>
                  <label class="bb-label">Action Date</label>
                  <input class="bb-input" type="date" [(ngModel)]="draftByLead[l._id].actionDate" />
                </div>
                <div>
                  <label class="bb-label">Next Follow-up</label>
                  <input
                    class="bb-input"
                    type="date"
                    [(ngModel)]="draftByLead[l._id].nextFollowUpAt"
                  />
                </div>
                <div class="md:col-span-2">
                  <label class="bb-label">Meeting Link</label>
                  <div class="flex items-center gap-2">
                    <input
                      class="bb-input flex-1"
                      [class.cm-input-error]="draftByLead[l._id].meetingLink && !isValidMeetingUrl(draftByLead[l._id].meetingLink)"
                      placeholder="https://meet.google.com/..."
                      [(ngModel)]="draftByLead[l._id].meetingLink"
                    />
                    <button
                      type="button"
                      class="bb-btn bb-btn-secondary cm-send-link-btn"
                      (click)="shareMeetingLink(l)"
                      [disabled]="savingLeadId === l._id || !hasMeetingLinkDraft(l._id)"
                      aria-label="Send meeting link"
                    >
                      <i class="material-icons-outlined text-base">send</i>
                      <span class="hidden sm:inline">Send meeting link</span>
                    </button>
                  </div>
                  @if (draftByLead[l._id].meetingLink && !isValidMeetingUrl(draftByLead[l._id].meetingLink)) {
                    <p class="cm-field-error">
                      <i class="material-icons-outlined" style="font-size: 0.9rem">error_outline</i>
                      Enter a valid URL starting with https:// or http://
                    </p>
                  }
                </div>
                <div class="md:col-span-2">
                  <label class="bb-label">Internal Note</label>
                  <textarea
                    class="bb-textarea"
                    rows="2"
                    [(ngModel)]="draftByLead[l._id].internalNote"
                  ></textarea>
                </div>
              </div>

              <div class="flex items-center justify-end gap-2 mt-3 flex-wrap">
                @if (caseNumberOf(l); as caseNumber) {
                  <button
                    type="button"
                    class="bb-btn bb-btn-outline bb-btn-sm"
                    (click)="initiateCase(l)"
                    [disabled]="initiatingLeadId === l._id"
                  >
                    <i class="material-icons-outlined text-base">mail</i>
                    {{ initiatingLeadId === l._id ? 'Sending…' : (l.caseInitiatedAt ? 'Resend Initiate Email' : 'Initiate Case') }}
                  </button>
                } @else {
                  @if (isAdmin) {
                    <button
                      type="button"
                      class="bb-btn bb-btn-ghost bb-btn-sm cm-delete-lead-btn"
                      (click)="deleteLead(l)"
                      [disabled]="deletingLeadId === l._id || creatingCaseLeadId === l._id"
                    >
                      <i class="material-icons-outlined text-base">delete_outline</i>
                      {{ deletingLeadId === l._id ? 'Deleting…' : 'Delete Lead' }}
                    </button>
                  } @else if (!l.isHidden) {
                    <button
                      type="button"
                      class="bb-btn bb-btn-ghost bb-btn-sm"
                      (click)="hideLead(l)"
                      [disabled]="hidingLeadId === l._id || creatingCaseLeadId === l._id"
                    >
                      <i class="material-icons-outlined text-base">visibility_off</i>
                      {{ hidingLeadId === l._id ? 'Hiding…' : 'Hide Lead' }}
                    </button>
                  }
                  <button
                    type="button"
                    class="bb-btn bb-btn-secondary bb-btn-sm"
                    (click)="createCase(l)"
                    [disabled]="creatingCaseLeadId === l._id || deletingLeadId === l._id || hidingLeadId === l._id"
                  >
                    <i class="material-icons-outlined text-base">add_circle_outline</i>
                    {{ creatingCaseLeadId === l._id ? 'Creating…' : 'Create Case' }}
                  </button>
                }
                <button
                  type="button"
                  class="bb-btn bb-btn-primary bb-btn-sm"
                  (click)="saveLead(l)"
                  [disabled]="savingLeadId === l._id"
                >
                  {{ savingLeadId === l._id ? 'Saving…' : 'Save update' }}
                </button>
              </div>
            }
          </div>
        }
      </div>

      @if (totalPages > 1) {
        <div class="flex items-center justify-between mt-5 text-sm">
          <span style="color: var(--ink-60)">
            Showing {{ currentPage * pageSize + 1 }}–{{ pageEnd }} of {{ filtered.length }}
          </span>
          <div class="flex gap-2">
            <button
              class="bb-btn bb-btn-ghost bb-btn-sm"
              [disabled]="currentPage === 0"
              (click)="currentPage = currentPage - 1"
            >
              <i class="material-icons-outlined text-base">chevron_left</i>
            </button>
            @for (p of pageNumbers; track p) {
              <button
                class="bb-btn bb-btn-sm"
                [class.bb-btn-primary]="p === currentPage"
                [class.bb-btn-ghost]="p !== currentPage"
                (click)="currentPage = p"
              >{{ p + 1 }}</button>
            }
            <button
              class="bb-btn bb-btn-ghost bb-btn-sm"
              [disabled]="currentPage === totalPages - 1"
              (click)="currentPage = currentPage + 1"
            >
              <i class="material-icons-outlined text-base">chevron_right</i>
            </button>
          </div>
        </div>
      }
    }
  `,
  styles: [
    `
      .cm-leads-filter-card {
        background: var(--field-bg);
        border-color: var(--ink-12);
        box-shadow: 0 1px 3px rgba(15, 26, 46, 0.06);
        position: sticky;
        top: 3.5rem;
        z-index: 20;
      }

      .cm-lead-card {
        background: var(--field-bg);
        border-color: var(--ink-12);
        box-shadow: 0 1px 3px rgba(15, 26, 46, 0.06);
      }

      .cm-lead-name {
        font-size: 1.0625rem;
        line-height: 1.35;
        font-weight: 700;
        color: var(--ink);
      }

      .cm-lead-info-row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.4rem;
      }

      .cm-lead-email {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.15rem 0.5rem;
        border-radius: 9999px;
        font-size: 0.875rem;
        line-height: 1.35;
        background: var(--ivory);
        color: var(--ink-80);
      }

      .cm-lead-tag {
        display: inline-flex;
        align-items: center;
        padding: 0.1rem 0.45rem;
        border-radius: 9999px;
        font-size: 0.75rem;
        font-weight: 600;
        line-height: 1.35;
        color: #92400e;
        background: rgba(217, 119, 6, 0.14);
      }

      .cm-lead-meta {
        font-size: 0.875rem;
        line-height: 1.4;
        color: var(--ink-80);
      }

      .cm-lead-meta-item {
        display: flex;
        align-items: center;
        gap: 0.3rem;
        padding: 0.2rem 0.45rem;
        border-radius: 0.35rem;
        background: var(--ivory-soft);
      }

      .cm-lead-meta-label {
        font-weight: 700;
        color: var(--ink);
      }

      .cm-lead-link-row {
        color: var(--ink-80);
      }

      .cm-send-link-btn {
        width: 2.75rem;
        min-width: 2.75rem;
        padding: 0;
      }

      @media (min-width: 640px) {
        .cm-send-link-btn {
          width: auto;
          min-width: 0;
          padding: 0 1rem;
        }
      }

      .cm-input-error {
        border-color: #dc2626 !important;
        box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.12) !important;
      }

      .cm-field-error {
        display: flex;
        align-items: center;
        gap: 0.3rem;
        margin-top: 0.35rem;
        font-size: 0.75rem;
        font-weight: 500;
        color: #dc2626;
      }

      .cm-lead-case-badge {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        padding: 0.25rem 0.65rem;
        border-radius: 9999px;
        font-size: 0.8125rem;
        font-weight: 600;
        color: #15803d;
        background: rgba(21, 128, 61, 0.1);
        text-decoration: none;
        transition: background-color 120ms ease;
      }
      a.cm-lead-case-badge:hover {
        background: rgba(21, 128, 61, 0.18);
      }

      .cm-delete-lead-btn {
        color: #dc2626;
      }
    `,
  ],
})
export class CmLeadsComponent implements OnInit {
  leads: Lead[] = [];
  filtered: Lead[] = [];
  statusFilter = '';
  searchTerm = '';
  meetingFilter = '';
  actionFilter = '';
  sortOrder: DateSortOrder = 'desc';
  filtersExpanded = true;

  activeFilterCount(): number {
    return (
      (this.statusFilter ? 1 : 0) +
      (this.selectedNames.length ? 1 : 0) +
      (this.meetingFilter ? 1 : 0) +
      (this.actionFilter ? 1 : 0)
    );
  }

  readonly statusFilterOptions = [
    { value: '', label: 'All statuses' },
    { value: 'HOT', label: 'Hot' },
    { value: 'WARM', label: 'Warm' },
    { value: 'COLD', label: 'Cold' },
    { value: 'CANCELLED', label: 'Cancelled' },
  ];
  readonly meetingFilterOptions = [
    { value: '', label: 'All' },
    { value: 'with-link', label: 'With link' },
    { value: 'without-link', label: 'Without link' },
  ];
  readonly sortOrderOptions = [
    { value: 'desc', label: 'Newest first' },
    { value: 'asc', label: 'Oldest first' },
  ];
  readonly draftStatusOptions = [
    { value: 'HOT', label: 'Hot' },
    { value: 'WARM', label: 'Warm' },
    { value: 'COLD', label: 'Cold' },
  ];

  actionFilterOptions(): { value: string; label: string }[] {
    return [{ value: '', label: 'All actions' }, ...this.actionOptions.map((a) => ({ value: a, label: a }))];
  }
  loading = true;
  savingLeadId = '';
  creatingCaseLeadId = '';
  deletingLeadId = '';
  hidingLeadId = '';
  initiatingLeadId = '';
  expandedLeadId = '';
  showSuggestions = false;
  suggestions: { name: string; email: string }[] = [];
  selectedNames: string[] = [];
  pendingNames: string[] = [];
  currentPage = 0;
  readonly pageSize = 25;
  @ViewChild('searchWrap') searchWrapRef?: ElementRef<HTMLElement>;

  get pagedLeads(): Lead[] {
    return this.filtered.slice(this.currentPage * this.pageSize, (this.currentPage + 1) * this.pageSize);
  }
  get totalPages(): number { return Math.ceil(this.filtered.length / this.pageSize); }
  get pageEnd(): number { return Math.min((this.currentPage + 1) * this.pageSize, this.filtered.length); }
  get pageNumbers(): number[] { return Array.from({ length: this.totalPages }, (_, i) => i); }
  draftByLead: Record<
    string,
    {
      status: string;
      actionTaken: string;
      actionDate: string;
      meetingLink: string;
      nextFollowUpAt: string;
      internalNote: string;
    }
  > = {};

  constructor(
    private api: ApiService,
    private authService: AuthService,
    private toast: ToastService,
    private confirmDialog: ConfirmDialogService,
    private pageTitleService: PageTitleService,
  ) {}

  // Only ADMIN may delete leads — this page is also mounted under
  // /admin/leads (see admin.routes.ts) where the Delete action should show;
  // under /case-manager/leads it stays hidden.
  get isAdmin(): boolean {
    return this.authService.role === Role.ADMIN;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (
      this.showSuggestions &&
      this.searchWrapRef &&
      !this.searchWrapRef.nativeElement.contains(event.target as Node)
    ) {
      this.showSuggestions = false;
    }
  }

  ngOnInit(): void {
    this.pageTitleService.set('Leads');
    this.api.get<Lead[]>('/leads').subscribe({
      next: (l) => {
        this.leads = l || [];
        this.leads.forEach((lead) => this.ensureDraft(lead));
        this.applyFilter();
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.toast.error('Failed to load leads');
      },
    });
  }

  applyFilter(): void {
    this.currentPage = 0;
    const filtered = this.leads.filter((l) => {
      if (this.statusFilter && l.status !== this.statusFilter) return false;
      if (this.meetingFilter === 'with-link' && !l.meetingLink) return false;
      if (this.meetingFilter === 'without-link' && !!l.meetingLink) return false;
      if (this.actionFilter && (l.actionTaken || '').trim() !== this.actionFilter) return false;
      if (this.selectedNames.length > 0) return this.selectedNames.includes(l.name);
      return true;
    });
    this.filtered = sortByDate(filtered, this.sortOrder);
  }

  onFocus(): void {
    this.pendingNames = [...this.selectedNames];
    this.updateSuggestions();
    this.showSuggestions = this.suggestions.length > 0;
  }

  onSearchChange(): void {
    this.updateSuggestions();
    this.showSuggestions = this.suggestions.length > 0;
  }

  togglePending(name: string): void {
    const idx = this.pendingNames.indexOf(name);
    if (idx >= 0) this.pendingNames.splice(idx, 1);
    else this.pendingNames.push(name);
  }

  isAllSuggestionsSelected(): boolean {
    return (
      this.suggestions.length > 0 &&
      this.suggestions.every((s) => this.pendingNames.includes(s.name))
    );
  }

  toggleAllSuggestions(): void {
    if (this.isAllSuggestionsSelected()) {
      const suggestionNames = new Set(this.suggestions.map((s) => s.name));
      this.pendingNames = this.pendingNames.filter((n) => !suggestionNames.has(n));
    } else {
      const merged = new Set(this.pendingNames);
      this.suggestions.forEach((s) => merged.add(s.name));
      this.pendingNames = Array.from(merged);
    }
  }

  applySelection(): void {
    this.selectedNames = [...this.pendingNames];
    this.showSuggestions = false;
    this.applyFilter();
  }

  clearSelection(): void {
    this.pendingNames = [];
    this.selectedNames = [];
    this.searchTerm = '';
    this.updateSuggestions();
    this.applyFilter();
  }

  private updateSuggestions(): void {
    const term = this.searchTerm.trim().toLowerCase();
    const matched = term
      ? this.leads.filter(l =>
          l.name.toLowerCase().includes(term) ||
          l.email.toLowerCase().includes(term) ||
          (l.serviceType && l.serviceType.toLowerCase().includes(term))
        )
      : this.leads;
    const seen = new Set<string>();
    this.suggestions = [];
    for (const l of matched) {
      if (!seen.has(l.name)) {
        seen.add(l.name);
        this.suggestions.push({ name: l.name, email: l.email });
      }
      if (this.suggestions.length >= 15) break;
    }
  }

  clearFilters(): void {
    this.statusFilter = '';
    this.searchTerm = '';
    this.meetingFilter = '';
    this.actionFilter = '';
    this.selectedNames = [];
    this.pendingNames = [];
    this.suggestions = [];
    this.showSuggestions = false;
    this.applyFilter();
  }

  get actionOptions(): string[] {
    return [...new Set(this.leads.map((l) => (l.actionTaken || '').trim()).filter(Boolean))].sort(
      (a, b) => a.localeCompare(b),
    );
  }

  toggleDetails(lead: Lead): void {
    this.ensureDraft(lead);
    this.expandedLeadId = this.expandedLeadId === lead._id ? '' : lead._id;
  }

  saveLead(lead: Lead): void {
    const draft = this.draftByLead[lead._id];
    if (!draft) return;
    if (draft.meetingLink && !this.isValidMeetingUrl(draft.meetingLink)) {
      this.toast.error('Please enter a valid meeting link URL');
      return;
    }
    this.savingLeadId = lead._id;
    this.api
      .patch<Lead>(`/leads/${lead._id}`, {
        status: draft.status,
        actionTaken: draft.actionTaken,
        actionDate: draft.actionDate || undefined,
        meetingLink: draft.meetingLink || undefined,
        nextFollowUpAt: draft.nextFollowUpAt || undefined,
        internalNote: draft.internalNote || undefined,
      })
      .subscribe({
        next: (updated) => {
          this.replaceLead(updated);
          this.savingLeadId = '';
          this.toast.success('Lead updated');
        },
        error: () => {
          this.savingLeadId = '';
          this.toast.error('Failed to update lead');
        },
      });
  }

  shareMeetingLink(lead: Lead): void {
    const draft = this.draftByLead[lead._id];
    if (!draft?.meetingLink?.trim()) {
      this.toast.info('Add a meeting link first');
      return;
    }
    this.savingLeadId = lead._id;
    this.api
      .patch<Lead>(`/leads/${lead._id}/meeting-link`, {
        meetingLink: draft.meetingLink,
        actionTaken: draft.actionTaken || 'Meeting link shared',
      })
      .subscribe({
        next: (updated) => {
          this.replaceLead(updated);
          this.savingLeadId = '';
          this.toast.success('Meeting link sent to lead');
        },
        error: () => {
          this.savingLeadId = '';
          this.toast.error('Failed to send meeting link');
        },
      });
  }

  isValidMeetingUrl(url: string): boolean {
    if (!url?.trim()) return true;
    try {
      const u = new URL(url.trim());
      return u.protocol === 'https:' || u.protocol === 'http:';
    } catch {
      return false;
    }
  }

  hasMeetingLinkDraft(leadId: string): boolean {
    const url = this.draftByLead[leadId]?.meetingLink?.trim();
    return !!url && this.isValidMeetingUrl(url);
  }

  private replaceLead(updated: Lead): void {
    const index = this.leads.findIndex((l) => l._id === updated._id);
    if (index !== -1) this.leads[index] = updated;
    this.ensureDraft(updated);
    this.applyFilter();
  }

  private ensureDraft(lead: Lead): void {
    this.draftByLead[lead._id] = {
      status: lead.status || 'COLD',
      actionTaken: lead.actionTaken || '',
      actionDate: lead.actionDate ? String(lead.actionDate).slice(0, 10) : '',
      meetingLink: lead.meetingLink || '',
      nextFollowUpAt: lead.nextFollowUpAt ? String(lead.nextFollowUpAt).slice(0, 10) : '',
      internalNote: lead.internalNote || '',
    };
  }

  statusChipClass(status: string): string {
    return STATUS_CHIP[status] ?? 'bb-chip-neutral';
  }

  intentLabel(intentTag: string): string {
    return INTENT_LABEL[intentTag] ?? intentTag;
  }

  intentChipClass(intentTag: string): string {
    return INTENT_CHIP[intentTag] ?? 'bb-chip-neutral';
  }

  caseNumberOf(lead: Lead): string | null {
    const c = lead.caseId;
    if (!c) return null;
    return typeof c === 'string' ? null : c.caseNumber;
  }

  createCase(lead: Lead): void {
    this.creatingCaseLeadId = lead._id;
    this.api.post<{ lead: Lead; case: { caseNumber: string } }>(`/leads/${lead._id}/create-case`, {}).subscribe({
      next: ({ lead: updated }) => {
        this.replaceLead(updated);
        this.creatingCaseLeadId = '';
        this.toast.success('Case created');
      },
      error: () => {
        this.creatingCaseLeadId = '';
        this.toast.error('Failed to create case');
      },
    });
  }

  initiateCase(lead: Lead): void {
    this.initiatingLeadId = lead._id;
    this.api.post<Lead>(`/leads/${lead._id}/initiate`, {}).subscribe({
      next: (updated) => {
        this.replaceLead(updated);
        this.initiatingLeadId = '';
        this.toast.success('Initiate email sent to lead');
      },
      error: () => {
        this.initiatingLeadId = '';
        this.toast.error('Failed to send initiate email');
      },
    });
  }

  async deleteLead(lead: Lead): Promise<void> {
    const ok = await this.confirmDialog.confirm(
      `Delete lead "${lead.name}"? This cannot be undone.`,
      { title: 'Delete lead', confirmText: 'Delete', danger: true },
    );
    if (!ok) return;
    this.deletingLeadId = lead._id;
    this.api.delete<{ message: string }>(`/leads/${lead._id}`).subscribe({
      next: () => {
        this.leads = this.leads.filter((l) => l._id !== lead._id);
        this.deletingLeadId = '';
        this.applyFilter();
        this.toast.success('Lead deleted');
      },
      error: () => {
        this.deletingLeadId = '';
        this.toast.error('Failed to delete lead — it may already have a case');
      },
    });
  }

  async hideLead(lead: Lead): Promise<void> {
    const ok = await this.confirmDialog.confirm(
      `Hide lead "${lead.name}"? It will drop off your list — an admin can still see and delete it.`,
      { title: 'Hide lead', confirmText: 'Hide' },
    );
    if (!ok) return;
    this.hidingLeadId = lead._id;
    this.api.patch<Lead>(`/leads/${lead._id}/hide`, {}).subscribe({
      next: () => {
        // Backend excludes hidden leads for CASE_MANAGER — drop it locally
        // rather than waiting on a reload.
        this.leads = this.leads.filter((l) => l._id !== lead._id);
        this.hidingLeadId = '';
        this.applyFilter();
        this.toast.success('Lead hidden');
      },
      error: () => {
        this.hidingLeadId = '';
        this.toast.error('Failed to hide lead');
      },
    });
  }

  hiddenByName(lead: Lead): string {
    const h = lead.hiddenBy;
    if (!h) return 'someone';
    if (typeof h === 'string') return h;
    return (h.name ?? '').trim() || h.email || 'someone';
  }
}
