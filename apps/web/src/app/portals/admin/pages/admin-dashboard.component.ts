import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/auth/auth.service';
import { PageTitleService } from '../../../core/services/page-title.service';
import { Role } from '../../../core/models/user.model';

interface AdminDashboard {
  totalLeads: number;
  newLeadsToday: number;
  totalCases: number;
  totalRevenue: number;
  avgCaseCompletionDays: number;
  activeCaseManagers: number;
  casesByStatus: Record<string, number>;
  topPerformingCMs: { name: string; closedCases: number }[];
  pendingQaReviews: number;
  openComplaints: number;
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="flex items-center justify-between gap-3 mb-5">
      <p class="text-sm text-base-content/60">Platform-wide activity at a glance.</p>
    </div>

    @if (loading) {
      <div class="flex justify-center py-16">
        <span class="loading loading-spinner loading-md text-primary"></span>
      </div>
    }

    @if (!loading && stats) {
      <div class="bb-stats-grid mb-8">
        <div class="bb-stat-card accent-saffron flex items-center gap-3 p-3">
          <div class="h-9 w-9 rounded-lg bg-[var(--saffron)]/10 text-[var(--saffron)] flex items-center justify-center shrink-0">
            <i class="material-icons-outlined">people_alt</i>
          </div>
          <div>
            <div class="text-2xl font-bold">{{ stats.totalLeads | number }}</div>
            <div class="text-xs uppercase tracking-wide text-base-content/60">Total Leads</div>
            <div class="text-xs text-base-content/50">+{{ stats.newLeadsToday }} today</div>
          </div>
        </div>
        <div class="bb-stat-card accent-teal flex items-center gap-3 p-3">
          <div class="h-9 w-9 rounded-lg bg-teal-500/10 text-teal-600 flex items-center justify-center shrink-0">
            <i class="material-icons-outlined">folder_open</i>
          </div>
          <div>
            <div class="text-2xl font-bold">{{ stats.totalCases | number }}</div>
            <div class="text-xs uppercase tracking-wide text-base-content/60">Total Cases</div>
            <div class="text-xs text-base-content/50">Across all stages</div>
          </div>
        </div>
        <div class="bb-stat-card accent-ink flex items-center gap-3 p-3">
          <div class="h-9 w-9 rounded-lg bg-base-content/10 text-base-content/70 flex items-center justify-center shrink-0">
            <i class="material-icons-outlined">attach_money</i>
          </div>
          <div>
            <div class="text-2xl font-bold">\${{ stats.totalRevenue | number: '1.0-0' }}</div>
            <div class="text-xs uppercase tracking-wide text-base-content/60">Total Revenue</div>
            <div class="text-xs text-base-content/50">Captured collections</div>
          </div>
        </div>
        <div class="bb-stat-card accent-ink flex items-center gap-3 p-3">
          <div class="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <i class="material-icons-outlined">rate_review</i>
          </div>
          <div>
            <div class="text-2xl font-bold">{{ stats.pendingQaReviews }}</div>
            <div class="text-xs uppercase tracking-wide text-base-content/60">Pending QA Reviews</div>
            <div class="text-xs text-base-content/50">Waiting for verification</div>
          </div>
        </div>
        <div class="bb-stat-card accent-warn flex items-center gap-3 p-3">
          <div class="h-9 w-9 rounded-lg bg-error/10 text-error flex items-center justify-center shrink-0">
            <i class="material-icons-outlined">report_problem</i>
          </div>
          <div>
            <div class="text-2xl font-bold">{{ stats.openComplaints }}</div>
            <div class="text-xs uppercase tracking-wide text-base-content/60">Open Complaints</div>
            <div class="text-xs text-base-content/50">Require attention</div>
          </div>
        </div>
        <div class="bb-stat-card accent-teal flex items-center gap-3 p-3">
          <div class="h-9 w-9 rounded-lg bg-teal-500/10 text-teal-600 flex items-center justify-center shrink-0">
            <i class="material-icons-outlined">groups</i>
          </div>
          <div>
            <div class="text-2xl font-bold">{{ stats.activeCaseManagers }}</div>
            <div class="text-xs uppercase tracking-wide text-base-content/60">Active Case Managers</div>
            <div class="text-xs text-base-content/50">Currently carrying cases</div>
          </div>
        </div>
        <div class="bb-stat-card accent-ink flex items-center gap-3 p-3">
          <div class="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <i class="material-icons-outlined">schedule</i>
          </div>
          <div>
            <div class="text-2xl font-bold">{{ stats.avgCaseCompletionDays | number: '1.0-1' }}</div>
            <div class="text-xs uppercase tracking-wide text-base-content/60">Avg. Days to Close</div>
            <div class="text-xs text-base-content/50">Across closed cases</div>
          </div>
        </div>
      </div>

      <!-- Admin Modules Navigation -->
      <div class="mt-8 mb-8">
        <p class="bb-page-eyebrow">MODULES</p>
        <h2 class="bb-section-title mb-5">{{ isRole(Role.OPS_FINANCE) ? 'Ops & Finance Modules' : 'Admin Modules' }}</h2>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          @if (isRole(Role.ADMIN)) {
            <a routerLink="../users" class="bb-card bb-card-hover flex items-center gap-3 p-3">
              <div class="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <i class="material-icons-outlined">group</i>
              </div>
              <div>
                <div class="font-semibold text-sm">Users</div>
                <div class="text-xs text-base-content/60">Manage accounts and roles</div>
              </div>
            </a>
          }
          @if (isRole(Role.ADMIN, Role.CASE_MANAGER)) {
            <a routerLink="../cases" class="bb-card bb-card-hover flex items-center gap-3 p-3">
              <div class="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <i class="material-icons-outlined">folder_open</i>
              </div>
              <div>
                <div class="font-semibold text-sm">Cases</div>
                <div class="text-xs text-base-content/60">View and manage property cases</div>
              </div>
            </a>
          }
          @if (isRole(Role.ADMIN, Role.OPS_FINANCE)) {
            <a routerLink="../payments" class="bb-card bb-card-hover flex items-center gap-3 p-3">
              <div class="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <i class="material-icons-outlined">payment</i>
              </div>
              <div>
                <div class="font-semibold text-sm">Payments</div>
                <div class="text-xs text-base-content/60">Capture and refund payments</div>
              </div>
            </a>
          }
          @if (isRole(Role.ADMIN, Role.OPS_FINANCE)) {
            <a routerLink="../invoices" class="bb-card bb-card-hover flex items-center gap-3 p-3">
              <div class="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <i class="material-icons-outlined">receipt</i>
              </div>
              <div>
                <div class="font-semibold text-sm">Invoices</div>
                <div class="text-xs text-base-content/60">Create and manage invoices</div>
              </div>
            </a>
          }
          @if (isRole(Role.OPS_FINANCE, Role.CASE_MANAGER)) {
            <a routerLink="../disputes" class="bb-card bb-card-hover flex items-center gap-3 p-3">
              <div class="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <i class="material-icons-outlined">gavel</i>
              </div>
              <div>
                <div class="font-semibold text-sm">Disputes</div>
                <div class="text-xs text-base-content/60">Handle disputes and conflicts</div>
              </div>
            </a>
          }
          @if (isRole(Role.ADMIN, Role.OPS_FINANCE)) {
            <a routerLink="../complaints" class="bb-card bb-card-hover flex items-center gap-3 p-3">
              <div class="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <i class="material-icons-outlined">report_problem</i>
              </div>
              <div>
                <div class="font-semibold text-sm">Complaints</div>
                <div class="text-xs text-base-content/60">Manage customer complaints</div>
              </div>
            </a>
          }
          @if (isRole(Role.ADMIN, Role.OPS_FINANCE, Role.CASE_MANAGER)) {
            <a routerLink="../reports" class="bb-card bb-card-hover flex items-center gap-3 p-3">
              <div class="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <i class="material-icons-outlined">analytics</i>
              </div>
              <div>
                <div class="font-semibold text-sm">Reports</div>
                <div class="text-xs text-base-content/60">View analytics and reports</div>
              </div>
            </a>
          }
          @if (isRole(Role.ADMIN, Role.OPS_FINANCE)) {
            <a routerLink="../testimonials" class="bb-card bb-card-hover flex items-center gap-3 p-3">
              <div class="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <i class="material-icons-outlined">rate_review</i>
              </div>
              <div>
                <div class="font-semibold text-sm">Testimonials</div>
                <div class="text-xs text-base-content/60">Approve customer reviews</div>
              </div>
            </a>
          }
        </div>
      </div>

      <!-- Data Tables Section -->
      <p class="bb-page-eyebrow">ANALYTICS</p>
      <h2 class="bb-section-title mb-5">Performance Metrics</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        @if (caseStatusRows().length) {
          <div class="bb-card">
            <div class="bb-card-body">
              <p class="bb-section-title">Cases by Status</p>
              <div class="bb-table-wrap">
                <div class="bb-table-scroll">
                  <table class="bb-table">
                    <thead>
                      <tr>
                        <th>Status</th>
                        <th>Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (s of caseStatusRows(); track s.status) {
                        <tr>
                          <td>
                            <span class="bb-chip bb-chip-neutral">{{ s.status }}</span>
                          </td>
                          <td class="font-semibold">{{ s.count | number }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        }

        @if (stats.topPerformingCMs.length) {
          <div class="bb-card">
            <div class="bb-card-body">
              <p class="bb-section-title">Top Performing Case Managers</p>
              <div class="bb-table-wrap">
                <div class="bb-table-scroll">
                  <table class="bb-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Closed Cases</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (cm of stats.topPerformingCMs; track cm.name) {
                        <tr>
                          <td>{{ cm.name }}</td>
                          <td class="font-semibold">{{ cm.closedCases | number }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        }

        @if (!caseStatusRows().length && !stats.topPerformingCMs.length) {
          <div class="md:col-span-2 bb-empty">
            <div class="bb-empty-icon"><i class="material-icons-outlined">inbox</i></div>
            <p class="bb-empty-title">No data yet</p>
            <p>Stats will appear once cases are created.</p>
          </div>
        }
      </div>
    }

    @if (!loading && error) {
      <div role="alert" class="alert alert-error mt-4">
        <i class="material-icons-outlined">error_outline</i>
        <span>Failed to load dashboard data.</span>
      </div>
    }
  `,
  styles: [``],
})
export class AdminDashboardComponent implements OnInit {
  stats: AdminDashboard | null = null;
  loading = true;
  error = false;
  statusCols = ['status', 'count'];
  cmCols = ['name', 'closedCases'];
  readonly Role = Role;

  constructor(
    private api: ApiService,
    private auth: AuthService,
    private pageTitleService: PageTitleService,
  ) {}

  isRole(...roles: Role[]): boolean {
    return this.auth.isRole(...roles);
  }

  caseStatusRows(): { status: string; count: number }[] {
    if (!this.stats) return [];
    return Object.entries(this.stats.casesByStatus).map(([status, count]) => ({
      status,
      count,
    }));
  }

  ngOnInit(): void {
    this.pageTitleService.set(
      this.isRole(Role.OPS_FINANCE) ? 'Ops & Finance Dashboard' : 'Admin Dashboard',
    );
    this.api.get<AdminDashboard>('/dashboard/admin').subscribe({
      next: (data: AdminDashboard) => {
        this.stats = data;
        this.loading = false;
      },
      error: (err: unknown) => {
        this.error = true;
        this.loading = false;
      },
    });
  }
}
