import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { ClientCasesService } from '../../services/client-cases.service';
import { DashboardData, Case } from '../../models/case.model';
import { PageTitleService } from '../../../../core/services/page-title.service';

@Component({
  selector: 'app-client-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <p class="text-sm text-base-content/60 mb-5">Here's a snapshot of your cases, documents and payments.</p>

    @if (loading) {
      <div class="flex justify-center py-16">
        <span class="loading loading-spinner loading-md text-primary"></span>
      </div>
    } @else {
      <div class="bb-stats-grid mb-8">
        <div class="bb-stat-card accent-saffron">
          <div class="bb-stat-icon">
            <i class="material-icons-outlined" style="color: var(--saffron)">folder_open</i>
          </div>
          <div class="bb-stat-value">{{ dashboardData?.activeCases ?? 0 }}</div>
          <div class="bb-stat-label">Active Cases</div>
          <div class="bb-stat-sub">Cases in progress</div>
        </div>
        <div class="bb-stat-card accent-warn">
          <div class="bb-stat-icon">
            <i class="material-icons-outlined" style="color: #dc2626">description</i>
          </div>
          <div class="bb-stat-value">{{ dashboardData?.pendingDocuments ?? 0 }}</div>
          <div class="bb-stat-label">Pending Documents</div>
          <div class="bb-stat-sub">Awaiting submission</div>
        </div>
        <div class="bb-stat-card accent-warn">
          <div class="bb-stat-icon">
            <i class="material-icons-outlined" style="color: #dc2626">payments</i>
          </div>
          <div class="bb-stat-value">{{ dashboardData?.pendingPayments ?? 0 }}</div>
          <div class="bb-stat-label">Pending Payments</div>
          <div class="bb-stat-sub">Awaiting completion</div>
        </div>
        <div class="bb-stat-card accent-saffron">
          <div class="bb-stat-icon">
            <i class="material-icons-outlined" style="color: var(--saffron)">real_estate_agent</i>
          </div>
          <div class="bb-stat-value">{{ dashboardData?.pendingRents ?? 0 }}</div>
          <div class="bb-stat-label">Pending Rent Payments</div>
          <div class="bb-stat-sub">Due or overdue</div>
        </div>
      </div>

      <div class="bb-card">
        <div class="bb-card-body">
          <div class="flex items-center justify-between pb-4 border-b border-base-300">
            <h2 class="bb-section-title">Recent Cases</h2>
            <a
              routerLink="/client/cases"
              class="inline-flex items-center gap-1 text-sm font-semibold text-[var(--saffron)] hover:underline"
            >
              View all <i class="material-icons-outlined text-base">arrow_forward</i>
            </a>
          </div>

          @if (recentCases.length === 0) {
            <div class="bb-empty">
              <div class="bb-empty-icon"><i class="material-icons-outlined">inbox</i></div>
              <p class="bb-empty-title">No cases yet</p>
              <p>Contact your case manager to get started.</p>
            </div>
          } @else {
            <div class="bb-table-scroll mt-4">
              <table class="bb-table">
                <thead>
                  <tr>
                    <th>Case #</th>
                    <th>Service</th>
                    <th>Status</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  @for (c of recentCases; track c._id) {
                    <tr>
                      <td class="font-mono text-sm whitespace-nowrap">
                        <a
                          class="font-mono text-sm text-[var(--saffron)] hover:underline"
                          [routerLink]="['/client/cases', c.caseNumber]"
                          [attr.aria-label]="'Open case details for ' + c.caseNumber"
                        >
                          {{ c.caseNumber }}
                        </a>
                      </td>
                      <td>{{ c.serviceType }}</td>
                      <td>
                        <span class="bb-chip bb-chip-neutral">{{ c.status }}</span>
                      </td>
                      <td>{{ c.updatedAt | date: 'mediumDate' }}</td>
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
export class ClientDashboardComponent implements OnInit {
  name = '';
  loading = true;
  dashboardData: DashboardData | null = null;
  recentCases: Case[] = [];
  displayedColumns = ['caseNumber', 'serviceType', 'status', 'updatedAt'];

  constructor(
    private authService: AuthService,
    private clientCasesService: ClientCasesService,
    private pageTitleService: PageTitleService,
  ) {}

  ngOnInit(): void {
    this.pageTitleService.set('Dashboard');
    this.name = this.authService.currentUser?.name ?? 'there';
    this.clientCasesService.getDashboard().subscribe({
      next: (data) => {
        this.dashboardData = data;
        this.recentCases = data.recentCases ?? [];
        if (this.recentCases.length === 0) {
          this.clientCasesService.getCases().subscribe({
            next: (cases) => {
              this.recentCases = (cases ?? []).slice(0, 5);
            },
          });
        }
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }
}
