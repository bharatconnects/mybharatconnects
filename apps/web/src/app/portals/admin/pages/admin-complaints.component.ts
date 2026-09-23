import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { PageTitleService } from '../../../core/services/page-title.service';
import { DateSortOrder, sortByDate } from '../../../shared/utils/sort-by-date.util';
import { BbSelectComponent } from '../../../shared/components/bb-select/bb-select.component';

interface Complaint {
  _id: string;
  subject: string;
  body?: string;
  description?: string;
  category: string;
  status: string;
  raisedBy:
    | string
    | { _id?: string; name?: string; email?: string; role?: string };
  caseId?: string | { _id?: string; caseNumber?: string; title?: string };
  assignedTo?: string | { _id?: string; name?: string; email?: string };
  resolution?: string;
  createdAt: string;
  updatedAt?: string;
  resolveText?: string;
  resolving?: boolean;
}

interface CaseManager {
  _id: string;
  name: string;
  email?: string;
}

@Component({
  selector: 'app-admin-complaints',
  standalone: true,
  imports: [CommonModule, FormsModule, BbSelectComponent],
  template: `
    <div class="flex items-center justify-between gap-3 mb-5">
      <p class="text-sm text-base-content/60 min-w-0 truncate">
        Review, assign, and resolve incoming complaints.
      </p>
      <span class="bb-page-count">{{ complaints.length }} total</span>
    </div>

    <div class="bb-filter-card mb-4">
      <label class="bb-label" for="complaints-sort">Sort by</label>
      <app-bb-select
        id="complaints-sort"
        [(ngModel)]="sortOrder"
        (ngModelChange)="applySort()"
        ariaLabel="Sort by last update date"
        [options]="sortOrderOptions"
      ></app-bb-select>
    </div>

    @if (loading) {
      <div class="flex justify-center py-16">
        <span class="loading loading-spinner loading-md text-primary" aria-label="Loading"></span>
      </div>
    } @else if (complaints.length === 0) {
      <div class="bb-card">
        <div class="bb-empty">
          <div class="bb-empty-icon"><i class="material-icons-outlined">support_agent</i></div>
          <p class="bb-empty-title">No complaints</p>
          <p>Nothing waiting on support right now.</p>
        </div>
      </div>
    } @else {
      <!-- Desktop table -->
      <div class="hidden md:block bb-table-wrap">
        <div class="bb-table-scroll">
          <table class="bb-table">
            <thead>
              <tr>
                <th class="w-64 min-w-56">Subject</th>
                <th>Category</th>
                <th>Status</th>
                <th>Case</th>
                <th>Raised By</th>
                <th>Assigned To</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (c of complaints; track c._id) {
                <tr class="align-top">
                  <td class="w-64 min-w-56">
                    <button
                      class="inline-flex items-center gap-1 text-left font-medium text-primary hover:underline leading-snug"
                      (click)="openDetail(c)"
                    >
                      <span>{{ c.subject }}</span>
                      <svg
                        class="bb-icon-svg shrink-0"
                        style="width: 1rem; height: 1rem"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        aria-hidden="true"
                      >
                        <polyline points="9 6 15 12 9 18"></polyline>
                      </svg>
                    </button>
                  </td>
                  <td>{{ c.category }}</td>
                  <td>
                    <span class="bb-chip" [ngClass]="statusChipClass(c.status)">{{
                      formatStatus(c.status)
                    }}</span>
                  </td>
                  <td class="font-mono text-xs">{{ getCaseRef(c.caseId) }}</td>
                  <td>
                    <div class="flex items-center gap-1.5">
                      <span>{{ getRaiserName(c.raisedBy) }}</span>
                      @if (getRaiserRole(c.raisedBy)) {
                        <span class="bb-chip bb-chip-neutral text-[10px] py-0">{{
                          getRaiserRole(c.raisedBy)
                        }}</span>
                      }
                    </div>
                    @if (getRaiserEmail(c.raisedBy)) {
                      <div class="text-xs" style="color:var(--ink-80)">
                        {{ getRaiserEmail(c.raisedBy) }}
                      </div>
                    }
                  </td>
                  <td>
                    <div>{{ getAssigneeName(c.assignedTo) }}</div>
                    @if (getAssigneeEmail(c.assignedTo)) {
                      <div class="text-xs" style="color:var(--ink-80)">
                        {{ getAssigneeEmail(c.assignedTo) }}
                      </div>
                    }
                  </td>
                  <td class="whitespace-nowrap">{{ c.createdAt | date: 'mediumDate' }}</td>
                  <td>
                    @if (c.status !== 'RESOLVED' && c.status !== 'resolved') {
                      <div class="flex flex-col gap-2">
                        <label class="sr-only" [attr.for]="'resolve-' + c._id"
                          >Resolution note for {{ c.subject }}</label
                        >
                        <input
                          [id]="'resolve-' + c._id"
                          class="bb-input"
                          type="text"
                          [(ngModel)]="c.resolveText"
                          placeholder="Resolution note..."
                          [attr.aria-label]="'Resolution note for ' + c.subject"
                        />
                        <div class="flex gap-2">
                          <button
                            class="bb-btn bb-btn-outline bb-btn-sm"
                            (click)="openAssignModal(c)"
                            [disabled]="c.resolving"
                          >
                            <i class="material-icons-outlined text-base">assignment_ind</i>
                            <span>Assign</span>
                          </button>
                          <button
                            class="bb-btn bb-btn-secondary bb-btn-sm"
                            (click)="resolve(c)"
                            [disabled]="c.resolving || !c.resolveText?.trim()"
                          >
                            <i class="material-icons-outlined text-base">check_circle</i>
                            <span>Resolve</span>
                          </button>
                        </div>
                      </div>
                    } @else {
                      <span class="inline-flex items-center gap-1 text-success text-sm">
                        <i class="material-icons-outlined text-base">done_all</i>
                        Resolved
                      </span>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- Mobile card list -->
      <div class="md:hidden flex flex-col gap-3">
        @for (c of complaints; track c._id) {
          <div class="bb-row-card">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <button
                  class="inline-flex items-center gap-1 text-left font-medium text-primary hover:underline"
                  (click)="openDetail(c)"
                >
                  <span>{{ c.subject }}</span>
                  <svg
                    class="bb-icon-svg shrink-0"
                    style="width: 1rem; height: 1rem"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="9 6 15 12 9 18"></polyline>
                  </svg>
                </button>
                <p class="text-sm text-base-content/70 truncate mt-0.5">{{ c.category }}</p>
              </div>
              <span class="bb-chip shrink-0" [ngClass]="statusChipClass(c.status)">{{
                formatStatus(c.status)
              }}</span>
            </div>
            <div class="mt-2 text-xs text-base-content/60 flex flex-col gap-0.5">
              @if (getCaseRef(c.caseId) !== '—') {
                <div>
                  Case: <span class="font-mono">{{ getCaseRef(c.caseId) }}</span>
                </div>
              }
              <div>
                Raised by: {{ getRaiserName(c.raisedBy)
                }}{{ getRaiserRole(c.raisedBy) ? ' (' + getRaiserRole(c.raisedBy) + ')' : '' }}
              </div>
              @if (getAssigneeName(c.assignedTo) !== '—') {
                <div>Assigned to: {{ getAssigneeName(c.assignedTo) }}</div>
              }
              <div>Created: {{ c.createdAt | date: 'mediumDate' }}</div>
            </div>
            @if (c.status !== 'RESOLVED' && c.status !== 'resolved') {
              <div class="mt-3 flex flex-col gap-2">
                <input
                  class="bb-input"
                  type="text"
                  [(ngModel)]="c.resolveText"
                  placeholder="Resolution note..."
                  [attr.aria-label]="'Resolution note for ' + c.subject"
                />
                <div class="flex gap-2">
                  <button
                    class="bb-btn bb-btn-outline bb-btn-sm flex-1"
                    (click)="openAssignModal(c)"
                    [disabled]="c.resolving"
                  >
                    <i class="material-icons-outlined text-base">assignment_ind</i>
                    Assign
                  </button>
                  <button
                    class="bb-btn bb-btn-secondary bb-btn-sm flex-1"
                    (click)="resolve(c)"
                    [disabled]="c.resolving || !c.resolveText?.trim()"
                  >
                    <i class="material-icons-outlined text-base">check_circle</i>
                    Resolve
                  </button>
                </div>
              </div>
            } @else {
              <div class="mt-2 inline-flex items-center gap-1 text-success text-sm">
                <i class="material-icons-outlined text-base">done_all</i>
                Resolved
              </div>
            }
          </div>
        }
      </div>
    }

    @if (!loading && error) {
      <div
        class="flex items-center gap-2 px-4 py-2.5 rounded-lg mt-4 text-sm bg-error/10 text-error border border-error/20"
      >
        <i class="material-icons-outlined text-base">error_outline</i>
        Failed to load complaints. Please try again.
      </div>
    }

    <!-- Detail modal -->
    @if (showDetailModal && selectedComplaint) {
      <dialog class="modal modal-open">
        <div class="modal-box max-w-lg max-h-[85vh] flex flex-col p-0 overflow-hidden">
          <!-- Header -->
          <div
            class="flex items-center justify-between px-5 py-4 border-b border-base-300 shrink-0"
          >
            <div class="flex items-center gap-2">
              <i class="material-icons-outlined text-base-content/50">support_agent</i>
              <h2 class="font-semibold text-base-content">Complaint Detail</h2>
            </div>
            <button class="bb-btn bb-btn-ghost bb-btn-icon" (click)="closeDetail()">
              <i class="material-icons-outlined">close</i>
            </button>
          </div>

          <!-- Body -->
          <div class="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
            <!-- Status + Category chips -->
            <div class="flex flex-wrap gap-2">
              <span class="bb-chip" [ngClass]="statusChipClass(selectedComplaint.status)">
                {{ formatStatus(selectedComplaint.status) }}
              </span>
              <span class="bb-chip bb-chip-neutral">{{ selectedComplaint.category }}</span>
            </div>

            <!-- Subject -->
            <div>
              <p class="text-xs font-semibold uppercase tracking-wide text-base-content/50 mb-1">
                Subject
              </p>
              <p class="font-semibold text-base-content text-base">
                {{ selectedComplaint.subject }}
              </p>
            </div>

            <!-- Body / Description -->
            @if (selectedComplaint.body || selectedComplaint.description) {
              <div>
                <p class="text-xs font-semibold uppercase tracking-wide text-base-content/50 mb-1">
                  Description
                </p>
                <p class="text-sm text-base-content/80 whitespace-pre-wrap leading-relaxed">
                  {{ selectedComplaint.body || selectedComplaint.description }}
                </p>
              </div>
            }

            <!-- Case reference -->
            @if (selectedComplaint.caseId) {
              <div>
                <p class="text-xs font-semibold uppercase tracking-wide text-base-content/50 mb-1">
                  Case
                </p>
                <p class="font-mono text-sm">{{ getCaseRef(selectedComplaint.caseId) }}</p>
                @if (getCaseTitle(selectedComplaint.caseId)) {
                  <p class="text-xs text-base-content/60 mt-0.5">
                    {{ getCaseTitle(selectedComplaint.caseId) }}
                  </p>
                }
              </div>
            }

            <!-- Raised by -->
            <div>
              <p class="text-xs font-semibold uppercase tracking-wide text-base-content/50 mb-1">
                Raised By
              </p>
              <p class="text-sm text-base-content flex items-center gap-1.5">
                <span>{{ getRaiserName(selectedComplaint.raisedBy) }}</span>
                @if (getRaiserRole(selectedComplaint.raisedBy)) {
                  <span class="bb-chip bb-chip-neutral text-[10px] py-0">{{
                    getRaiserRole(selectedComplaint.raisedBy)
                  }}</span>
                }
              </p>
              @if (getRaiserEmail(selectedComplaint.raisedBy)) {
                <p class="text-xs text-base-content/50">
                  {{ getRaiserEmail(selectedComplaint.raisedBy) }}
                </p>
              }
            </div>

            <!-- Assigned to -->
            <div>
              <p class="text-xs font-semibold uppercase tracking-wide text-base-content/50 mb-1">
                Assigned To
              </p>
              @if (getAssigneeName(selectedComplaint.assignedTo) !== '—') {
                <p class="text-sm font-medium text-base-content">
                  {{ getAssigneeName(selectedComplaint.assignedTo) }}
                </p>
              } @else {
                <p class="text-sm text-base-content/40 italic">Not assigned yet</p>
              }
            </div>

            <!-- Resolution -->
            @if (selectedComplaint.resolution) {
              <div>
                <p class="text-xs font-semibold uppercase tracking-wide text-base-content/50 mb-1">
                  Resolution
                </p>
                <p class="text-sm text-base-content/80 whitespace-pre-wrap leading-relaxed">
                  {{ selectedComplaint.resolution }}
                </p>
              </div>
            }

            <!-- Dates -->
            <div class="grid grid-cols-2 gap-3 pt-2 border-t border-base-300">
              <div>
                <p
                  class="text-xs font-semibold uppercase tracking-wide text-base-content/50 mb-0.5"
                >
                  Created
                </p>
                <p class="text-sm text-base-content/70">
                  {{ selectedComplaint.createdAt | date: 'medium' }}
                </p>
              </div>
              @if (selectedComplaint.updatedAt) {
                <div>
                  <p
                    class="text-xs font-semibold uppercase tracking-wide text-base-content/50 mb-0.5"
                  >
                    Updated
                  </p>
                  <p class="text-sm text-base-content/70">
                    {{ selectedComplaint.updatedAt | date: 'medium' }}
                  </p>
                </div>
              }
            </div>
          </div>
        </div>
        <div class="modal-backdrop" (click)="closeDetail()"></div>
      </dialog>
    }

    <!-- Assign modal -->
    @if (showAssignModal && assignTarget) {
      <dialog class="modal modal-open">
        <div class="modal-box max-w-xl min-h-[28rem]">
          <h3 class="font-bold text-base mb-1">Assign Complaint</h3>
          <p class="text-sm text-base-content/60 mb-4 leading-snug">
            Choose a case manager to handle
            <strong class="text-base-content">{{ assignTarget.subject }}</strong
            >.
          </p>

          @if (loadingManagers) {
            <div class="flex items-center justify-center py-6">
              <span class="loading loading-spinner loading-sm text-primary"></span>
            </div>
          } @else if (caseManagers.length === 0) {
            <p class="text-sm text-base-content/50 italic text-center py-4">
              No case managers found.
            </p>
          } @else {
            <div>
              <label class="bb-label" for="assign-manager">Case Manager</label>
              <app-bb-select
                id="assign-manager"
                [(ngModel)]="selectedManagerId"
                [options]="caseManagerOptions()"
                placeholder="— Select a case manager —"
              ></app-bb-select>
            </div>
          }

          <div class="modal-action mt-4">
            <button class="bb-btn bb-btn-ghost" (click)="closeAssignModal()">Cancel</button>
            <button
              class="bb-btn bb-btn-primary"
              (click)="confirmAssign()"
              [disabled]="!selectedManagerId || assignTarget.resolving || loadingManagers"
            >
              @if (assignTarget.resolving) {
                <span class="loading loading-spinner loading-sm"></span>
              } @else {
                <i class="material-icons-outlined text-base">assignment_ind</i>
              }
              Assign
            </button>
          </div>
        </div>
        <div class="modal-backdrop" (click)="closeAssignModal()"></div>
      </dialog>
    }
  `,
  styles: [
    `
      thead th {
        position: sticky;
        top: 0;
        z-index: 2;
        background: var(--ivory-soft);
      }
    `,
  ],
})
export class AdminComplaintsComponent implements OnInit {
  complaints: Complaint[] = [];
  loading = true;
  error = false;
  sortOrder: DateSortOrder = 'desc';
  readonly sortOrderOptions = [
    { value: 'desc', label: 'Newest first' },
    { value: 'asc', label: 'Oldest first' },
  ];

  selectedComplaint: Complaint | null = null;
  showDetailModal = false;

  assignTarget: Complaint | null = null;
  showAssignModal = false;
  selectedManagerId = '';
  caseManagers: CaseManager[] = [];
  loadingManagers = false;

  caseManagerOptions(): { value: string; label: string }[] {
    return this.caseManagers.map((m) => ({ value: m._id, label: m.name }));
  }

  constructor(
    private api: ApiService,
    private toast: ToastService,
    private pageTitleService: PageTitleService,
  ) {}

  ngOnInit(): void {
    this.pageTitleService.set('Complaints');
    this.api.get<Complaint[]>('/feedback/complaints').subscribe({
      next: (data) => {
        this.complaints = (data ?? []).map((c) => ({ ...c, resolveText: '', resolving: false }));
        this.applySort();
        this.loading = false;
      },
      error: () => {
        this.error = true;
        this.loading = false;
      },
    });
  }

  applySort(): void {
    this.complaints = sortByDate(this.complaints, this.sortOrder);
  }

  openDetail(c: Complaint): void {
    this.selectedComplaint = c;
    this.showDetailModal = true;
  }

  closeDetail(): void {
    this.showDetailModal = false;
    this.selectedComplaint = null;
  }

  openAssignModal(c: Complaint): void {
    this.assignTarget = c;
    this.selectedManagerId = '';
    this.showAssignModal = true;
    if (this.caseManagers.length === 0) {
      this.loadingManagers = true;
      this.api.get<CaseManager[]>('/users', { role: 'CASE_MANAGER' }).subscribe({
        next: (data) => {
          this.caseManagers = data ?? [];
          this.loadingManagers = false;
        },
        error: () => {
          this.loadingManagers = false;
          this.toast.error('Failed to load case managers');
        },
      });
    }
  }

  closeAssignModal(): void {
    this.showAssignModal = false;
    this.assignTarget = null;
    this.selectedManagerId = '';
  }

  confirmAssign(): void {
    if (!this.assignTarget || !this.selectedManagerId) return;
    const c = this.assignTarget;
    c.resolving = true;
    this.api
      .patch<Complaint>(`/feedback/complaints/${c._id}/assign`, {
        userId: this.selectedManagerId,
      })
      .subscribe({
        next: (data) => {
          Object.assign(c, data, { resolving: false, resolveText: c.resolveText ?? '' });
          this.toast.success('Complaint assigned');
          this.closeAssignModal();
        },
        error: () => {
          c.resolving = false;
          this.toast.error('Failed to assign complaint');
        },
      });
  }

  resolve(complaint: Complaint): void {
    if (!complaint.resolveText?.trim()) return;
    complaint.resolving = true;
    this.api
      .patch<Complaint>(`/feedback/complaints/${complaint._id}/resolve`, {
        resolution: complaint.resolveText,
      })
      .subscribe({
        next: (data) => {
          Object.assign(complaint, data, { resolving: false, resolveText: '' });
          this.toast.success('Complaint resolved');
        },
        error: () => {
          complaint.resolving = false;
          this.toast.error('Failed to resolve complaint');
        },
      });
  }

  getRaiserName(raisedBy: Complaint['raisedBy']): string {
    if (!raisedBy) return '—';
    if (typeof raisedBy === 'string')
      return raisedBy.length > 12 ? raisedBy.slice(-8) + '…' : raisedBy;
    const r = raisedBy as { name?: string };
    return (r.name ?? '').trim() || '—';
  }

  getRaiserEmail(raisedBy: Complaint['raisedBy']): string {
    if (!raisedBy || typeof raisedBy === 'string') return '';
    return (raisedBy as { email?: string }).email ?? '';
  }

  getRaiserRole(raisedBy: Complaint['raisedBy']): string {
    if (!raisedBy || typeof raisedBy === 'string') return '';
    return (raisedBy as { role?: string }).role ?? '';
  }

  getCaseRef(caseId: Complaint['caseId']): string {
    if (!caseId) return '—';
    if (typeof caseId === 'string') return caseId.length > 12 ? '…' + caseId.slice(-8) : caseId;
    const c = caseId as { caseNumber?: string; _id?: string };
    return c.caseNumber ?? (c._id ? '…' + c._id.slice(-8) : '—');
  }

  getCaseTitle(caseId: Complaint['caseId']): string {
    if (!caseId || typeof caseId === 'string') return '';
    return (caseId as { title?: string }).title ?? '';
  }

  getAssigneeName(assignedTo: Complaint['assignedTo']): string {
    if (!assignedTo) return '—';
    if (typeof assignedTo === 'string') return assignedTo;
    const a = assignedTo as { name?: string };
    return (a.name ?? '').trim() || '—';
  }

  getAssigneeEmail(assignedTo: Complaint['assignedTo']): string {
    if (!assignedTo || typeof assignedTo === 'string') return '';
    return (assignedTo as { email?: string }).email ?? '';
  }

  formatStatus(status: string): string {
    return (status || '')
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  statusChipClass(status: string): string {
    switch ((status || '').toLowerCase()) {
      case 'open':
        return 'bb-chip-info';
      case 'in_review':
        return 'bb-chip-warning';
      case 'pending':
        return 'bb-chip-warning';
      case 'resolved':
        return 'bb-chip-success';
      default:
        return 'bb-chip-neutral';
    }
  }
}
