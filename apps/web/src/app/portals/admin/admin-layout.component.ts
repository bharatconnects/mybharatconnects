import { Component } from '@angular/core';
import { Role } from '../../core/models/user.model';
import {
  PortalShellComponent,
  PortalNavItem,
} from '../../shared/components/portal-shell/portal-shell.component';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [PortalShellComponent],
  template: `
    <app-portal-shell
      portalTitle="Admin Portal"
      [navItems]="navItems"
      persistKey="bb-admin"
      drawerId="admin-drawer"
    >
    </app-portal-shell>
  `,
})
export class AdminLayoutComponent {
  // Each item shows only if the current user's role is in allowedRoles.
  // Mirrors the role × page matrix from R8 (admin per-page gating).
  navItems: PortalNavItem[] = [
    {
      path: 'dashboard',
      label: 'Dashboard',
      icon: 'dashboard',
      allowedRoles: [Role.ADMIN, Role.CASE_MANAGER],
    },
    { path: 'users', label: 'Users', icon: 'people', allowedRoles: [Role.ADMIN] },
    {
      path: 'leads',
      label: 'All Leads',
      icon: 'how_to_reg',
      allowedRoles: [Role.ADMIN, Role.CASE_MANAGER],
    },
    {
      path: 'cases',
      label: 'All Cases',
      icon: 'folder_open',
      allowedRoles: [Role.ADMIN, Role.CASE_MANAGER],
    },
    {
      path: 'complaints',
      label: 'Complaints',
      icon: 'report_problem',
      allowedRoles: [Role.ADMIN],
    },
    {
      path: 'testimonials',
      label: 'Testimonials',
      icon: 'star',
      allowedRoles: [Role.ADMIN],
    },
    {
      path: 'invoices',
      label: 'Invoices',
      icon: 'receipt_long',
      allowedRoles: [Role.ADMIN],
    },
    {
      path: 'payments',
      label: 'Payments',
      icon: 'payments',
      allowedRoles: [Role.ADMIN],
    },
    {
      path: 'reports',
      label: 'Reports',
      icon: 'analytics',
      allowedRoles: [Role.ADMIN, Role.CASE_MANAGER],
    },
    { path: 'profile', label: 'My Profile', icon: 'manage_accounts' },
  ];
}
