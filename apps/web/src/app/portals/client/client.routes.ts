import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';
import { roleGuard } from '../../core/guards/role.guard';
import { Role } from '../../core/models/user.model';
import { ClientLayoutComponent } from './client-layout.component';

export const CLIENT_ROUTES: Routes = [
  {
    path: '',
    component: ClientLayoutComponent,
    canActivate: [authGuard, roleGuard([Role.CLIENT])],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        title: 'Dashboard | MyBharatConnects',
        loadComponent: () =>
          import('./pages/dashboard/client-dashboard.component').then(
            (m) => m.ClientDashboardComponent,
          ),
      },
      {
        path: 'cases',
        title: 'My Cases | MyBharatConnects',
        loadComponent: () =>
          import('./pages/cases/client-cases.component').then((m) => m.ClientCasesComponent),
      },
      {
        path: 'request-service',
        title: 'Request a Service | MyBharatConnects',
        loadComponent: () =>
          import('./pages/request-service/client-request-service.component').then(
            (m) => m.ClientRequestServiceComponent,
          ),
      },
      {
        path: 'cases/:id',
        title: 'Case Details | MyBharatConnects',
        loadComponent: () =>
          import('./pages/case-detail/client-case-detail.component').then(
            (m) => m.ClientCaseDetailComponent,
          ),
      },
      {
        path: 'payments',
        title: 'Payments | MyBharatConnects',
        loadComponent: () =>
          import('./pages/payments/client-payments.component').then(
            (m) => m.ClientPaymentsComponent,
          ),
      },
      {
        path: 'payments/:id/pay',
        title: 'Pay | MyBharatConnects',
        loadComponent: () =>
          import('./pages/payments/pay-payment.component').then(
            (m) => m.PayPaymentComponent,
          ),
      },
      {
        path: 'invoices',
        title: 'My Invoices | MyBharatConnects',
        loadComponent: () =>
          import('./pages/invoices/client-invoices.component').then(
            (m) => m.ClientInvoicesComponent,
          ),
      },
      {
        path: 'feedback',
        title: 'Feedback | MyBharatConnects',
        loadComponent: () =>
          import('./pages/feedback/client-feedback.component').then(
            (m) => m.ClientFeedbackComponent,
          ),
      },
      {
        path: 'complaints',
        title: 'Help & Support | MyBharatConnects',
        loadComponent: () =>
          import('./pages/help-support/client-help-support.component').then(
            (m) => m.ClientHelpSupportComponent,
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

