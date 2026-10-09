import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadChildren: () => import('./public/landing/landing.routes').then((m) => m.LANDING_ROUTES),
  },
  {
    path: 'auth',
    loadChildren: () => import('./public/login/login.routes').then((m) => m.LOGIN_ROUTES),
  },
  {
    path: 'client',
    loadChildren: () => import('./portals/client/client.routes').then((m) => m.CLIENT_ROUTES),
  },
  {
    path: 'case-manager',
    loadChildren: () =>
      import('./portals/case-manager/case-manager.routes').then((m) => m.CASE_MANAGER_ROUTES),
  },
  {
    path: 'vendor',
    loadChildren: () => import('./portals/vendor/vendor.routes').then((m) => m.VENDOR_ROUTES),
  },
  {
    path: 'qa',
    loadChildren: () => import('./portals/qa/qa.routes').then((m) => m.QA_ROUTES),
  },
  {
    path: 'admin',
    loadChildren: () => import('./portals/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
  },
  {
    path: 'ops-finance',
    loadChildren: () =>
      import('./portals/ops-finance/ops-finance.routes').then((m) => m.OPS_FINANCE_ROUTES),
  },
  {
    path: 'services',
    loadChildren: () => import('./public/services/services.routes').then((m) => m.SERVICES_ROUTES),
  },
  {
    path: 'blog',
    loadComponent: () => import('./public/blog/blog-list.component').then((m) => m.BlogListComponent),
  },
  {
    path: 'blog/:slug',
    loadComponent: () => import('./public/blog/blog-post.component').then((m) => m.BlogPostComponent),
  },
  {
    path: 'about',
    loadComponent: () => import('./public/about/about.component').then((m) => m.AboutComponent),
  },
  {
    path: 'faq',
    loadComponent: () => import('./public/faq/faq.component').then((m) => m.FaqComponent),
  },
  {
    path: 'careers',
    loadComponent: () =>
      import('./public/careers/careers.component').then((m) => m.CareersComponent),
  },
  {
    path: 'terms',
    loadComponent: () => import('./public/legal/terms.component').then((m) => m.TermsComponent),
  },
  {
    path: 'privacy',
    loadComponent: () => import('./public/legal/privacy.component').then((m) => m.PrivacyComponent),
  },
  {
    path: 'unsubscribe',
    loadComponent: () =>
      import('./public/unsubscribe/unsubscribe.component').then((m) => m.UnsubscribeComponent),
  },
  {
    path: 'ssr-test',
    loadComponent: () =>
      import('./public/ssr-test/ssr-test.component').then((m) => m.SsrTestComponent),
  },
  { path: '**', redirectTo: '' },
];
