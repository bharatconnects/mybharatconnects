import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';
import { roleGuard } from '../../core/guards/role.guard';
import { Role } from '../../core/models/user.model';
import { AdminLayoutComponent } from './admin-layout.component';

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    component: AdminLayoutComponent,
    canActivate: [authGuard, roleGuard([Role.ADMIN, Role.CASE_MANAGER])],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        title: 'Admin Dashboard | MyBharatConnects',
        canActivate: [roleGuard([Role.ADMIN])],
        loadComponent: () =>
          import('./pages/admin-dashboard.component').then((m) => m.AdminDashboardComponent),
      },
      {
        path: 'users',
        title: 'Users | MyBharatConnects',
        canActivate: [roleGuard([Role.ADMIN])],
        loadComponent: () =>
          import('./pages/admin-users.component').then((m) => m.AdminUsersComponent),
      },
      {
        path: 'leads',
        title: 'All Leads | MyBharatConnects',
        canActivate: [roleGuard([Role.ADMIN])],
        loadComponent: () =>
          import('../case-manager/pages/leads/cm-leads.component').then(
            (m) => m.CmLeadsComponent,
          ),
      },
      {
        path: 'cases',
        title: 'Admin Cases | MyBharatConnects',
        canActivate: [roleGuard([Role.ADMIN])],
        loadComponent: () =>
          import('./pages/admin-cases.component').then((m) => m.AdminCasesComponent),
      },
      {
        path: 'cases/:id',
        title: 'Case Details | MyBharatConnects',
        canActivate: [roleGuard([Role.ADMIN])],
        loadComponent: () =>
          import('../case-manager/pages/case-detail/cm-case-detail.component').then(
            (m) => m.CmCaseDetailComponent,
          ),
      },
      {
        path: 'complaints',
        title: 'Complaints | MyBharatConnects',
        canActivate: [roleGuard([Role.ADMIN])],
        loadComponent: () =>
          import('./pages/admin-complaints.component').then((m) => m.AdminComplaintsComponent),
      },
      {
        path: 'testimonials',
        title: 'Testimonials | MyBharatConnects',
        canActivate: [roleGuard([Role.ADMIN])],
        loadComponent: () =>
          import('./pages/admin-testimonials.component').then((m) => m.AdminTestimonialsComponent),
      },
      {
        path: 'invoices',
        title: 'Invoices | MyBharatConnects',
        canActivate: [roleGuard([Role.ADMIN])],
        loadComponent: () =>
          import('./pages/admin-invoices.component').then((m) => m.AdminInvoicesComponent),
      },
      {
        path: 'payments',
        title: 'Payments | MyBharatConnects',
        canActivate: [roleGuard([Role.ADMIN])],
        loadComponent: () =>
          import('./pages/admin-payments.component').then((m) => m.AdminPaymentsComponent),
      },
      {
        path: 'disputes',
        title: 'Disputes | MyBharatConnects',
        canActivate: [roleGuard([Role.CASE_MANAGER])],
        loadComponent: () =>
          import('./pages/admin-disputes.component').then((m) => m.AdminDisputesComponent),
      },
      {
        path: 'reports',
        title: 'Reports | MyBharatConnects',
        canActivate: [roleGuard([Role.ADMIN])],
        loadComponent: () =>
          import('./pages/admin-reports.component').then((m) => m.AdminReportsComponent),
      },
      {
        path: 'profile',
        title: 'My Profile | MyBharatConnects',
        canActivate: [roleGuard([Role.ADMIN])],
        loadComponent: () =>
          import('../../shared/components/my-profile/my-profile.component').then(
            (m) => m.MyProfileComponent,
          ),
      },
    ],
  },
];
