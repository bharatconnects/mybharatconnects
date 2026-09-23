import { Component } from '@angular/core';
import {
  PortalShellComponent,
  PortalNavItem,
} from '../../shared/components/portal-shell/portal-shell.component';

@Component({
  selector: 'app-cm-layout',
  standalone: true,
  imports: [PortalShellComponent],
  template: `
    <app-portal-shell
      portalTitle="Case Manager"
      [navItems]="navItems"
      persistKey="bb-cm"
      drawerId="cm-drawer"
    >
    </app-portal-shell>
  `,
})
export class CaseManagerLayoutComponent {
  navItems: PortalNavItem[] = [
    { path: '/case-manager/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { path: '/case-manager/leads', label: 'Leads', icon: 'how_to_reg' },
    { path: '/case-manager/cases', label: 'Cases', icon: 'folder_open' },
    { path: '/case-manager/calendar', label: 'Calendar', icon: 'event' },
    { path: '/case-manager/vendors', label: 'Vendor Routing', icon: 'store' },
    { path: '/case-manager/crosssell', label: 'Cross-sell', icon: 'auto_awesome' },
    { path: '/case-manager/invoices', label: 'Payments', icon: 'receipt_long' },
    { path: '/case-manager/complaints', label: 'Help & Support', icon: 'report_problem' },
    { path: '/case-manager/profile', label: 'My Profile', icon: 'manage_accounts' },
  ];
}
