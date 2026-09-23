import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { extractApiError } from '../../../core/services/api-error';
import { PageTitleService } from '../../../core/services/page-title.service';

type ReportTab = 'cases' | 'vendors' | 'finance' | 'quotes-by-outcome';

@Component({
  selector: 'app-admin-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="flex items-center justify-between gap-3 mb-5">
      <p class="text-sm text-base-content/60">
        Run cross-cutting reports and export them for offline analysis.
      </p>
      <span class="bb-page-count">{{ rows.length }} rows</span>
    </div>

    <div
      class="flex gap-1 p-1 rounded-lg mb-4 border border-base-300"
      style="background:var(--ivory-mute)"
    >
      <button
        type="button"
        class="bb-btn bb-btn-sm flex-1"
        [class.bb-btn-primary]="tab === 'cases'"
        [class.bb-btn-ghost]="tab !== 'cases'"
        (click)="setTab('cases')"
      >
        Cases
      </button>
      <button
        type="button"
        class="bb-btn bb-btn-sm flex-1"
        [class.bb-btn-primary]="tab === 'vendors'"
        [class.bb-btn-ghost]="tab !== 'vendors'"
        (click)="setTab('vendors')"
      >
        Vendors
      </button>
      <button
        type="button"
        class="bb-btn bb-btn-sm flex-1"
        [class.bb-btn-primary]="tab === 'finance'"
        [class.bb-btn-ghost]="tab !== 'finance'"
        (click)="setTab('finance')"
      >
        Finance
      </button>
      <button
        type="button"
        class="bb-btn bb-btn-sm flex-1"
        [class.bb-btn-primary]="tab === 'quotes-by-outcome'"
        [class.bb-btn-ghost]="tab !== 'quotes-by-outcome'"
        (click)="setTab('quotes-by-outcome')"
      >
        Quotes by Outcome
      </button>
    </div>

    <div class="bb-filter-card mb-4">
      <button
        type="button"
        class="bb-filter-toggle"
        (click)="filtersExpanded = !filtersExpanded"
        [attr.aria-expanded]="filtersExpanded"
      >
        <span class="flex items-center gap-1.5">
          <i class="material-icons-outlined text-base">tune</i>
          Date range
        </span>
        <i class="material-icons-outlined text-base">{{
          filtersExpanded ? 'expand_less' : 'expand_more'
        }}</i>
      </button>

      <div class="flex flex-col lg:flex-row lg:flex-wrap gap-3 items-stretch lg:items-end">
        <div
          class="contents"
          [class.bb-filter-row--collapsed]="!filtersExpanded"
        >
          <div class="w-full lg:w-44 lg:shrink-0">
            <label class="bb-label" for="report-from">From</label>
            <input
              id="report-from"
              class="bb-input"
              type="date"
              [(ngModel)]="from"
              aria-label="From date"
            />
          </div>
          <div class="w-full lg:w-44 lg:shrink-0">
            <label class="bb-label" for="report-to">To</label>
            <input
              id="report-to"
              class="bb-input"
              type="date"
              [(ngModel)]="to"
              aria-label="To date"
            />
          </div>
        </div>
        <div class="flex gap-2 items-center mt-3 lg:mt-0 lg:contents">
          <button class="bb-btn bb-btn-primary" (click)="fetchReport()" [disabled]="loading">
            <i class="material-icons-outlined text-base">play_arrow</i>
            {{ loading ? 'Loading...' : 'Run Report' }}
          </button>
          <button class="bb-btn bb-btn-outline" (click)="exportCsv()" [disabled]="!rows.length">
            <i class="material-icons-outlined text-base">file_download</i> Export CSV
          </button>
        </div>
      </div>
      @if (comingSoon) {
        <p class="bb-hint mt-3">Reports API coming soon for this tab.</p>
      }
    </div>

    @if (rows.length === 0) {
      <div class="bb-card">
        <div class="bb-empty">
          <div class="bb-empty-icon"><i class="material-icons-outlined">assessment</i></div>
          <p class="bb-empty-title">No data yet</p>
          <p>Pick a date range and click Run Report.</p>
        </div>
      </div>
    } @else {
      <div class="bb-table-wrap">
        <div class="bb-table-scroll">
          <table class="bb-table">
            <thead>
              <tr>
                @for (col of columns; track col) {
                  <th>{{ col }}</th>
                }
              </tr>
            </thead>
            <tbody>
              @for (r of rows; track $index) {
                <tr>
                  @for (col of columns; track col) {
                    <td class="whitespace-nowrap">{{ displayCell(r[col]) }}</td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    }
  `,
})
export class AdminReportsComponent implements OnInit {
  tab: ReportTab = 'cases';
  from = '';
  to = '';
  filtersExpanded = true;
  loading = false;
  comingSoon = false;
  rows: Record<string, unknown>[] = [];
  columns: string[] = [];

  constructor(
    private api: ApiService,
    private toast: ToastService,
    private pageTitleService: PageTitleService,
  ) {}

  ngOnInit(): void {
    this.pageTitleService.set('Reports');
  }

  setTab(t: ReportTab): void {
    this.tab = t;
    this.rows = [];
    this.columns = [];
    this.comingSoon = false;
  }

  fetchReport(): void {
    this.loading = true;
    const params: Record<string, string | number | boolean> = {};
    if (this.from) params['from'] = this.from;
    if (this.to) params['to'] = this.to;
    this.api.get<unknown>(`/reports/${this.tab}`, params).subscribe({
      next: (data) => {
        this.loading = false;
        this.comingSoon = false;
        const arr = this.toRows(data);
        this.rows = arr;
        this.columns = arr.length ? this.filterColumns(Object.keys(arr[0])) : [];
      },
      error: (err) => {
        this.loading = false;
        this.rows = [];
        this.columns = [];
        if (err?.status === 404) {
          this.comingSoon = true;
          this.toast.info('Report coming soon');
        } else {
          this.toast.error(extractApiError(err, 'Failed to fetch report').message);
        }
      },
    });
  }

  private filterColumns(cols: string[]): string[] {
    const colSet = new Set(cols);
    return cols.filter(col => {
      if (!col.endsWith('Id')) return true;
      const base = col.replace(/Id$/, '');
      return !colSet.has(base + 'Name') && !colSet.has(base + 'Number');
    });
  }

  private toRows(data: unknown): Record<string, unknown>[] {
    if (Array.isArray(data)) return data as Record<string, unknown>[];
    if (data && typeof data === 'object') return [data as Record<string, unknown>];
    return [];
  }

  displayCell(v: unknown): string {
    if (v === null || v === undefined) return '—';
    if (typeof v === 'object') return JSON.stringify(v);
    const s = String(v);
    // Truncate raw MongoDB ObjectIDs (24 hex chars)
    if (/^[0-9a-f]{24}$/i.test(s)) return s.slice(0, 8) + '…';
    return s;
  }

  exportCsv(): void {
    if (!this.rows.length) return;
    const cols = this.columns;
    const escape = (val: unknown): string => {
      const s =
        val === null || val === undefined
          ? ''
          : typeof val === 'object'
            ? JSON.stringify(val)
            : String(val);
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const header = cols.join(',');
    const lines = this.rows.map((r) => cols.map((c) => escape(r[c])).join(','));
    const csv = [header, ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${this.tab}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
