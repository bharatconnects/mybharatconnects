import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../../../core/services/api.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { PageTitleService } from '../../../../core/services/page-title.service';

interface RecentActivity {
  caseNumber: string;
  stage: string;
  changedAt: string;
}
interface DashboardData {
  activeCases: number;
  pendingFrqs: number;
  pendingCrossSellTriggers: number;
  overdueLeads: number;
  recentActivity: RecentActivity[];
}

@Component({
  selector: 'app-cm-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    @if (loading) {
      <div class="flex justify-center py-16">
        <span class="loading loading-spinner loading-md text-primary" aria-label="Loading"></span>
      </div>
    } @else {
      <div class="bb-stats-grid mb-6">
        <div class="bb-stat-card accent-saffron">
          <div class="bb-stat-icon">
            <i class="material-icons-outlined" style="color: var(--saffron)">folder_open</i>
          </div>
          <div class="bb-stat-value">{{ stats.activeCases }}</div>
          <div class="bb-stat-label">Active Cases</div>
        </div>
        <div class="bb-stat-card accent-teal">
          <div class="bb-stat-icon">
            <i class="material-icons-outlined" style="color: var(--teal)">assignment</i>
          </div>
          <div class="bb-stat-value">{{ stats.pendingFrqs }}</div>
          <div class="bb-stat-label">Pending FRQs</div>
        </div>
        <div class="bb-stat-card accent-teal">
          <div class="bb-stat-icon">
            <i class="material-icons-outlined" style="color: var(--teal)">trending_up</i>
          </div>
          <div class="bb-stat-value">{{ stats.pendingCrossSellTriggers }}</div>
          <div class="bb-stat-label">Cross-sell</div>
        </div>
        <div class="bb-stat-card accent-warn">
          <div class="bb-stat-icon">
            <i class="material-icons-outlined" style="color: #dc2626">schedule</i>
          </div>
          <div class="bb-stat-value">{{ stats.overdueLeads }}</div>
          <div class="bb-stat-label">Overdue Leads</div>
        </div>
      </div>

      <div class="bb-card">
        <div class="bb-card-body">
          <div class="flex items-center justify-between gap-2 pb-3 border-b border-base-300">
            <h2 class="bb-section-title m-0">Recent Activity</h2>
            <a routerLink="../cases" class="bb-btn bb-btn-primary bb-btn-sm gap-1">
              All Cases <i class="material-icons-outlined text-base">arrow_forward</i>
            </a>
          </div>

          @if (recentActivity.length === 0) {
            <div class="bb-empty">
              <div class="bb-empty-icon"><i class="material-icons-outlined">inbox</i></div>
              <p class="bb-empty-title">No recent activity</p>
              <p class="text-sm text-base-content/60">
                Case stage changes will appear here as they happen.
              </p>
            </div>
          } @else {
            <div class="bb-table-scroll mt-4">
              <table class="bb-table">
                <thead>
                  <tr>
                    <th>Case</th>
                    <th>Stage</th>
                    <th>When</th>
                  </tr>
                </thead>
                <tbody>
                  @for (r of recentActivity; track r.caseNumber + r.changedAt) {
                    <tr>
                      <td>
                        @if (caseRouteFor(r.caseNumber); as route) {
                          <a class="font-mono text-xs text-[var(--saffron)] hover:underline" [routerLink]="route">{{
                            r.caseNumber || '—'
                          }}</a>
                        } @else {
                          <span class="font-mono text-xs text-[var(--saffron)]">{{ r.caseNumber || '—' }}</span>
                        }
                      </td>
                      <td>
                        <span class="bb-chip bb-chip-warning">{{ r.stage }}</span>
                      </td>
                      <td class="text-sm">{{ r.changedAt | date: 'short' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>
      </div>
    }
  `,
})
export class CmDashboardComponent implements OnInit {
  loading = true;
  stats = { activeCases: 0, pendingFrqs: 0, pendingCrossSellTriggers: 0, overdueLeads: 0 };
  recentActivity: RecentActivity[] = [];

  constructor(
    public auth: AuthService,
    private api: ApiService,
    private pageTitleService: PageTitleService,
  ) {}

  ngOnInit(): void {
    this.pageTitleService.set('Hello, ' + (this.auth.currentUser?.name ?? 'there') + '!');

    this.api.get<DashboardData>('/dashboard/cm').subscribe({
      next: (data) => {
        this.stats = {
          activeCases: data.activeCases || 0,
          pendingFrqs: data.pendingFrqs || 0,
          pendingCrossSellTriggers: data.pendingCrossSellTriggers || 0,
          overdueLeads: data.overdueLeads || 0,
        };
        this.recentActivity = data.recentActivity || [];
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  caseRouteFor(caseNumber?: string): string[] | null {
    return caseNumber ? ['/case-manager/cases', caseNumber] : null;
  }
}
