import { Component } from '@angular/core';
import {
  PortalShellComponent,
  PortalNavItem,
} from '../../shared/components/portal-shell/portal-shell.component';

@Component({
  selector: 'app-vendor-layout',
  standalone: true,
  imports: [PortalShellComponent],
  template: `
    <app-portal-shell
      portalTitle="Vendor Portal"
      [navItems]="navItems"
      persistKey="bb-vendor"
      drawerId="vendor-drawer"
    >
    </app-portal-shell>
  `,
})
export class VendorLayoutComponent {
  navItems: PortalNavItem[] = [
    { path: '/vendor/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { path: '/vendor/jobs', label: 'My Jobs', icon: 'work' },
    { path: '/vendor/calendar', label: 'Calendar', icon: 'event' },
    { path: '/vendor/invoices', label: 'My Earnings', icon: 'payments' },
    { path: '/vendor/profile', label: 'Business Profile', icon: 'store' },
    { path: '/vendor/account', label: 'My Account', icon: 'manage_accounts' },
    { path: '/vendor/complaints', label: 'Help & Support', icon: 'report_problem' },
  ];
}
