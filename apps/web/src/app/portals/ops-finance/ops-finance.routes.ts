import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';
import { roleGuard } from '../../core/guards/role.guard';
import { Role } from '../../core/models/user.model';
import { OpsFinanceLayoutComponent } from './ops-finance-layout.component';

export const OPS_FINANCE_ROUTES: Routes = [
  {
    path: '',
    component: OpsFinanceLayoutComponent,
    canActivate: [authGuard, roleGuard([Role.OPS_FINANCE])],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        title: 'Ops & Finance Dashboard | MyBharatConnects',
        loadComponent: () =>
          import('../admin/pages/admin-dashboard.component').then(
            (m) => m.AdminDashboardComponent,
          ),
      },
      {
        path: 'complaints',
        title: 'Help & Support | MyBharatConnects',
        loadComponent: () =>
          import('../admin/pages/admin-complaints.component').then(
            (m) => m.AdminComplaintsComponent,
          ),
      },
      {
        path: 'raise-complaint',
        title: 'Raise a Complaint | MyBharatConnects',
        loadComponent: () =>
          import('../../shared/components/raise-complaint/raise-complaint.component').then(
            (m) => m.RaiseComplaintComponent,
          ),
      },
      {
        path: 'testimonials',
        title: 'Testimonials | MyBharatConnects',
        loadComponent: () =>
          import('../admin/pages/admin-testimonials.component').then(
            (m) => m.AdminTestimonialsComponent,
          ),
      },
      {
        path: 'payments',
        title: 'Payments | MyBharatConnects',
        loadComponent: () =>
          import('../admin/pages/admin-payments.component').then(
            (m) => m.AdminPaymentsComponent,
          ),
      },
      {
        path: 'disputes',
        title: 'Disputes | MyBharatConnects',
        loadComponent: () =>
          import('../admin/pages/admin-disputes.component').then(
            (m) => m.AdminDisputesComponent,
          ),
      },
      {
        path: 'reports',
        title: 'Reports | MyBharatConnects',
        loadComponent: () =>
          import('../admin/pages/admin-reports.component').then((m) => m.AdminReportsComponent),
      },
      {
        path: 'profile',
        title: 'My Profile | MyBharatConnects',
        loadComponent: () =>
          import('../../shared/components/my-profile/my-profile.component').then(
            (m) => m.MyProfileComponent,
          ),
      },
    ],
  },
];
