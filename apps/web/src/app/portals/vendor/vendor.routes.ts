import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';
import { roleGuard } from '../../core/guards/role.guard';
import { Role } from '../../core/models/user.model';
import { VendorLayoutComponent } from './vendor-layout.component';

export const VENDOR_ROUTES: Routes = [
  {
    path: '',
    component: VendorLayoutComponent,
    canActivate: [authGuard, roleGuard([Role.VENDOR])],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        title: 'Vendor Dashboard | MyBharatConnects',
        loadComponent: () =>
          import('./pages/vendor-dashboard.component').then((m) => m.VendorDashboardComponent),
      },
      {
        path: 'jobs',
        title: 'My Jobs | MyBharatConnects',
        loadComponent: () =>
          import('./pages/vendor-jobs.component').then((m) => m.VendorJobsComponent),
      },
      {
        path: 'jobs/:id',
        title: 'Job Details | MyBharatConnects',
        loadComponent: () =>
          import('./pages/vendor-case-detail.component').then(
            (m) => m.VendorCaseDetailComponent,
          ),
      },
      {
        path: 'calendar',
        title: 'My Calendar | MyBharatConnects',
        loadComponent: () =>
          import('../case-manager/pages/calendar/cm-calendar.component').then(
            (m) => m.CmCalendarComponent,
          ),
      },
      {
        path: 'invoices',
        title: 'My Invoices | MyBharatConnects',
        loadComponent: () =>
          import('./pages/vendor-invoices.component').then((m) => m.VendorInvoicesComponent),
      },
      {
        path: 'profile',
        title: 'Business Profile | MyBharatConnects',
        loadComponent: () =>
          import('./pages/vendor-profile.component').then((m) => m.VendorProfileComponent),
      },
      {
        path: 'account',
        title: 'My Account | MyBharatConnects',
        loadComponent: () =>
          import('../../shared/components/my-profile/my-profile.component').then(
            (m) => m.MyProfileComponent,
          ),
      },
      {
        path: 'complaints',
        title: 'Help & Support | MyBharatConnects',
        loadComponent: () =>
          import('../../shared/components/raise-complaint/raise-complaint.component').then(
            (m) => m.RaiseComplaintComponent,
          ),
      },
    ],
  },
];
