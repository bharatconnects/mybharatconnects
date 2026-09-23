import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/auth/auth.service';
import { Role } from '../../../core/models/user.model';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { PageTitleService } from '../../../core/services/page-title.service';
import { DateSortOrder, sortByDate } from '../../../shared/utils/sort-by-date.util';
import { BbSelectComponent } from '../../../shared/components/bb-select/bb-select.component';

interface Case {
  _id: string;
  caseNumber: string;
  title: string;
  clientId: string | { name?: string; email?: string };
  caseManagerId: string | { name?: string; email?: string };
  serviceType: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt?: string;
}

interface CaseManagerOption {
  _id: string;
  name?: string;
  presence?: 'ONLINE' | 'AWAY';
}

@Component({
  selector: 'app-admin-cases',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, BbSelectComponent],
  template: `
    <div class="flex items-center justify-between gap-3 mb-5">
      <p class="text-sm text-base-content/60">Monitor every case across the pipeline.</p>
      <span class="bb-page-count">{{ filteredCases.length }} of {{ allCases.length }}</span>
    </div>

    <div class="flex flex-wrap gap-4 items-start mb-4">
      <div class="bb-filter-card flex-1 min-w-52">
        <button
          type="button"
          class="bb-filter-toggle"
          (click)="filtersExpanded = !filtersExpanded"
          [attr.aria-expanded]="filtersExpanded"
        >
          <span class="flex items-center gap-1.5">
            <i class="material-icons-outlined text-base">tune</i>
            Filters
            @if (selectedStatus) {
              <span class="bb-chip bb-chip-info">1</span>
            }
          </span>
          <i class="material-icons-outlined text-base">{{
            filtersExpanded ? 'expand_less' : 'expand_more'
          }}</i>
        </button>

        <div class="bb-filter-row" [class.bb-filter-row--collapsed]="!filtersExpanded">
          <div>
            <label class="bb-label" for="filter-status">Filter by status</label>
            <app-bb-select
              id="filter-status"
              [(ngModel)]="selectedStatus"
              (ngModelChange)="applyFilter()"
              ariaLabel="Filter by status"
              [options]="statusOptions()"
              placeholder="All"
            ></app-bb-select>
          </div>
          <div>
            <label class="bb-label" for="filter-sort">Sort by</label>
            <app-bb-select
              id="filter-sort"
              [(ngModel)]="sortOrder"
              (ngModelChange)="applyFilter()"
              ariaLabel="Sort by last update date"
              [options]="sortOrderOptions"
            ></app-bb-select>
          </div>
          <button type="button" class="bb-btn bb-btn-ghost" (click)="clearFilters()">
            <i class="material-icons-outlined text-base">clear</i>
            Clear
          </button>
        </div>
      </div>
    </div>

    @if (loading) {
      <div class="flex justify-center py-16">
        <span class="loading loading-spinner loading-md text-primary" aria-label="Loading"></span>
      </div>
    } @else if (filteredCases.length === 0) {
      <div class="bb-card">
        <div class="bb-empty">
          <div class="bb-empty-icon"><i class="material-icons-outlined">inbox</i></div>
          <p class="bb-empty-title">No cases found</p>
          <p>Try clearing your status filter.</p>
        </div>
      </div>
    } @else {
      <!-- Desktop table -->
      <div class="hidden md:block bb-table-wrap">
        <div class="overflow-y-auto max-h-[60vh]">
          <table class="bb-table">
            <thead>
              <tr>
                <th>Case #</th>
                <th>Title</th>
                <th>Client</th>
                <th>Case Manager</th>
                <th>Service</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Created</th>
                <th>Reassign CM</th>
                @if (isAdmin) {
                  <th></th>
                }
              </tr>
            </thead>
            <tbody>
              @for (c of filteredCases; track c._id) {
                <tr>
                  <td class="whitespace-nowrap font-medium">
                    <a
                      class="text-primary hover:underline"
                      [routerLink]="['/admin/cases', c.caseNumber]"
                      [attr.aria-label]="'Open case details for ' + c.caseNumber"
                    >
                      {{ c.caseNumber }}
                    </a>
                  </td>
                  <td>{{ c.title }}</td>
                  <td>
                    <div class="font-medium">{{ getPersonName(c.clientId) }}</div>
                    <div class="text-xs" style="color:var(--ink-80)">
                      {{ getPersonEmail(c.clientId) }}
                    </div>
                  </td>
                  <td>
                    <div class="font-medium">{{ getPersonName(c.caseManagerId) }}</div>
                    <div class="text-xs" style="color:var(--ink-80)">
                      {{ getPersonEmail(c.caseManagerId) }}
                    </div>
                  </td>
                  <td>{{ c.serviceType }}</td>
                  <td>
                    <span class="bb-chip" [ngClass]="statusChipClass(c.status)">{{
                      c.status
                    }}</span>
                  </td>
                  <td>
                    <span class="bb-chip" [ngClass]="priorityChipClass(c.priority)">{{
                      c.priority
                    }}</span>
                  </td>
                  <td class="whitespace-nowrap">{{ c.createdAt | date: 'mediumDate' }}</td>
                  <td>
                    <div class="flex items-center gap-2">
                      <select
                        class="bb-select bb-select-sm cm-assign-select"
                        [(ngModel)]="selectedAssigneeByCase[c._id]"
                        aria-label="Select case manager"
                      >
                        <option value="">Select manager</option>
                        @for (cm of availableManagers; track cm._id) {
                          <option [value]="cm._id">{{ getPersonName(cm) }}</option>
                        }
                      </select>
                      <button
                        type="button"
                        class="bb-btn bb-btn-primary bb-btn-sm"
                        (click)="reassignCaseManager(c)"
                        [disabled]="!selectedAssigneeByCase[c._id] || reassigningCaseId === c._id"
                      >
                        {{ reassigningCaseId === c._id ? 'Assigning…' : 'Assign' }}
                      </button>
                    </div>
                  </td>
                  @if (isAdmin) {
                    <td>
                      <button
                        type="button"
                        class="bb-btn bb-btn-ghost bb-btn-icon cm-delete-case-btn"
                        (click)="deleteCase(c)"
                        [disabled]="deletingCaseId === c._id"
                        aria-label="Delete case"
                        title="Delete case"
                      >
                        <i class="material-icons-outlined text-base">delete_outline</i>
                      </button>
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- Mobile card list -->
      <div class="md:hidden flex flex-col gap-3">
        @for (c of filteredCases; track c._id) {
          <div class="bb-row-card">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <a
                  class="font-medium truncate text-primary hover:underline block"
                  [routerLink]="['/admin/cases', c.caseNumber]"
                  [attr.aria-label]="'Open case details for ' + c.caseNumber"
                >
                  {{ c.caseNumber }}
                </a>
                <p class="text-sm text-base-content/70 truncate">{{ c.title }}</p>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <span class="bb-chip" [ngClass]="statusChipClass(c.status)">{{ c.status }}</span>
                @if (isAdmin) {
                  <button
                    type="button"
                    class="bb-btn bb-btn-ghost bb-btn-icon cm-delete-case-btn"
                    (click)="deleteCase(c)"
                    [disabled]="deletingCaseId === c._id"
                    aria-label="Delete case"
                    title="Delete case"
                  >
                    <i class="material-icons-outlined text-base">delete_outline</i>
                  </button>
                }
              </div>
            </div>
            <div class="mt-2 text-xs text-base-content/70 space-y-1">
              <div>Client: {{ getPersonName(c.clientId) }}</div>
              <div>Manager: {{ getPersonName(c.caseManagerId) }}</div>
              <div>Service: {{ c.serviceType }}</div>
            </div>
            <div class="mt-2 flex items-center gap-2">
              <select
                class="bb-select bb-select-sm cm-assign-select"
                [(ngModel)]="selectedAssigneeByCase[c._id]"
                aria-label="Select case manager"
              >
                <option value="">Select manager</option>
                @for (cm of availableManagers; track cm._id) {
                  <option [value]="cm._id">{{ getPersonName(cm) }}</option>
                }
              </select>
              <button
                type="button"
                class="bb-btn bb-btn-primary bb-btn-sm"
                (click)="reassignCaseManager(c)"
                [disabled]="!selectedAssigneeByCase[c._id] || reassigningCaseId === c._id"
              >
                {{ reassigningCaseId === c._id ? 'Assigning…' : 'Assign' }}
              </button>
            </div>
            <div class="flex items-center justify-between mt-2 text-xs">
              <span class="bb-chip" [ngClass]="priorityChipClass(c.priority)">{{
                c.priority
              }}</span>
              <span class="text-base-content/60">{{ c.createdAt | date: 'mediumDate' }}</span>
            </div>
          </div>
        }
      </div>
    }

    @if (!loading && error) {
      <div
        role="alert"
        class="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-error/10 text-error border border-error/20 text-sm mt-4"
      >
        <i class="material-icons-outlined">error</i>
        <span>Failed to load cases. Please try again.</span>
      </div>
    }
  `,
  styles: [
    `
      .cm-assign-select {
        min-width: 12rem;
      }
      thead th {
        position: sticky;
        top: 0;
        z-index: 2;
        background: var(--ivory-soft);
      }
      thead th {
        position: sticky;
        top: 0;
        z-index: 2;
        background: var(--ivory-soft);
      }
      .cm-delete-case-btn {
        color: #dc2626;
      }
    `,
  ],
})
export class AdminCasesComponent implements OnInit {
  allCases: Case[] = [];
  filteredCases: Case[] = [];
  loading = true;
  error = false;
  deletingCaseId = '';
  selectedStatus = '';
  filtersExpanded = true;
  sortOrder: DateSortOrder = 'desc';
  statuses: string[] = [];
  readonly sortOrderOptions = [
    { value: 'desc', label: 'Newest first' },
    { value: 'asc', label: 'Oldest first' },
  ];

  statusOptions(): { value: string; label: string }[] {
    return [{ value: '', label: 'All' }, ...this.statuses.map((s) => ({ value: s, label: s }))];
  }

  displayedColumns = [
    'caseNumber',
    'title',
    'clientId',
    'caseManagerId',
    'serviceType',
    'status',
    'priority',
    'createdAt',
  ];

  availableManagers: CaseManagerOption[] = [];
  selectedAssigneeByCase: Record<string, string> = {};
  reassigningCaseId: string | null = null;

  trackById(_: number, item: { _id: string }): string {
    return item._id;
  }

  constructor(
    private api: ApiService,
    private authService: AuthService,
    private toast: ToastService,
    private confirmDialog: ConfirmDialogService,
    private pageTitleService: PageTitleService,
  ) {}

  // This page is also reachable by CASE_MANAGER (see admin.routes.ts) for a
  // system-wide view — only ADMIN gets the Delete action.
  get isAdmin(): boolean {
    return this.authService.role === Role.ADMIN;
  }

  async deleteCase(caseItem: Case): Promise<void> {
    const ok = await this.confirmDialog.confirm(
      `Delete case "${caseItem.caseNumber}"? This cannot be undone.`,
      { title: 'Delete case', confirmText: 'Delete', danger: true },
    );
    if (!ok) return;
    this.deletingCaseId = caseItem._id;
    this.api.delete<{ message: string }>(`/cases/${caseItem._id}`).subscribe({
      next: () => {
        this.allCases = this.allCases.filter((c) => c._id !== caseItem._id);
        this.deletingCaseId = '';
        this.applyFilter();
        this.toast.success('Case deleted');
      },
      error: () => {
        this.deletingCaseId = '';
        this.toast.error('Failed to delete case');
      },
    });
  }

  ngOnInit(): void {
    this.pageTitleService.set('All Cases');
    this.loadAvailableManagers();
    this.api.get<Case[]>('/cases').subscribe({
      next: (data) => {
        this.allCases = data ?? [];
        this.statuses = [...new Set(this.allCases.map((c) => c.status).filter(Boolean))];
        this.applyFilter();
        this.loading = false;
      },
      error: () => {
        this.error = true;
        this.loading = false;
      },
    });
  }

  loadAvailableManagers(): void {
    this.api
      .get<CaseManagerOption[]>('/users', {
        role: 'CASE_MANAGER',
        presence: 'ONLINE',
      })
      .subscribe({
        next: (users) => {
          this.availableManagers = users ?? [];
        },
        error: () => {
          this.availableManagers = [];
          this.toast.error('Failed to load available case managers');
        },
      });
  }

  reassignCaseManager(c: Case): void {
    const caseManagerId = this.selectedAssigneeByCase[c._id];
    if (!caseManagerId) return;

    this.reassigningCaseId = c._id;
    this.api.patch<unknown>(`/cases/${c._id}/assign-cm`, { caseManagerId }).subscribe({
      next: () => {
        this.reassigningCaseId = null;
        const manager = this.availableManagers.find((cm) => cm._id === caseManagerId);
        if (manager) {
          c.caseManagerId = manager;
        }
        this.toast.success(`Reassigned ${c.caseNumber}`);
      },
      error: () => {
        this.reassigningCaseId = null;
        this.toast.error('Failed to reassign case manager');
      },
    });
  }


  applyFilter(): void {
    const filtered = this.selectedStatus
      ? this.allCases.filter((c) => c.status === this.selectedStatus)
      : [...this.allCases];
    this.filteredCases = sortByDate(filtered, this.sortOrder);
  }

  clearFilters(): void {
    this.selectedStatus = '';
    this.applyFilter();
  }

  getPersonName(
    person: string | { name?: string; email?: string } | null | undefined,
  ): string {
    if (!person) return '—';
    if (typeof person === 'string') return person;
    const p = person as { name?: string };
    return (p.name ?? '').trim() || '—';
  }

  getPersonEmail(
    person: string | { name?: string; email?: string } | null | undefined,
  ): string {
    if (!person || typeof person === 'string') return '';
    return (person as { email?: string }).email ?? '';
  }

  statusChipClass(status: string): string {
    switch ((status || '').toLowerCase()) {
      case 'open':
        return 'bb-chip-info';
      case 'in_progress':
        return 'bb-chip-warning';
      case 'closed':
        return 'bb-chip-success';
      case 'cancelled':
        return 'bb-chip-danger';
      default:
        return 'bb-chip-neutral';
    }
  }

  priorityChipClass(priority: string): string {
    switch ((priority || '').toLowerCase()) {
      case 'high':
        return 'bb-chip-danger';
      case 'medium':
        return 'bb-chip-warning';
      case 'low':
        return 'bb-chip-success';
      default:
        return 'bb-chip-neutral';
    }
  }
}
