import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { extractApiError } from '../../../core/services/api-error';
import { PageTitleService } from '../../../core/services/page-title.service';
import { DateSortOrder, sortByDate } from '../../../shared/utils/sort-by-date.util';
import { BbSelectComponent } from '../../../shared/components/bb-select/bb-select.component';

type DisputeStatus = 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'REJECTED' | string;

interface TimelineEntry {
  at: string;
  by?: string;
  action: string;
  note?: string;
}

interface Dispute {
  _id: string;
  caseId?: string | { _id: string; caseNumber?: string };
  type?: string;
  status: DisputeStatus;
  description?: string;
  raisedBy?: string;
  timeline?: TimelineEntry[];
  resolution?: string;
  resolvedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

@Component({
  selector: 'app-admin-disputes',
  standalone: true,
  imports: [CommonModule, FormsModule, BbSelectComponent],
  template: `
    <div class="flex items-center justify-between gap-3 mb-5">
      <p class="text-sm text-base-content/60">
        Investigate and resolve customer or vendor disputes.
      </p>
      <span class="bb-page-count">{{ disputes.length }} total</span>
    </div>

    <div class="bb-filter-card">
      <button
        type="button"
        class="bb-filter-toggle"
        (click)="filtersExpanded = !filtersExpanded"
        [attr.aria-expanded]="filtersExpanded"
      >
        <span class="flex items-center gap-1.5">
          <i class="material-icons-outlined text-base">tune</i>
          Filters
          @if (statusFilter) {
            <span class="bb-chip bb-chip-info">1</span>
          }
        </span>
        <i class="material-icons-outlined text-base">{{
          filtersExpanded ? 'expand_less' : 'expand_more'
        }}</i>
      </button>

      <div class="bb-filter-row" [class.bb-filter-row--collapsed]="!filtersExpanded">
        <div>
          <label class="bb-label" for="filter-dispute-status">Status</label>
          <app-bb-select
            id="filter-dispute-status"
            [(ngModel)]="statusFilter"
            (ngModelChange)="load()"
            ariaLabel="Status filter"
            [options]="statusFilterOptions"
            placeholder="All"
          ></app-bb-select>
        </div>
        <div>
          <label class="bb-label" for="filter-dispute-sort">Sort by</label>
          <app-bb-select
            id="filter-dispute-sort"
            [(ngModel)]="sortOrder"
            (ngModelChange)="applySort()"
            ariaLabel="Sort by last update date"
            [options]="sortOrderOptions"
          ></app-bb-select>
        </div>
        <button type="button" class="bb-btn bb-btn-primary" (click)="load()" [disabled]="loading">
          <i class="material-icons-outlined text-base">refresh</i>
          Refresh
        </button>
      </div>
    </div>

    @if (comingSoon) {
      <div
        class="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-info/10 text-info border border-info/20 text-sm mb-4"
      >
        <i class="material-icons-outlined">info</i>
        <span>Disputes API coming soon.</span>
      </div>
    }

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <!-- List panel -->
      <div class="lg:col-span-1 bb-card">
        <div class="bb-card-body !p-0">
          @if (loading) {
            <div class="flex justify-center py-8">
              <span
                class="loading loading-spinner loading-md text-primary"
                aria-label="Loading"
              ></span>
            </div>
          } @else if (disputes.length === 0) {
            <div class="bb-empty p-6">
              <div class="bb-empty-icon"><i class="material-icons-outlined">gavel</i></div>
              <p class="bb-empty-title">No disputes</p>
              <p>Nothing to investigate right now.</p>
            </div>
          } @else {
            <ul>
              @for (d of disputes; track d._id) {
                <li
                  class="px-4 py-3 cursor-pointer border-b border-base-300 last:border-0 transition-colors hover:bg-base-200"
                  [class.bg-saffron-50]="selected?._id === d._id"
                  [style.borderLeft]="
                    selected?._id === d._id ? '3px solid var(--saffron)' : '3px solid transparent'
                  "
                  (click)="select(d)"
                >
                  <div class="flex items-center justify-between gap-2 mb-1">
                    <span class="text-sm font-semibold truncate">{{ d.type || 'Dispute' }}</span>
                    <span class="bb-chip text-[10px]" [ngClass]="statusChip(d.status)">
                      {{
                        d.status === 'OPEN'
                          ? 'Open'
                          : d.status === 'INVESTIGATING'
                            ? 'Investigating'
                            : d.status === 'RESOLVED'
                              ? 'Resolved'
                              : d.status === 'REJECTED'
                                ? 'Rejected'
                                : d.status
                      }}
                    </span>
                  </div>
                  <div class="text-xs truncate" style="color:var(--ink-60)">
                    {{ d.description }}
                  </div>
                  <div class="text-[10px] mt-1" style="color:var(--ink-40)">
                    {{ d.createdAt | date: 'mediumDate' }}
                  </div>
                </li>
              }
            </ul>
          }
        </div>
      </div>

      <!-- Detail panel -->
      <div class="lg:col-span-2 bb-card">
        <div class="bb-card-body">
          @if (!selected) {
            <div class="bb-empty">
              <div class="bb-empty-icon"><i class="material-icons-outlined">touch_app</i></div>
              <p class="bb-empty-title">Pick a dispute</p>
              <p>Select a dispute on the left to see its details.</p>
            </div>
          } @else {
            <!-- Header -->
            <div class="flex flex-wrap items-start gap-3 mb-4 pb-4 border-b border-base-300">
              <div class="flex-1 min-w-0">
                <p
                  class="text-[10px] font-semibold uppercase tracking-widest mb-1"
                  style="color:var(--ink-40)"
                >
                  {{ selected.type || 'Dispute' }}
                </p>
                <p class="text-sm leading-relaxed">{{ selected.description }}</p>
                @if (selected.caseId) {
                  <p class="text-xs mt-1.5 font-mono" style="color:var(--ink-60)">
                    Case: {{ getCaseNumber(selected.caseId) }}
                  </p>
                }
              </div>
              <span class="bb-chip" [ngClass]="statusChip(selected.status)">
                {{
                  selected.status === 'OPEN'
                    ? 'Open'
                    : selected.status === 'INVESTIGATING'
                      ? 'Investigating'
                      : selected.status === 'RESOLVED'
                        ? 'Resolved'
                        : selected.status === 'REJECTED'
                          ? 'Rejected'
                          : selected.status
                }}
              </span>
            </div>

            <!-- Timeline -->
            <h4
              class="text-xs font-bold uppercase tracking-widest mb-3"
              style="color:var(--ink-60)"
            >
              Timeline
            </h4>
            @if (!selected.timeline?.length) {
              <p class="text-sm" style="color:var(--ink-60)">No timeline entries yet.</p>
            } @else {
              <ol class="relative border-l-2 border-base-300 ml-2 space-y-4 mb-4">
                @for (t of selected.timeline; track $index) {
                  <li class="pl-5 relative">
                    <span
                      class="absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-base-300 flex items-center justify-center"
                      style="background:var(--ivory-soft)"
                    >
                      <span
                        class="w-1.5 h-1.5 rounded-full"
                        [style.background]="timelineDotColor(t.action)"
                      ></span>
                    </span>
                    <div class="flex flex-wrap items-center gap-2 mb-0.5">
                      <span class="bb-chip text-[10px]" [ngClass]="timelineChip(t.action)">{{
                        t.action
                      }}</span>
                      <span class="text-[11px]" style="color:var(--ink-60)">{{
                        t.at | date: 'medium'
                      }}</span>
                      @if (t.by) {
                        <span class="text-[11px] font-medium" style="color:var(--ink-60)"
                          >by {{ t.by }}</span
                        >
                      }
                    </div>
                    @if (t.note) {
                      <p class="text-sm" style="color:var(--ink-80)">{{ t.note }}</p>
                    }
                  </li>
                }
              </ol>
            }

            @if (selected.status === 'OPEN' || selected.status === 'INVESTIGATING') {
              <div
                class="rounded-lg p-4 border border-base-300 mt-2"
                style="background:var(--ivory-soft)"
              >
                <p
                  class="text-xs font-bold uppercase tracking-widest mb-3"
                  style="color:var(--ink-60)"
                >
                  Take Action
                </p>
                <div class="mb-3">
                  <label class="bb-label" for="action-note">Note / Resolution</label>
                  <textarea
                    id="action-note"
                    class="bb-textarea"
                    [(ngModel)]="actionNote"
                    placeholder="What did you find? What's the outcome?"
                    aria-label="Action note"
                  ></textarea>
                </div>
                <div class="flex flex-col-reverse sm:flex-row sm:flex-wrap sm:justify-end gap-2">
                  <button
                    class="bb-btn bb-btn-outline"
                    (click)="addNote()"
                    [disabled]="busy || !actionNote.trim()"
                  >
                    <i class="material-icons-outlined text-base">note_add</i> Add note
                  </button>
                  <button
                    class="bb-btn bb-btn-danger"
                    (click)="reject()"
                    [disabled]="busy || !actionNote.trim()"
                  >
                    <i class="material-icons-outlined text-base">close</i> Reject
                  </button>
                  <button
                    class="bb-btn bb-btn-primary"
                    (click)="resolve()"
                    [disabled]="busy || !actionNote.trim()"
                  >
                    @if (busy) {
                      <span class="loading loading-spinner loading-sm"></span>
                    } @else {
                      <i class="material-icons-outlined text-base">check_circle</i> Resolve
                    }
                  </button>
                </div>
              </div>
            }
          }
        </div>
      </div>
    </div>
  `,
})
export class AdminDisputesComponent implements OnInit {
  disputes: Dispute[] = [];
  selected: Dispute | null = null;
  statusFilter = '';
  filtersExpanded = true;
  sortOrder: DateSortOrder = 'desc';
  loading = false;
  busy = false;
  readonly sortOrderOptions = [
    { value: 'desc', label: 'Newest first' },
    { value: 'asc', label: 'Oldest first' },
  ];
  readonly statusFilterOptions = [
    { value: '', label: 'All' },
    { value: 'OPEN', label: 'Open' },
    { value: 'INVESTIGATING', label: 'Investigating' },
    { value: 'RESOLVED', label: 'Resolved' },
    { value: 'REJECTED', label: 'Rejected' },
  ];
  comingSoon = false;
  actionNote = '';

  constructor(
    private api: ApiService,
    private toast: ToastService,
    private pageTitleService: PageTitleService,
  ) {}

  ngOnInit(): void {
    this.pageTitleService.set('Disputes');
    this.load();
  }

  load(): void {
    this.loading = true;
    const params = this.statusFilter ? { status: this.statusFilter } : undefined;
    this.api.get<Dispute[]>('/disputes', params).subscribe({
      next: (rows) => {
        this.disputes = sortByDate(rows ?? [], this.sortOrder);
        this.loading = false;
        this.comingSoon = false;
      },
      error: (err) => {
        this.loading = false;
        this.disputes = [];
        if (err?.status === 404) this.comingSoon = true;
        else this.toast.error(extractApiError(err, 'Failed to load disputes').message);
      },
    });
  }

  applySort(): void {
    this.disputes = sortByDate(this.disputes, this.sortOrder);
  }

  select(d: Dispute): void {
    this.selected = d;
    this.actionNote = '';
    // Refresh details (timeline) from /disputes/:id
    this.api.get<Dispute>(`/disputes/${d._id}`).subscribe({
      next: (full) => {
        if (full) this.selected = full;
      },
      error: () => {
        /* keep list version */
      },
    });
  }

  addNote(): void {
    if (!this.selected || !this.actionNote.trim() || this.busy) return;
    this.busy = true;
    this.api
      .post<Dispute>(`/disputes/${this.selected._id}/notes`, { note: this.actionNote.trim() })
      .subscribe({
        next: (updated) => {
          this.busy = false;
          this.selected = updated || this.selected;
          this.actionNote = '';
          this.toast.success('Note added');
        },
        error: (err) => {
          this.busy = false;
          this.toast.error(extractApiError(err, 'Failed to add note').message);
        },
      });
  }

  resolve(): void {
    if (!this.selected || !this.actionNote.trim() || this.busy) return;
    this.busy = true;
    this.api
      .patch<Dispute>(`/disputes/${this.selected._id}/resolve`, {
        resolution: this.actionNote.trim(),
      })
      .subscribe({
        next: (updated) => {
          this.busy = false;
          this.selected = updated || this.selected;
          if (updated)
            this.disputes = this.disputes.map((d) => (d._id === updated._id ? updated : d));
          this.actionNote = '';
          this.toast.success('Dispute resolved');
        },
        error: (err) => {
          this.busy = false;
          this.toast.error(extractApiError(err, 'Failed to resolve').message);
        },
      });
  }

  reject(): void {
    if (!this.selected || !this.actionNote.trim() || this.busy) return;
    this.busy = true;
    this.api
      .patch<Dispute>(`/disputes/${this.selected._id}/reject`, { reason: this.actionNote.trim() })
      .subscribe({
        next: (updated) => {
          this.busy = false;
          this.selected = updated || this.selected;
          if (updated)
            this.disputes = this.disputes.map((d) => (d._id === updated._id ? updated : d));
          this.actionNote = '';
          this.toast.success('Dispute rejected');
        },
        error: (err) => {
          this.busy = false;
          this.toast.error(extractApiError(err, 'Failed to reject').message);
        },
      });
  }

  getCaseNumber(caseId: string | { _id: string; caseNumber?: string } | undefined): string {
    if (!caseId) return '—';
    if (typeof caseId === 'object') return caseId.caseNumber ?? caseId._id.slice(0, 8) + '…';
    return caseId.slice(0, 8) + '…';
  }

  statusChip(status: DisputeStatus): string {
    switch ((status || '').toUpperCase()) {
      case 'OPEN':
        return 'bb-chip-warning';
      case 'INVESTIGATING':
        return 'bb-chip-info';
      case 'UNDER_REVIEW':
        return 'bb-chip-info';
      case 'RESOLVED':
        return 'bb-chip-success';
      case 'REJECTED':
        return 'bb-chip-danger';
      default:
        return 'bb-chip-neutral';
    }
  }

  timelineChip(action: string): string {
    const a = (action || '').toUpperCase();
    if (a === 'CREATED') return 'bb-chip-info';
    if (a === 'RESOLVED') return 'bb-chip-success';
    if (a === 'REJECTED') return 'bb-chip-danger';
    if (a.includes('NOTE')) return 'bb-chip-warning';
    return 'bb-chip-neutral';
  }

  timelineDotColor(action: string): string {
    const a = (action || '').toUpperCase();
    if (a === 'CREATED') return 'var(--color-info, #3b82f6)';
    if (a === 'RESOLVED') return 'var(--color-success, #16a34a)';
    if (a === 'REJECTED') return 'var(--color-error, #dc2626)';
    if (a.includes('NOTE')) return 'var(--saffron)';
    return 'var(--ink-40, rgba(15,26,46,0.4))';
  }
}
