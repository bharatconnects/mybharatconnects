import { Component, ElementRef, HostListener, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../../core/services/api.service';
import { Cluster, CLUSTER_LABEL } from '../../../../core/models/cluster.model';
import {
  CaseStatus,
  STAGE_ORDER,
  STAGE_LABEL,
  stageCssClass,
} from '../../../../core/models/case-status.model';
import { PageTitleService } from '../../../../core/services/page-title.service';
import { ToastService } from '../../../../core/services/toast.service';
import { DateSortOrder, sortByDate } from '../../../../shared/utils/sort-by-date.util';
import { BbSelectComponent } from '../../../../shared/components/bb-select/bb-select.component';

interface PopulatedClientRef {
  _id?: string;
  name?: string;
  email?: string;
}

interface CaseItem {
  _id: string;
  caseNumber: string;
  title: string;
  clientId?: PopulatedClientRef | string | null;
  status: CaseStatus;
  priority: string;
  updatedAt: string;
  cluster?: Cluster;
  pausedAt?: string;
}

const STATUS_CHIP: Record<string, string> = {
  LEAD_CAPTURED: 'bb-chip-neutral',
  FRQ_INTAKE: 'bb-chip-info',
  VENDOR_SELECTION: 'bb-chip-info',
  QUOTE_SENT: 'bb-chip-warning',
  CASE_OPEN: 'bb-chip-success',
  VENDOR_WORKING: 'bb-chip-warning',
  DOCUMENT_COLLECTION: 'bb-chip-warning',
  QA_REVIEW: 'bb-chip-info',
  CLIENT_REVIEW: 'bb-chip-info',
  CLOSED: 'bb-chip-neutral',
};

@Component({
  selector: 'app-cm-cases',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, BbSelectComponent],
  template: `
    <div class="flex items-center justify-end gap-3 mb-5">
      @if (!loading) {
        <span class="bb-page-count">{{ filtered.length }} of {{ cases.length }}</span>
      }
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
            @if (activeFilterCount() > 0) {
              <span class="bb-chip bb-chip-info">{{ activeFilterCount() }}</span>
            }
          </span>
          <i class="material-icons-outlined text-base">{{
            filtersExpanded ? 'expand_less' : 'expand_more'
          }}</i>
        </button>

        <div class="bb-filter-row" [class.bb-filter-row--collapsed]="!filtersExpanded">
          <div class="relative" #searchWrap>
            <label class="bb-label" for="cm-cases-search">Search</label>
            <input
              id="cm-cases-search"
              class="bb-input"
              [class.pr-24]="selectedCaseIds.length > 0"
              [(ngModel)]="searchTerm"
              (ngModelChange)="onSearchChange()"
              (focus)="onFocus()"
              placeholder="Case #, title, client…"
              autocomplete="off"
            />
            @if (selectedCaseIds.length > 0) {
              <span
                class="absolute right-2 top-[2.15rem] bb-chip bb-chip-info pointer-events-none"
                aria-hidden="true"
              >
                {{ selectedCaseIds.length }} selected
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
                  @for (s of suggestions; track s.id) {
                    <label class="flex items-center gap-3 px-4 py-2.5 hover:bg-base-200 cursor-pointer border-b border-base-200 last:border-b-0">
                      <input
                        type="checkbox"
                        class="checkbox checkbox-sm checkbox-accent shrink-0"
                        [checked]="pendingCaseIds.includes(s.id)"
                        (change)="togglePendingCase(s.id)"
                      />
                      <div class="flex flex-col min-w-0">
                        <span class="text-sm font-bold text-base-content truncate">{{ s.caseNumber }} — {{ s.clientName }}</span>
                        <span class="text-xs text-base-content/70 truncate">{{ s.title }}</span>
                      </div>
                    </label>
                  }
                </div>
                <div class="px-4 py-2.5 border-t border-base-200 flex items-center justify-between gap-2">
                  <span class="text-xs text-base-content/50 whitespace-nowrap" style="min-width: 6.5rem">
                    {{ pendingCaseIds.length ? pendingCaseIds.length + ' selected' : 'None selected' }}
                  </span>
                  <div class="flex gap-2">
                    <button type="button" class="bb-btn bb-btn-ghost bb-btn-sm" (click)="clearCaseSelection()">Clear</button>
                    <button type="button" class="bb-btn bb-btn-primary bb-btn-sm" (click)="applyCaseSelection()">Apply</button>
                  </div>
                </div>
              </div>
            }
          </div>

          <div>
            <label class="bb-label" for="cm-cases-status">Status</label>
            <app-bb-select
              id="cm-cases-status"
              [(ngModel)]="statusFilter"
              (ngModelChange)="applyFilter()"
              ariaLabel="Filter cases by status"
              [options]="statusFilterOptions()"
              placeholder="All statuses"
            ></app-bb-select>
          </div>

          <div>
            <label class="bb-label" for="cm-cases-cluster">Cluster</label>
            <app-bb-select
              id="cm-cases-cluster"
              [(ngModel)]="clusterFilter"
              (ngModelChange)="applyFilter()"
              ariaLabel="Filter cases by cluster"
              [options]="clusterFilterOptions()"
              placeholder="All clusters"
            ></app-bb-select>
          </div>

          <div>
            <label class="bb-label" for="cm-cases-sort">Sort by</label>
            <app-bb-select
              id="cm-cases-sort"
              [(ngModel)]="sortOrder"
              (ngModelChange)="applyFilter()"
              ariaLabel="Sort by last update date"
              [options]="sortOrderOptions"
            ></app-bb-select>
          </div>

          <button
            type="button"
            class="bb-btn bb-btn-ghost"
            [class.invisible]="!(statusFilter || clusterFilter || selectedCaseIds.length)"
            (click)="clearFilters()"
            [disabled]="!(statusFilter || clusterFilter || selectedCaseIds.length)"
            aria-label="Clear all filters"
          >
            <i class="material-icons-outlined text-base">clear</i>
            Clear
          </button>
        </div>
    </div>

    @if (loading) {
      <div class="flex justify-center py-16">
        <span class="loading loading-spinner loading-md text-primary" aria-label="Loading"></span>
      </div>
    } @else if (filtered.length === 0) {
      <div class="bb-card">
        <div class="bb-empty">
          <div class="bb-empty-icon"><i class="material-icons-outlined">folder_off</i></div>
          <p class="bb-empty-title">No cases found</p>
          <p>Try clearing filters or check back later.</p>
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
                <th>Status</th>
                <th>Active</th>
                <th>Priority</th>
                <th>Last Updated</th>
              </tr>
            </thead>
            <tbody>
              @for (c of filtered; track c._id) {
                <tr class="bb-row-clickable" (click)="openCase(c.caseNumber)">
                  <td>
                    <a
                      class="font-mono text-xs text-[var(--saffron)] hover:underline"
                      [routerLink]="['/case-manager/cases', c.caseNumber]"
                      (click)="$event.stopPropagation()"
                      [attr.aria-label]="'Open case ' + c.caseNumber"
                    >
                      {{ c.caseNumber }}
                    </a>
                  </td>
                  <td class="font-medium">{{ c.title }}</td>
                  <td>{{ getClientName(c) }}</td>
                  <td>
                    <span class="bb-chip" [ngClass]="statusChipClass(c.status)">{{
                      stageLabel[c.status]
                    }}</span>
                  </td>
                  <td>
                    <span class="bb-chip" [ngClass]="c.pausedAt ? 'bb-chip-warning' : 'bb-chip-success'">{{
                      c.pausedAt ? 'Paused' : 'Active'
                    }}</span>
                  </td>
                  <td>
                    <span class="font-semibold text-xs" [ngClass]="priorityClass(c.priority)">{{
                      c.priority
                    }}</span>
                  </td>
                  <td class="text-sm text-base-content/70">
                    {{ c.updatedAt | date: 'mediumDate' }}
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- Mobile card list -->
      <div class="md:hidden flex flex-col gap-3">
        @for (c of filtered; track c._id) {
          <button
            type="button"
            class="bb-row-card text-left bb-card-hover"
            (click)="openCase(c.caseNumber)"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <a
                  class="font-mono text-xs text-[var(--saffron)] hover:underline block"
                  [routerLink]="['/case-manager/cases', c.caseNumber]"
                  (click)="$event.stopPropagation()"
                  [attr.aria-label]="'Open case ' + c.caseNumber"
                >
                  {{ c.caseNumber }}
                </a>
                <div class="font-semibold truncate">{{ c.title }}</div>
                <div class="text-xs text-base-content/70 truncate">{{ getClientName(c) }}</div>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <span class="bb-chip" [ngClass]="statusChipClass(c.status)">{{
                  stageLabel[c.status]
                }}</span>
              </div>
            </div>
            <div class="flex items-center justify-between mt-2 text-xs">
              <span class="bb-chip" [ngClass]="c.pausedAt ? 'bb-chip-warning' : 'bb-chip-success'">{{
                c.pausedAt ? 'Paused' : 'Active'
              }}</span>
              <span [ngClass]="priorityClass(c.priority)" class="font-semibold">{{
                c.priority
              }}</span>
              <span class="text-base-content/60">{{ c.updatedAt | date: 'mediumDate' }}</span>
            </div>
          </button>
        }
      </div>
    }
  `,
  styles: [
    `
      thead th { position: sticky; top: 0; z-index: 2; background: var(--ivory-soft); }
    `,
  ],
})
export class CmCasesComponent implements OnInit {
  cases: CaseItem[] = [];
  filtered: CaseItem[] = [];
  statusFilter: CaseStatus | '' = '';
  clusterFilter: Cluster | '' = '';
  sortOrder: DateSortOrder = 'desc';
  loading = true;
  filtersExpanded = true;
  clusterLabel = CLUSTER_LABEL;
  stageOrder = STAGE_ORDER;
  stageLabel = STAGE_LABEL;
  readonly stageCssClass = stageCssClass;

  searchTerm = '';
  showSuggestions = false;
  suggestions: { id: string; caseNumber: string; title: string; clientName: string }[] = [];
  selectedCaseIds: string[] = [];
  pendingCaseIds: string[] = [];
  @ViewChild('searchWrap') searchWrapRef?: ElementRef<HTMLElement>;

  get clusterOptions(): Cluster[] {
    return [...new Set(this.cases.map((c) => c.cluster).filter((c): c is Cluster => !!c))].sort();
  }

  readonly sortOrderOptions = [
    { value: 'desc', label: 'Newest first' },
    { value: 'asc', label: 'Oldest first' },
  ];

  statusFilterOptions(): { value: string; label: string }[] {
    return [
      { value: '', label: 'All statuses' },
      ...this.stageOrder.map((s) => ({ value: s, label: this.stageLabel[s] })),
    ];
  }

  clusterFilterOptions(): { value: string; label: string }[] {
    return [
      { value: '', label: 'All clusters' },
      ...this.clusterOptions.map((c) => ({ value: c, label: this.clusterLabel[c] })),
    ];
  }

  getClientName(c: CaseItem): string {
    const ref = c.clientId;
    if (!ref) return '—';
    if (typeof ref === 'string') return ref;
    return (ref.name ?? '').trim() || ref.email || '—';
  }

  getClientEmail(c: CaseItem): string {
    const ref = c.clientId;
    if (!ref || typeof ref === 'string') return '';
    return ref.email ?? '';
  }

  trackById(_: number, item: { _id: string }): string { return item._id; }

  constructor(
    private api: ApiService,
    private router: Router,
    private toast: ToastService,
    private pageTitleService: PageTitleService,
  ) {}

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
    this.pageTitleService.set('Cases');
    this.api.get<CaseItem[]>('/cases').subscribe({
      next: (c) => {
        this.cases = c || [];
        this.applyFilter();
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  applyFilter(): void {
    const filtered = this.cases.filter(
      (c) =>
        (!this.statusFilter || c.status === this.statusFilter) &&
        (!this.clusterFilter || c.cluster === this.clusterFilter) &&
        (this.selectedCaseIds.length === 0 || this.selectedCaseIds.includes(c._id)),
    );
    this.filtered = sortByDate(filtered, this.sortOrder);
  }

  activeFilterCount(): number {
    return (this.statusFilter ? 1 : 0) + (this.clusterFilter ? 1 : 0) + (this.selectedCaseIds.length ? 1 : 0);
  }

  clearFilters(): void {
    this.statusFilter = '';
    this.clusterFilter = '';
    this.selectedCaseIds = [];
    this.pendingCaseIds = [];
    this.searchTerm = '';
    this.suggestions = [];
    this.showSuggestions = false;
    this.applyFilter();
  }

  onFocus(): void {
    this.pendingCaseIds = [...this.selectedCaseIds];
    this.updateSuggestions();
    this.showSuggestions = this.suggestions.length > 0;
  }

  onSearchChange(): void {
    this.updateSuggestions();
    this.showSuggestions = this.suggestions.length > 0;
  }

  togglePendingCase(id: string): void {
    const idx = this.pendingCaseIds.indexOf(id);
    if (idx >= 0) this.pendingCaseIds.splice(idx, 1);
    else this.pendingCaseIds.push(id);
  }

  isAllSuggestionsSelected(): boolean {
    return (
      this.suggestions.length > 0 &&
      this.suggestions.every((s) => this.pendingCaseIds.includes(s.id))
    );
  }

  toggleAllSuggestions(): void {
    if (this.isAllSuggestionsSelected()) {
      const suggestionIds = new Set(this.suggestions.map((s) => s.id));
      this.pendingCaseIds = this.pendingCaseIds.filter((id) => !suggestionIds.has(id));
    } else {
      const merged = new Set(this.pendingCaseIds);
      this.suggestions.forEach((s) => merged.add(s.id));
      this.pendingCaseIds = Array.from(merged);
    }
  }

  applyCaseSelection(): void {
    this.selectedCaseIds = [...this.pendingCaseIds];
    this.showSuggestions = false;
    this.applyFilter();
  }

  clearCaseSelection(): void {
    this.pendingCaseIds = [];
    this.selectedCaseIds = [];
    this.searchTerm = '';
    this.updateSuggestions();
    this.applyFilter();
  }

  private updateSuggestions(): void {
    const term = this.searchTerm.trim().toLowerCase();
    const matched = term
      ? this.cases.filter(
          (c) =>
            c.caseNumber.toLowerCase().includes(term) ||
            c.title.toLowerCase().includes(term) ||
            this.getClientName(c).toLowerCase().includes(term) ||
            this.getClientEmail(c).toLowerCase().includes(term),
        )
      : this.cases;
    this.suggestions = matched.slice(0, 15).map((c) => ({
      id: c._id,
      caseNumber: c.caseNumber,
      title: c.title,
      clientName: this.getClientName(c),
    }));
  }

  openCase(id: string): void {
    this.router.navigate(['/case-manager/cases', id]);
  }

  statusChipClass(status: string): string {
    return STATUS_CHIP[status] ?? 'bb-chip-neutral';
  }

  priorityClass(priority: string): string {
    switch (priority) {
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
}
