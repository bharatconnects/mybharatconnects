import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { ClientCasesService } from '../../services/client-cases.service';
import { Case } from '../../models/case.model';
import { extractApiError } from '../../../../core/services/api-error';
import { PageTitleService } from '../../../../core/services/page-title.service';
import { DateSortOrder, sortByDate } from '../../../../shared/utils/sort-by-date.util';
import { BbSelectComponent } from '../../../../shared/components/bb-select/bb-select.component';

const STATUS_BADGE: Record<string, string> = {
  LEAD_CAPTURED: 'bb-chip-neutral',
  CASE_OPEN: 'bb-chip-info',
  VENDOR_WORKING: 'bb-chip-warning',
  QA_REVIEW: 'bb-chip-info',
  CLOSED: 'bb-chip-success',
};

@Component({
  selector: 'app-client-cases',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, BbSelectComponent],
  template: `
    <div class="max-w-screen-xl">
      <div class="flex items-center justify-between gap-3 mb-5">
        <p class="text-sm text-base-content/60">Every service you've requested in one place.</p>
        <div class="flex items-center gap-3 shrink-0">
          @if (!loading && cases.length > 0) {
            <span class="bb-page-count">{{ filteredCases.length }} of {{ cases.length }}</span>
          }
          <a routerLink="/client/request-service" class="bb-btn bb-btn-primary bb-btn-sm gap-1">
            <i class="material-icons-outlined">add</i>
            Request a New Service
          </a>
        </div>
      </div>

      @if (!loading && cases.length > 0) {
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
            <div>
              <label class="bb-label" for="case-status-filter">Filter by Status</label>
              <app-bb-select
                id="case-status-filter"
                [formControl]="statusFilter"
                ariaLabel="Filter cases by status"
                [options]="statusOptions()"
                placeholder="All"
              ></app-bb-select>
            </div>
            <div>
              <label class="bb-label" for="case-sort-filter">Sort by</label>
              <app-bb-select
                id="case-sort-filter"
                [formControl]="sortOrder"
                ariaLabel="Sort by last update date"
                [options]="sortOrderOptions"
              ></app-bb-select>
            </div>
          </div>
        </div>
      }

      @if (loading) {
        <div class="flex justify-center py-12">
          <span class="loading loading-spinner loading-lg text-primary"></span>
        </div>
      } @else if (errorMessage) {
        <div class="flex items-center gap-2 px-4 py-2.5 rounded-lg mb-4 text-sm bg-error/10 text-error border border-error/20">
          <i class="material-icons-outlined text-base">error_outline</i>
          <span class="flex-1">Could not load your cases — {{ errorMessage }}</span>
          <button class="bb-btn bb-btn-ghost bb-btn-sm" (click)="reload()">Retry</button>
        </div>
      } @else if (cases.length === 0) {
        <div class="bb-card">
          <div class="bb-empty">
            <div class="bb-empty-icon"><i class="material-icons-outlined">folder_open</i></div>
            <p class="bb-empty-title">You don't have any cases yet</p>
            <p class="max-w-md">
              When you request a service from us, your case will appear here. A dedicated case
              manager will guide you through every step.
            </p>
            <a routerLink="/client/request-service" class="bb-btn bb-btn-primary bb-btn-lg mt-4">
              <i class="material-icons-outlined">add</i>
              Request a New Service
              <i class="material-icons-outlined">arrow_forward</i>
            </a>
            <p class="text-xs text-base-content/50 mt-6">
              Already spoke to someone? Your case will appear here once your case manager creates
              it.
            </p>
          </div>
        </div>
      } @else if (filteredCases.length === 0) {
        <div class="bb-card">
          <div class="bb-empty">
            <div class="bb-empty-icon"><i class="material-icons-outlined">filter_alt_off</i></div>
            <p class="bb-empty-title">No cases match the current filter</p>
            <button
              class="bb-btn bb-btn-outline bb-btn-sm mt-4"
              (click)="statusFilter.setValue('')"
            >
              Clear filter
            </button>
          </div>
        </div>
      } @else {
        <div class="hidden md:block bb-table-wrap">
          <div class="overflow-y-auto max-h-[60vh]">
            <table class="bb-table">
              <thead>
                <tr>
                  <th>Case #</th>
                  <th>Service Type</th>
                  <th>Status</th>
                  <th>Case Manager</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                @for (c of filteredCases; track c._id) {
                  <tr class="bb-row-clickable" (click)="viewCase(c.caseNumber)">
                    <td class="font-mono text-xs whitespace-nowrap">
                      <a
                        class="font-mono text-xs text-[var(--saffron)] hover:underline"
                        [routerLink]="['/client/cases', c.caseNumber]"
                        (click)="$event.stopPropagation()"
                        [attr.aria-label]="'Open case details for ' + c.caseNumber"
                      >
                        {{ c.caseNumber }}
                      </a>
                    </td>
                    <td>{{ c.serviceType }}</td>
                    <td>
                      <span class="bb-chip" [class]="getStatusBadgeClass(c.status)">{{
                        c.status
                      }}</span>
                    </td>
                    <td>{{ c.caseManagerId?.name }}</td>
                    <td>{{ c.createdAt | date: 'mediumDate' }}</td>
                    <td>
                      <button
                        class="bb-btn bb-btn-ghost bb-btn-sm"
                        (click)="$event.stopPropagation(); viewCase(c.caseNumber)"
                        aria-label="View case details"
                      >
                        View →
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>

        <div class="md:hidden flex flex-col gap-3">
          @for (c of filteredCases; track c._id) {
            <div class="bb-row-card bb-row-clickable" (click)="viewCase(c.caseNumber)">
              <div class="flex items-start justify-between gap-3 mb-2">
                <div class="min-w-0">
                  <a
                    class="font-mono text-xs text-[var(--saffron)] hover:underline"
                    [routerLink]="['/client/cases', c.caseNumber]"
                    (click)="$event.stopPropagation()"
                    [attr.aria-label]="'Open case details for ' + c.caseNumber"
                  >
                    {{ c.caseNumber }}
                  </a>
                  <p class="font-medium truncate">{{ c.serviceType }}</p>
                </div>
                <span class="bb-chip shrink-0" [class]="getStatusBadgeClass(c.status)">{{
                  c.status
                }}</span>
              </div>
              <div class="text-sm text-base-content/70 space-y-1">
                <div>CM: {{ c.caseManagerId?.name }}</div>
                <div>Created {{ c.createdAt | date: 'mediumDate' }}</div>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    thead th { position: sticky; top: 0; z-index: 2; background: var(--ivory-soft); }
  `],
})
export class ClientCasesComponent implements OnInit {
  cases: Case[] = [];
  filteredCases: Case[] = [];
  loading = true;
  errorMessage = '';
  statusFilter = new FormControl('');
  sortOrder = new FormControl<DateSortOrder>('desc');
  statuses = ['LEAD_CAPTURED', 'CASE_OPEN', 'VENDOR_WORKING', 'QA_REVIEW', 'CLOSED'];
  filtersExpanded = true;

  activeFilterCount(): number {
    return this.statusFilter.value ? 1 : 0;
  }
  readonly sortOrderOptions = [
    { value: 'desc', label: 'Newest first' },
    { value: 'asc', label: 'Oldest first' },
  ];

  statusOptions(): { value: string; label: string }[] {
    return [{ value: '', label: 'All' }, ...this.statuses.map((s) => ({ value: s, label: s }))];
  }

  constructor(
    private clientCasesService: ClientCasesService,
    private router: Router,
    private pageTitleService: PageTitleService,
  ) {}

  ngOnInit(): void {
    this.pageTitleService.set('My Cases');
    this.reload();
    this.statusFilter.valueChanges.subscribe(() => this.applyFilter());
    this.sortOrder.valueChanges.subscribe(() => this.applyFilter());
  }

  applyFilter(): void {
    const status = this.statusFilter.value;
    const filtered = status ? this.cases.filter((c) => c.status === status) : this.cases;
    this.filteredCases = sortByDate(filtered, this.sortOrder.value ?? 'desc');
  }

  reload(): void {
    this.loading = true;
    this.errorMessage = '';
    this.clientCasesService.getCases().subscribe({
      next: (cases) => {
        this.cases = cases ?? [];
        this.applyFilter();
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = extractApiError(
          err,
          'Could not load your cases. Please try again.',
        ).message;
      },
    });
  }

  getStatusBadgeClass(status: string): string {
    return STATUS_BADGE[status] ?? 'bb-chip-neutral';
  }

  trackById(_: number, item: { _id: string }): string { return item._id; }

  viewCase(id: string): void {
    this.router.navigate(['/client/cases', id]);
  }
}
