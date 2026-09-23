import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';
import { roleGuard } from '../../core/guards/role.guard';
import { Role } from '../../core/models/user.model';
import { CaseManagerLayoutComponent } from './case-manager-layout.component';

export const CASE_MANAGER_ROUTES: Routes = [
  {
    path: '',
    component: CaseManagerLayoutComponent,
    canActivate: [authGuard, roleGuard([Role.CASE_MANAGER])],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        title: 'CM Dashboard | MyBharatConnects',
        loadComponent: () =>
          import('./pages/dashboard/cm-dashboard.component').then((m) => m.CmDashboardComponent),
      },
      {
        path: 'leads',
        title: 'Leads | MyBharatConnects',
        loadComponent: () =>
          import('./pages/leads/cm-leads.component').then((m) => m.CmLeadsComponent),
      },
      {
        path: 'cases',
        title: 'Cases | MyBharatConnects',
        loadComponent: () =>
          import('./pages/cases/cm-cases.component').then((m) => m.CmCasesComponent),
      },
      {
        path: 'cases/:id',
        title: 'Case Details | MyBharatConnects',
        loadComponent: () =>
          import('./pages/case-detail/cm-case-detail.component').then(
            (m) => m.CmCaseDetailComponent,
          ),
      },
      {
        path: 'calendar',
        title: 'Calendar | MyBharatConnects',
        loadComponent: () =>
          import('./pages/calendar/cm-calendar.component').then((m) => m.CmCalendarComponent),
      },
      {
        path: 'vendors',
        title: 'Vendors | MyBharatConnects',
        loadComponent: () =>
          import('./pages/vendors/cm-vendors.component').then((m) => m.CmVendorsComponent),
      },
      {
        path: 'crosssell',
        title: 'Cross-sell | MyBharatConnects',
        loadComponent: () =>
          import('./pages/crosssell/cm-crosssell.component').then((m) => m.CmCrosssellComponent),
      },
      {
        path: 'invoices',
        title: 'Invoices | MyBharatConnects',
        loadComponent: () =>
          import('./pages/invoices/cm-invoices.component').then(
            (m) => m.CmInvoicesComponent,
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

