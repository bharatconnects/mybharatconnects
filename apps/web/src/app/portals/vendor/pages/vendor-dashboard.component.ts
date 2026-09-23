import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/auth/auth.service';
import { PageTitleService } from '../../../core/services/page-title.service';

interface VendorDashboard {
  activeJobs: number;
  completedJobs: number;
  rating: number;
  pendingQuotes: number;
}

interface JobCase {
  _id: string;
  caseNumber: string;
  serviceType: string;
  status: string;
  clientId: { name?: string; email?: string } | string | null;
  updatedAt?: string;
}

@Component({
  selector: 'app-vendor-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    @if (loading) {
      <div class="flex justify-center py-16">
        <span class="loading loading-spinner loading-md text-primary" aria-label="Loading"></span>
      </div>
    }

    @if (!loading && stats) {
      <div class="bb-stats-grid">
        <div class="bb-stat-card accent-saffron">
          <div class="bb-stat-icon"><i class="material-icons-outlined" style="color: var(--saffron)">work_outline</i></div>
          <div class="bb-stat-value">{{ stats.activeJobs }}</div>
          <div class="bb-stat-label">Active Jobs</div>
        </div>
        <div class="bb-stat-card accent-teal">
          <div class="bb-stat-icon"><i class="material-icons-outlined" style="color: var(--teal)">check_circle_outline</i></div>
          <div class="bb-stat-value">{{ stats.completedJobs }}</div>
          <div class="bb-stat-label">Completed Jobs</div>
        </div>
        <div class="bb-stat-card accent-ink">
          <div class="bb-stat-icon"><i class="material-icons-outlined" style="color: var(--ink)">star_outline</i></div>
          <div class="bb-stat-value">{{ stats.rating | number: '1.1-1' }}</div>
          <div class="bb-stat-label">Overall Rating</div>
          <div class="flex gap-0.5 mt-2" aria-label="Rating stars">
            @for (star of getStars(stats.rating); track $index) {
              <i class="material-icons-outlined text-sm leading-none"
                 [style.color]="star === 'empty' ? 'rgba(15,26,46,0.3)' : 'var(--saffron)'">
                {{ star === 'full' ? 'star' : star === 'half' ? 'star_half' : 'star_border' }}
              </i>
            }
          </div>
        </div>
        <div class="bb-stat-card accent-warn">
          <div class="bb-stat-icon"><i class="material-icons-outlined" style="color: #dc2626">pending_actions</i></div>
          <div class="bb-stat-value">{{ stats.pendingQuotes }}</div>
          <div class="bb-stat-label">Pending Quotes</div>
        </div>
      </div>
    }

    @if (!loading && error) {
      <div class="flex items-center gap-2 px-4 py-2.5 rounded-lg mb-4 text-sm bg-error/10 text-error border border-error/20">
        <i class="material-icons-outlined text-base">error_outline</i>
        Failed to load dashboard data.
      </div>
    }

    <!-- All jobs -->
    <div class="bb-card">
      <div class="bb-card-body">
        <h3 class="bb-section-title">All Jobs</h3>
        @if (jobsLoading) {
          <div class="flex justify-center py-8">
            <span class="loading loading-spinner loading-md text-primary"></span>
          </div>
        } @else if (jobs.length === 0) {
          <p class="text-sm text-base-content/60">No jobs assigned yet.</p>
        } @else {
          <div class="bb-table-wrap">
            <div class="bb-table-scroll">
              <table class="bb-table">
                <thead>
                  <tr>
                    <th>Case #</th>
                    <th>Service Type</th>
                    <th>Client</th>
                    <th>Status</th>
                    <th>Last Updated</th>
                  </tr>
                </thead>
                <tbody>
                  @for (j of jobs; track j._id) {
                    <tr>
                      <td class="font-medium">
                        <a class="font-mono text-sm text-[var(--saffron)] hover:underline" [routerLink]="['/vendor/jobs', j.caseNumber]">{{
                          j.caseNumber
                        }}</a>
                      </td>
                      <td>{{ j.serviceType }}</td>
                      <td>{{ getClientName(j.clientId) }}</td>
                      <td>
                        <span class="bb-chip" [ngClass]="jobStatusChipClass(j.status)">{{
                          j.status
                        }}</span>
                      </td>
                      <td class="text-sm text-base-content/70">
                        {{ j.updatedAt ? (j.updatedAt | date: 'mediumDate') : '—' }}
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }
      </div>
    </div>
  `,
})
export class VendorDashboardComponent implements OnInit {
  stats: VendorDashboard | null = null;
  loading = true;
  error = false;

  jobs: JobCase[] = [];
  jobsLoading = true;

  constructor(
    private api: ApiService,
    public auth: AuthService,
    private pageTitleService: PageTitleService,
  ) {}

  ngOnInit(): void {
    this.pageTitleService.set('Dashboard');
    this.loadJobs();
    this.api.get<VendorDashboard>('/dashboard/vendor').subscribe({
      next: (data) => {
        this.stats = data;
        this.loading = false;
      },
      error: () => {
        this.error = true;
        this.loading = false;
      },
    });
  }

  getStars(rating: number): string[] {
    const stars: string[] = [];
    for (let i = 1; i <= 5; i++) {
      if (rating >= i) stars.push('full');
      else if (rating >= i - 0.5) stars.push('half');
      else stars.push('empty');
    }
    return stars;
  }

  loadJobs(): void {
    this.jobsLoading = true;
    this.api.get<JobCase[]>('/cases/vendor/mine').subscribe({
      next: (data) => {
        this.jobs = data ?? [];
        this.jobsLoading = false;
      },
      error: () => {
        this.jobsLoading = false;
      },
    });
  }

  getClientName(clientId: JobCase['clientId']): string {
    if (!clientId) return '—';
    if (typeof clientId === 'string') return clientId;
    if (clientId.name) return clientId.name.trim();
    return clientId.email ?? '—';
  }

  jobStatusChipClass(status: string): string {
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
