import { Component } from '@angular/core';
import {
  PortalShellComponent,
  PortalNavItem,
} from '../../shared/components/portal-shell/portal-shell.component';

@Component({
  selector: 'app-ops-finance-layout',
  standalone: true,
  imports: [PortalShellComponent],
  template: `
    <app-portal-shell
      portalTitle="Ops & Finance Portal"
      [navItems]="navItems"
      persistKey="bb-ops-finance"
      drawerId="ops-finance-drawer"
    >
    </app-portal-shell>
  `,
})
export class OpsFinanceLayoutComponent {
  navItems: PortalNavItem[] = [
    { path: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    { path: 'payments', label: 'Payments', icon: 'payments' },
    { path: 'disputes', label: 'Disputes', icon: 'gavel' },
    { path: 'complaints', label: 'Help & Support', icon: 'report_problem' },
    { path: 'raise-complaint', label: 'Raise a Complaint', icon: 'campaign' },
    { path: 'reports', label: 'Reports', icon: 'analytics' },
    { path: 'testimonials', label: 'Testimonials', icon: 'star' },
    { path: 'profile', label: 'My Profile', icon: 'manage_accounts' },
  ];
}
