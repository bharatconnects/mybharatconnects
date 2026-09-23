import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { PageTitleService } from '../../../core/services/page-title.service';
import { DateSortOrder, sortByDate } from '../../../shared/utils/sort-by-date.util';
import { BbSelectComponent } from '../../../shared/components/bb-select/bb-select.component';

interface Case {
  _id: string;
  caseNumber: string;
  serviceType: string;
  status: string;
  clientId: { name?: string; email?: string } | string | null;
  timeline?: { vendorStartedAt?: string };
  createdAt?: string;
  updatedAt?: string;
}

@Component({
  selector: 'app-vendor-jobs',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, BbSelectComponent],
  template: `
    <div class="flex items-center justify-end gap-3 mb-5">
      @if (!loading) {
        <span class="bb-page-count">{{ cases.length }} {{ cases.length === 1 ? 'job' : 'jobs' }}</span>
      }
    </div>

    @if (!loading && cases.length > 0) {
      <div class="bb-filter-card mb-4">
        <label class="bb-label" for="vendor-jobs-sort">Sort by</label>
        <app-bb-select
          id="vendor-jobs-sort"
          [(ngModel)]="sortOrder"
          (ngModelChange)="applySort()"
          ariaLabel="Sort by last update date"
          [options]="sortOrderOptions"
        ></app-bb-select>
      </div>
    }

    @if (loading) {
      <div class="flex justify-center py-12">
        <span
          class="loading loading-spinner loading-lg text-primary"
          aria-label="Loading jobs"
        ></span>
      </div>
    } @else if (cases.length === 0) {
      <div class="bb-card">
        <div class="bb-empty">
          <div class="bb-empty-icon"><i class="material-icons-outlined">work_off</i></div>
          <p class="bb-empty-title">No jobs assigned yet</p>
          <p class="text-sm text-base-content/60">
            When a case manager assigns you a case, it will show up here.
          </p>
        </div>
      </div>
    } @else {
      <!-- Desktop / tablet table -->
      <div class="hidden md:block bb-table-wrap">
        <div class="bb-table-scroll">
          <table class="bb-table">
            <thead>
              <tr>
                <th>Case #</th>
                <th>Service Type</th>
                <th>Status</th>
                <th>Client</th>
                <th>Started At</th>
              </tr>
            </thead>
            <tbody>
              @for (c of cases; track c._id) {
                <tr>
                  <td class="font-medium">
                    <a class="font-mono text-sm text-[var(--saffron)] hover:underline" [routerLink]="['/vendor/jobs', c.caseNumber]">{{
                      c.caseNumber
                    }}</a>
                  </td>
                  <td>{{ c.serviceType }}</td>
                  <td>
                    <span class="bb-chip" [ngClass]="statusChipClass(c.status)">{{
                      c.status
                    }}</span>
                  </td>
                  <td>{{ getClientName(c.clientId) }}</td>
                  <td>
                    {{
                      c.timeline && c.timeline.vendorStartedAt
                        ? (c.timeline.vendorStartedAt | date: 'mediumDate')
                        : '—'
                    }}
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- Mobile cards -->
      <div class="md:hidden flex flex-col gap-3">
        @for (c of cases; track c._id) {
          <a class="bb-row-card block" [routerLink]="['/vendor/jobs', c.caseNumber]">
            <div class="flex items-start justify-between gap-2 mb-2">
              <div class="font-mono text-sm text-[var(--saffron)] hover:underline">
                {{ c.caseNumber }}
              </div>
              <span class="bb-chip" [ngClass]="statusChipClass(c.status)">{{ c.status }}</span>
            </div>
            <div class="text-sm text-base-content/70 space-y-1">
              <div><span class="font-medium">Service:</span> {{ c.serviceType }}</div>
              <div><span class="font-medium">Client:</span> {{ getClientName(c.clientId) }}</div>
              <div>
                <span class="font-medium">Started:</span>
                {{
                  c.timeline && c.timeline.vendorStartedAt
                    ? (c.timeline.vendorStartedAt | date: 'mediumDate')
                    : '—'
                }}
              </div>
            </div>
          </a>
        }
      </div>
    }

    @if (!loading && error) {
      <div class="flex items-center gap-2 px-4 py-2.5 rounded-lg mb-4 text-sm bg-error/10 text-error border border-error/20">
        <i class="material-icons-outlined text-base">error_outline</i>
        Failed to load jobs. Please try again.
      </div>
    }
  `,
})
export class VendorJobsComponent implements OnInit {
  cases: Case[] = [];
  loading = true;
  error = false;
  sortOrder: DateSortOrder = 'desc';
  displayedColumns = ['caseNumber', 'serviceType', 'status', 'client', 'vendorStartedAt'];
  readonly sortOrderOptions = [
    { value: 'desc', label: 'Newest first' },
    { value: 'asc', label: 'Oldest first' },
  ];

  constructor(
    private api: ApiService,
    private pageTitleService: PageTitleService,
  ) {}

  ngOnInit(): void {
    this.pageTitleService.set('My Jobs');
    this.api.get<Case[]>('/cases/vendor/mine').subscribe({
      next: (data) => {
        this.cases = sortByDate(data ?? [], this.sortOrder);
        this.loading = false;
      },
      error: () => {
        this.error = true;
        this.loading = false;
      },
    });
  }

  applySort(): void {
    this.cases = sortByDate(this.cases, this.sortOrder);
  }

  getClientName(clientId: Case['clientId']): string {
    if (!clientId) return '—';
    if (typeof clientId === 'string') return clientId;
    const c = clientId as { name?: string; email?: string };
    if (c.name) return c.name.trim();
    return c.email ?? '—';
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
}
