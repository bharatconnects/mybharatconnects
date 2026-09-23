import { Component } from '@angular/core';
import {
  PortalShellComponent,
  PortalNavItem,
} from '../../shared/components/portal-shell/portal-shell.component';

@Component({
  selector: 'app-qa-layout',
  standalone: true,
  imports: [PortalShellComponent],
  template: `
    <app-portal-shell
      portalTitle="QA Lead Portal"
      [navItems]="navItems"
      persistKey="bb-qa"
      drawerId="qa-drawer"
    >
    </app-portal-shell>
  `,
})
export class QaLayoutComponent {
  navItems: PortalNavItem[] = [
    { path: '/qa/reviews', label: 'Reviews', icon: 'fact_check' },
    { path: '/qa/complaints', label: 'Help & Support', icon: 'report_problem' },
    { path: '/qa/profile', label: 'My Profile', icon: 'manage_accounts' },
  ];
}
