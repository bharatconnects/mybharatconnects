import { Component } from '@angular/core';
import { PortalShellComponent, PortalNavItem } from '../../shared/components/portal-shell/portal-shell.component';

@Component({
  selector: 'app-client-layout',
  standalone: true,
  imports: [PortalShellComponent],
  template: `
    <app-portal-shell
      portalTitle="Client Portal"
      [navItems]="navItems"
      persistKey="bb-client"
      drawerId="client-drawer">
    </app-portal-shell>
  `,
})
export class ClientLayoutComponent {
  navItems: PortalNavItem[] = [
    { path: '/client/dashboard',       label: 'Dashboard',         icon: 'dashboard' },
    { path: '/client/cases',           label: 'My Cases',          icon: 'folder_open' },
    { path: '/client/request-service', label: 'Request a Service', icon: 'add_circle', classes: 'font-semibold' },
    { path: '/client/invoices',        label: 'My Invoices',       icon: 'receipt_long' },
    { path: '/client/feedback',        label: 'Feedback',          icon: 'star_rate' },
    { path: '/client/complaints',      label: 'Help & Support',    icon: 'report_problem' },
    { path: '/client/profile',         label: 'My Profile',        icon: 'manage_accounts' },
  ];
}
