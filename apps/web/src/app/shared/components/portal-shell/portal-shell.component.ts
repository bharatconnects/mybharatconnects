import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../../core/auth/auth.service';
import { Role } from '../../../core/models/user.model';
import { User } from '../../../core/models/user.model';
import { PageTitleService } from '../../../core/services/page-title.service';
import {
  PortalHeaderTabsService,
  HeaderTabsConfig,
} from '../../../core/services/portal-header-tabs.service';
import { BrandLogoComponent } from '../brand-logo/brand-logo.component';

export interface PortalNavItem {
  path: string;
  label: string;
  icon: string;
  /** Optional. Only renders when current user's role is in this list. */
  allowedRoles?: string[];
  /** Optional Tailwind classes — e.g., a primary CTA highlight. */
  classes?: string;
}

const ROLE_BADGE: Record<string, string> = {
  [Role.ADMIN]: 'Admin',
  [Role.OPS_FINANCE]: 'Ops & Finance',
  [Role.QA]: 'QA',
  [Role.CASE_MANAGER]: 'Case Manager',
  [Role.VENDOR]: 'Vendor',
  [Role.CLIENT]: 'Client',
};

@Component({
  selector: 'app-portal-shell',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet, BrandLogoComponent],
  template: `
    <div class="drawer lg:drawer-open min-h-screen bg-base-100">
      <input [id]="drawerId" type="checkbox" class="drawer-toggle" />

      <!-- ── Right side: navbar + content ── -->
      <div class="drawer-content flex flex-col min-w-0">
        <header
          class="sticky top-0 z-30 flex items-center gap-2 px-3 sm:px-5 h-14 bg-base-100/85 backdrop-blur-md border-b border-base-300"
        >
          <!-- Mobile menu toggle -->
          <label
            [attr.for]="drawerId"
            aria-label="Open navigation menu"
            class="lg:hidden flex items-center justify-center w-10 h-10 rounded-md text-base-content hover:bg-base-200 cursor-pointer"
          >
            <i class="material-icons-outlined">menu</i>
          </label>

          <!-- Mobile: no brand in the header — the logo lives in the side menu. -->
          <div class="lg:hidden flex-1"></div>

          <div class="flex-1 min-w-0 hidden lg:flex items-center px-2 gap-0.5">
            @if (headerTabs) {
              @for (tab of headerTabs.tabs; track tab.id) {
                <button
                  class="bb-portal-tab"
                  [class.bb-portal-tab--active]="headerTabs.activeId === tab.id"
                  (click)="headerTabs.onSelect(tab.id)"
                >
                  <i class="material-icons-outlined" style="font-size:1.1rem">{{ tab.icon }}</i>
                  {{ tab.label }}
                </button>
              }
            } @else if (pageTitle) {
              <span class="text-xl font-bold text-base-content truncate">{{ pageTitle }}</span>
              @if (pageBadge) {
                <span class="ml-2 text-sm font-normal" style="color: var(--ink-60)">{{
                  pageBadge
                }}</span>
              }
            }
          </div>

          <!-- User identity + logout -->
          <div class="flex items-center gap-3">
            <div class="hidden sm:flex items-center gap-2.5">
              <!-- Avatar with initials -->
              <span class="bb-user-avatar" [attr.aria-label]="userName">{{ userInitials }}</span>
              <div class="flex flex-col leading-tight">
                <span class="text-sm font-semibold text-base-content">{{ userName }}</span>
                <div class="flex items-center gap-1 mt-0.5">
                  @if (roleLabel) {
                    <span class="bb-chip bb-chip-role">{{ roleLabel }}</span>
                  }
                  @if (presenceLabel) {
                    <span class="bb-chip" [ngClass]="presenceClass">{{ presenceLabel }}</span>
                  }
                </div>
              </div>
            </div>

            <!-- Mobile: just the avatar + role chip. Wrapped in a div so
                 sm:hidden works on the parent — applying display utilities
                 directly to a .bb-chip element doesn't beat the design
                 system's display rule. -->
            @if (roleLabel) {
              <div class="flex items-center gap-2 sm:hidden">
                <span class="bb-user-avatar" [attr.aria-label]="userName">{{ userInitials }}</span>
                <span class="bb-chip bb-chip-role">{{ roleLabel }}</span>
              </div>
            }

            <button
              type="button"
              class="bb-btn bb-btn-danger bb-btn-icon"
              (click)="logout()"
              aria-label="Logout"
              title="Logout"
            >
              <i class="material-icons-outlined">logout</i>
            </button>
          </div>
        </header>

        <main class="flex-1 w-full p-4 sm:p-6 lg:p-8 min-w-0">
          <router-outlet></router-outlet>
        </main>
      </div>

      <!-- ── Left side: sidebar ── -->
      <aside class="drawer-side z-40">
        <label
          [attr.for]="drawerId"
          aria-label="Close navigation menu"
          class="drawer-overlay"
        ></label>

        <div
          class="bb-portal-sidebar min-h-full flex flex-col overflow-x-hidden transition-[width] duration-200 ease-out"
          [class.w-64]="!collapsed"
          [class.lg:w-16]="collapsed"
        >
          <!-- Brand -->
          <div
            class="px-4 py-5 flex items-center bb-portal-sidebar-brand-row"
            [class.justify-between]="!collapsed"
            [class.justify-center]="collapsed"
          >
            @if (!collapsed) {
              <div>
                <app-brand-logo variant="lockup" [size]="34" [onDark]="true"></app-brand-logo>
                <div class="bb-sidebar-subtitle bb-sidebar-subtitle-light">{{ portalTitle }}</div>
              </div>
            } @else {
              <app-brand-logo
                variant="mark"
                [size]="32"
                [onDark]="true"
                [title]="portalTitle"
              ></app-brand-logo>
            }
          </div>

          <!-- Navigation -->
          <ul class="menu menu-md w-full p-2 gap-1 flex-1">
            @for (item of visibleNav; track item.path) {
              <li>
                <a
                  [routerLink]="item.path"
                  routerLinkActive="menu-active"
                  [routerLinkActiveOptions]="{ exact: false }"
                  [title]="collapsed ? item.label : ''"
                  [class.justify-center]="collapsed"
                  [class]="item.classes ?? ''"
                >
                  <i class="material-icons-outlined">{{ item.icon }}</i>
                  @if (!collapsed) {
                    <span class="truncate">{{ item.label }}</span>
                  }
                </a>
              </li>
            }
          </ul>

          <!-- Collapse toggle (desktop only) -->
          <button
            type="button"
            (click)="toggleCollapse()"
            class="bb-portal-sidebar-footer hidden lg:flex items-center justify-center gap-1 w-full h-12 cursor-pointer transition-colors"
            [attr.aria-label]="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
            [attr.aria-expanded]="!collapsed"
          >
            <i class="material-icons-outlined text-lg shrink-0">{{
              collapsed ? 'chevron_right' : 'chevron_left'
            }}</i>
            @if (!collapsed) {
              <span class="text-xs font-medium">Collapse</span>
            }
          </button>
        </div>
      </aside>
    </div>
  `,
  styles: [
    `
      /* Topbar inline tabs (injected by page components) */
      .bb-portal-tab {
        display: inline-flex;
        align-items: center;
        gap: 0.375rem;
        padding: 0.45rem 0.875rem;
        font-size: 0.875rem;
        font-weight: 500;
        color: var(--ink-60);
        border-radius: 0.375rem;
        border: none;
        background: none;
        cursor: pointer;
        transition:
          color 120ms ease,
          background 120ms ease;
        white-space: nowrap;
      }
      .bb-portal-tab:hover {
        color: var(--ink);
        background: var(--ink-06);
      }
      .bb-portal-tab--active {
        color: var(--navy-900);
        font-weight: 700;
        background: linear-gradient(90deg, var(--saffron) 0%, var(--saffron-400) 100%);
        box-shadow: 0 2px 6px rgba(232, 119, 34, 0.3);
      }
      .bb-portal-tab--active:hover {
        color: var(--navy-900);
        background: linear-gradient(90deg, var(--saffron) 0%, var(--saffron-400) 100%);
      }

      /* Dark sidebar shell — navy gradient, echoing the logo's deep blue */
      .bb-portal-sidebar {
        background: linear-gradient(180deg, #1a4265 0%, var(--navy-800) 55%, var(--navy-900) 100%);
        border-right: 1px solid rgba(247, 245, 240, 0.08);
      }

      .bb-portal-sidebar-brand-row {
        border-bottom: 1px solid rgba(245, 240, 230, 0.08);
      }

      /* Brand text overrides for dark bg */
      .bb-sidebar-brand-light {
        color: var(--ivory) !important;
      }
      .bb-sidebar-brand-light .accent {
        color: var(--saffron);
      }
      .bb-sidebar-subtitle-light {
        color: rgba(245, 240, 230, 0.45) !important;
      }

      /* Nav links on dark background */
      .bb-portal-sidebar .menu li > a {
        color: rgba(245, 240, 230, 0.82);
        border-radius: 0.375rem;
        transition:
          background-color 120ms ease,
          color 120ms ease;
      }
      .bb-portal-sidebar .menu li > a:hover {
        background: rgba(245, 240, 230, 0.08) !important;
        color: var(--ivory) !important;
      }
      .bb-portal-sidebar .menu li > a.menu-active {
        background: var(--saffron-200) !important;
        color: var(--navy-900) !important;
        font-weight: 600;
        box-shadow: 0 2px 8px rgba(232, 119, 34, 0.35);
      }
      .bb-portal-sidebar .menu li > a.menu-active:hover {
        background: var(--saffron-400) !important;
        color: var(--navy-900) !important;
      }
      .bb-portal-sidebar .menu li > a i {
        color: inherit;
      }

      /* Collapse toggle footer */
      .bb-portal-sidebar-footer {
        border-top: 1px solid rgba(245, 240, 230, 0.08);
        color: rgba(245, 240, 230, 0.45);
      }
      .bb-portal-sidebar-footer:hover {
        background: rgba(245, 240, 230, 0.06);
        color: var(--ivory);
      }
    `,
  ],
})
export class PortalShellComponent implements OnInit, OnDestroy {
  @Input({ required: true }) portalTitle!: string;
  @Input({ required: true }) navItems: PortalNavItem[] = [];
  @Input({ required: true }) persistKey!: string;
  @Input() drawerId = 'portal-drawer';

  userName = '';
  userInitials = '';
  roleLabel = '';
  presenceLabel: 'Online' | 'Away' | '' = '';
  presenceClass = 'bb-chip-success';
  collapsed = false;
  visibleNav: PortalNavItem[] = [];
  pageTitle = '';
  pageBadge: string | null = null;
  headerTabs: HeaderTabsConfig | null = null;
  private readonly destroy$ = new Subject<void>();

  constructor(
    private authService: AuthService,
    private router: Router,
    private pageTitleService: PageTitleService,
    private headerTabsService: PortalHeaderTabsService,
  ) {}

  ngOnInit(): void {
    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe((user) => this.applyUserState(user));

    this.applyUserState(this.authService.currentUser);

    this.pageTitleService.title$
      .pipe(takeUntil(this.destroy$))
      .subscribe((t) => (this.pageTitle = t));

    this.pageTitleService.badge$
      .pipe(takeUntil(this.destroy$))
      .subscribe((b) => (this.pageBadge = b));

    this.headerTabsService.config$
      .pipe(takeUntil(this.destroy$))
      .subscribe((c) => (this.headerTabs = c));

    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntil(this.destroy$),
      )
      .subscribe(() => {
        this.pageTitleService.set('');
        this.pageTitleService.setBadge(null);
        this.closeDrawer();
      });

    try {
      this.collapsed = localStorage.getItem(this.collapseKey()) === '1';
    } catch {
      /* localStorage blocked */
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // The DaisyUI drawer is a plain checkbox (#drawerId) driving CSS, not an
  // Angular-bound property — on mobile a nav-link click navigates but never
  // unchecks it, so the sidebar stays open over the new page underneath.
  // Uncheck it on every navigation; harmless on desktop, where lg:drawer-open
  // keeps the sidebar visible regardless of the checkbox's state.
  private closeDrawer(): void {
    try {
      const input = document.getElementById(this.drawerId) as HTMLInputElement | null;
      if (input) input.checked = false;
    } catch {
      /* not running in a browser */
    }
  }

  private applyUserState(user: User | null): void {
    this.userName = user ? (user.name ?? '').trim() : '';
    this.userInitials = this.computeInitials(user?.name);
    this.roleLabel = user?.role ? (ROLE_BADGE[user.role] ?? user.role) : '';
    this.presenceLabel = user?.presence === 'AWAY' ? 'Away' : user ? 'Online' : '';
    this.presenceClass = user?.presence === 'AWAY' ? 'bb-chip-warning' : 'bb-chip-success';
    this.visibleNav = this.filterByRole(this.navItems, user?.role);
  }

  private computeInitials(name?: string): string {
    const parts = (name || '').trim().split(/\s+/).filter(Boolean);
    const a = (parts[0]?.[0] || '').toUpperCase();
    const b = (parts.length > 1 ? parts[parts.length - 1][0] : '').toUpperCase();
    return `${a}${b}` || '?';
  }

  private filterByRole(items: PortalNavItem[], role?: string): PortalNavItem[] {
    return items.filter((i) => !i.allowedRoles || (role ? i.allowedRoles.includes(role) : false));
  }

  private collapseKey(): string {
    return `${this.persistKey}-sidebar-collapsed`;
  }

  toggleCollapse(): void {
    this.collapsed = !this.collapsed;
    try {
      localStorage.setItem(this.collapseKey(), this.collapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
  }

  logout(): void {
    this.authService.logout();
  }
}
