import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';
import { roleGuard } from '../../core/guards/role.guard';
import { Role } from '../../core/models/user.model';
import { QaLayoutComponent } from './qa-layout.component';

export const QA_ROUTES: Routes = [
  {
    path: '',
    component: QaLayoutComponent,
    canActivate: [authGuard, roleGuard([Role.QA, Role.ADMIN])],
    children: [
      { path: '', redirectTo: 'reviews', pathMatch: 'full' },
      {
        path: 'reviews',
        title: 'QA Reviews | MyBharatConnects',
        loadComponent: () =>
          import('./pages/qa-reviews.component').then((m) => m.QaReviewsComponent),
      },
      {
        path: 'reviews/:id',
        title: 'QA Review Detail | MyBharatConnects',
        loadComponent: () =>
          import('./pages/qa-review-detail.component').then((m) => m.QaReviewDetailComponent),
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

