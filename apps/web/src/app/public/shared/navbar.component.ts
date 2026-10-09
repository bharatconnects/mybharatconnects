import { Component, ElementRef, HostListener, Input, ViewEncapsulation } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BrandLogoComponent } from '../../shared/components/brand-logo/brand-logo.component';
import { SERVICE_VERTICALS, ServiceVertical } from '../../shared/data/service-catalog';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, BrandLogoComponent],
  encapsulation: ViewEncapsulation.None,
  styles: [
    `
      /* Transparent at the top of the page (lets it read as one surface
       * with whatever sits behind it — e.g. the landing hero card) and
       * solidifies once the page scrolls, so it stays legible over
       * ordinary content. The easing is intentionally slow/soft rather
       * than a snap, since this fires on every scroll past the threshold. */
      .bb-navbar {
        background-color: transparent;
        border-bottom: 1px solid transparent;
        box-shadow: none;
        transition:
          background-color 480ms cubic-bezier(0.16, 1, 0.3, 1),
          border-color 480ms cubic-bezier(0.16, 1, 0.3, 1),
          backdrop-filter 480ms cubic-bezier(0.16, 1, 0.3, 1),
          box-shadow 480ms cubic-bezier(0.16, 1, 0.3, 1);
      }
      .bb-navbar--solid {
        background-color: rgba(247, 245, 240, 0.95);
        backdrop-filter: blur(10px);
        border-bottom-color: var(--ink-12);
        box-shadow: 0 1px 0 rgba(12, 33, 53, 0.02);
      }

      /* Light-on-dark palette for the transparent state, while it floats
       * over the dark hero panel — text/icons flip from --ink to white,
       * with color/border transitions matching .bb-navbar's own timing. */
      .bb-navbar--on-dark .bb-nav-hamburger,
      .bb-navbar--on-dark .bb-nav-link,
      .bb-navbar--on-dark .bb-nav-link-muted {
        color: rgba(255, 255, 255, 0.92);
        transition: color 480ms cubic-bezier(0.16, 1, 0.3, 1);
      }
      .bb-navbar--on-dark .bb-nav-hamburger:hover,
      .bb-navbar--on-dark .bb-nav-hamburger:focus-visible {
        background: rgba(255, 255, 255, 0.14);
      }
      .bb-navbar--on-dark .bb-nav-cta {
        background: transparent;
        border-color: rgba(255, 255, 255, 0.55);
        color: #ffffff;
        transition:
          background-color 480ms cubic-bezier(0.16, 1, 0.3, 1),
          border-color 480ms cubic-bezier(0.16, 1, 0.3, 1),
          color 480ms cubic-bezier(0.16, 1, 0.3, 1);
      }
      .bb-navbar--on-dark .bb-nav-cta:hover {
        background: #ffffff;
        border-color: #ffffff;
        color: var(--navy-900);
      }

      .bb-nav-link {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        color: var(--ink);
        transition: color 0.15s ease;
      }
      .bb-nav-link-muted {
        color: var(--ink);
        opacity: 0.78;
      }
      .bb-nav-link-muted:hover,
      .bb-nav-link-muted.is-open {
        color: var(--saffron-deep, var(--saffron));
        opacity: 1;
      }
      .bb-nav-link-icon {
        font-size: 19px;
        transition: transform 0.18s ease;
      }
      .bb-nav-link-muted.is-open .bb-nav-link-icon {
        transform: rotate(180deg);
      }

      .bb-nav-cta {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 20px;
        background: var(--ink);
        color: var(--ivory);
        font-family: 'Plus Jakarta Sans', sans-serif;
        font-size: 14.5px;
        font-weight: 700;
        letter-spacing: 0.01em;
        border-radius: 9999px;
        border: 2px solid var(--ink);
        transition:
          background-color 0.15s ease,
          border-color 0.15s ease,
          color 0.15s ease,
          transform 0.06s ease;
      }
      /* Keep an icon from stretching the pill taller than its siblings. */
      .bb-nav-cta i {
        width: 20px;
        height: 20px;
        font-size: 20px;
        line-height: 1;
      }
      .bb-nav-cta:hover {
        background: var(--saffron);
        border-color: var(--saffron);
        color: var(--ink);
      }
      .bb-nav-cta:active {
        transform: translateY(1px);
      }
      .bb-nav-cta:focus-visible {
        outline: none;
        box-shadow: 0 0 0 3px rgba(217, 119, 6, 0.35);
      }

      /* Services mega-menu */
      .bb-nav-services {
        position: relative;
      }
      .bb-nav-services-trigger {
        background: none;
        border: none;
        cursor: pointer;
        font: inherit;
        padding: 0;
      }
      .bb-nav-menu {
        position: absolute;
        top: calc(100% + 18px);
        left: 50%;
        transform: translateX(-50%);
        width: min(640px, 92vw);
        background: #ffffff;
        border-radius: 16px;
        border: 1px solid var(--ink-12, rgba(22, 40, 60, 0.1));
        box-shadow: 0 24px 56px rgba(12, 33, 53, 0.16);
        padding: 10px;
        z-index: 60;
        animation: bb-nav-menu-in 0.16s ease;
      }
      @keyframes bb-nav-menu-in {
        from {
          opacity: 0;
          transform: translateX(-50%) translateY(-6px);
        }
        to {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }
      }
      .bb-nav-menu-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 4px;
      }
      .bb-nav-menu-item {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 12px;
        border-radius: 10px;
        text-decoration: none;
        transition: background-color 0.15s ease;
      }
      .bb-nav-menu-item:hover,
      .bb-nav-menu-item:focus-visible {
        background: var(--navy-50, rgba(31, 78, 121, 0.08));
      }
      .bb-nav-menu-item:focus-visible {
        outline: none;
        box-shadow: inset 0 0 0 2px var(--brand-navy, #1f4e79);
      }
      .bb-nav-menu-item:hover .bb-nav-menu-item-icon,
      .bb-nav-menu-item:focus-visible .bb-nav-menu-item-icon {
        background: var(--brand-navy, #1f4e79);
        color: #ffffff;
      }
      .bb-nav-menu-item:hover .bb-nav-menu-item-name {
        color: var(--brand-navy, #1f4e79);
      }
      .bb-nav-menu-item-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 38px;
        height: 38px;
        border-radius: 10px;
        background: var(--navy-50, rgba(31, 78, 121, 0.08));
        color: var(--brand-navy, #1f4e79);
        flex-shrink: 0;
        transition:
          background-color 0.15s ease,
          color 0.15s ease;
      }
      .bb-nav-menu-item-icon i {
        font-size: 20px;
      }
      .bb-nav-menu-item-name {
        font-size: 14px;
        font-weight: 700;
        color: var(--ink);
        margin: 0 0 3px;
      }
      .bb-nav-menu-item-blurb {
        font-size: 12.5px;
        line-height: 1.45;
        color: var(--ink);
        opacity: 0.6;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .bb-nav-menu-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-top: 6px;
        padding: 12px 12px 6px;
        border-top: 1px solid var(--ink-12, rgba(22, 40, 60, 0.08));
      }
      .bb-nav-menu-footer-text {
        font-size: 12.5px;
        color: var(--ink);
        opacity: 0.55;
      }
      .bb-nav-menu-footer-link {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 13px;
        font-weight: 700;
        color: var(--saffron-deep, var(--saffron));
        text-decoration: none;
      }
      .bb-nav-menu-footer-link:hover {
        text-decoration: underline;
      }
      .bb-nav-menu-footer-link i {
        font-size: 16px;
      }

      /* Mobile hamburger. This component runs unencapsulated
       * (ViewEncapsulation.None), so its plain CSS classes are unlayered and
       * always beat Tailwind's layered utility classes — a "hidden sm:flex"
       * on the same element would never actually hide it. Gate display with
       * a real media query here instead of relying on Tailwind responsive
       * classes for any element that also carries one of this stylesheet's
       * own display-setting classes. */
      .bb-nav-hamburger {
        display: none;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        margin-left: -8px;
        border: none;
        border-radius: 10px;
        background: transparent;
        color: var(--ink);
        cursor: pointer;
        transition: background-color 0.15s ease;
      }
      @media (max-width: 1023.98px) {
        .bb-nav-hamburger {
          display: inline-flex;
        }
      }
      .bb-nav-hamburger:hover,
      .bb-nav-hamburger:focus-visible {
        background: var(--ink-12, rgba(22, 40, 60, 0.08));
      }
      .bb-nav-hamburger:focus-visible {
        outline: none;
      }

      /* Desktop-only nav items (About Us / Blog / FAQ / Careers; Services is its own dropdown) — same reason
       * as .bb-nav-hamburger above: .bb-nav-link's own display: inline-flex
       * would otherwise beat Tailwind's "hidden lg:inline". The seven header
       * items only fit side by side from 1024px up; below that they live in
       * the hamburger menu. */
      .bb-nav-desktop-link {
        display: none;
      }
      @media (min-width: 1024px) {
        .bb-nav-desktop-link {
          display: inline-flex;
        }
      }

      /* Primary "Book Discovery Call" pill: saffron so it outranks the
       * Sign In pill beside it. Desktop header only; on smaller screens it
       * is the highlighted row in the hamburger menu instead. */
      .bb-nav-cta-primary {
        display: none;
        background: var(--saffron);
        border-color: var(--saffron);
        color: var(--ink);
        white-space: nowrap;
      }
      @media (min-width: 1024px) {
        .bb-nav-cta-primary {
          display: inline-flex;
        }
      }
      .bb-nav-cta-primary:hover,
      .bb-navbar--on-dark .bb-nav-cta-primary:hover {
        background: var(--ink);
        border-color: var(--ink);
        color: var(--ivory);
      }
      .bb-navbar--on-dark .bb-nav-cta-primary {
        background: var(--saffron);
        border-color: var(--saffron);
        color: var(--ink);
      }
      .bb-navbar--on-dark .bb-nav-cta-primary:hover {
        background: #ffffff;
        border-color: #ffffff;
        color: var(--navy-900);
      }

      /* Mobile menu drawer — same display-override reasoning as
       * .bb-nav-hamburger above; also matters here since resizing an
       * already-open drawer past the breakpoint (no page reload in an SPA)
       * must still hide it. */
      .bb-mobile-menu {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        display: none;
        flex-direction: column;
        padding: 6px 6px 10px;
        background: var(--ivory);
        border-bottom: 1px solid var(--ink-12);
        box-shadow: 0 16px 32px rgba(12, 33, 53, 0.14);
        animation: bb-mobile-menu-in 0.16s ease;
      }
      @media (max-width: 1023.98px) {
        .bb-mobile-menu {
          display: flex;
        }
      }
      @keyframes bb-mobile-menu-in {
        from {
          opacity: 0;
          transform: translateY(-6px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      .bb-mobile-menu-link {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 13px 14px;
        border-radius: 10px;
        font-size: 15px;
        font-weight: 600;
        color: var(--ink);
        text-decoration: none;
      }
      .bb-mobile-menu-link:hover,
      .bb-mobile-menu-link:focus-visible {
        background: var(--navy-50, rgba(31, 78, 121, 0.08));
        outline: none;
      }
      .bb-mobile-menu-link i {
        font-size: 20px;
        color: var(--ink-60, rgba(22, 40, 60, 0.6));
        flex-shrink: 0;
      }
      .bb-mobile-menu-cta {
        margin-top: 6px;
        justify-content: center;
        background: var(--saffron);
        color: var(--ink);
        font-weight: 700;
      }
      .bb-mobile-menu-cta:hover,
      .bb-mobile-menu-cta:focus-visible {
        background: var(--ink);
        color: var(--ivory);
      }
      .bb-mobile-menu-cta i,
      .bb-mobile-menu-cta:hover i,
      .bb-mobile-menu-cta:focus-visible i {
        color: inherit;
      }
    `,
  ],
  template: `
    <header
      class="bb-navbar sticky top-0 z-50 py-2 relative"
      [class.bb-navbar--solid]="!immersive || scrolled"
      [class.bb-navbar--on-dark]="immersive && !scrolled"
    >
      <div class="max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-10 flex items-center justify-between">
      <div class="flex items-center gap-1 sm:gap-0">
        <button
          type="button"
          class="bb-nav-hamburger"
          (click)="toggleMobileMenu()"
          [attr.aria-expanded]="mobileMenuOpen"
          aria-controls="bb-mobile-menu"
          aria-label="Toggle menu"
        >
          <i class="material-icons-outlined" aria-hidden="true">{{
            mobileMenuOpen ? 'close' : 'menu'
          }}</i>
        </button>
        <a
          routerLink="/"
          aria-label="MyBharatConnects home"
          class="inline-flex items-center"
          (click)="closeMobileMenu()"
        >
          <app-brand-logo
            variant="lockup"
            [size]="36"
            [onDark]="immersive && !scrolled"
            class="hidden sm:inline-flex"
          ></app-brand-logo>
          <app-brand-logo
            variant="lockup"
            [size]="28"
            [onDark]="immersive && !scrolled"
            class="sm:hidden"
          ></app-brand-logo>
        </a>
      </div>
      <nav class="flex items-center gap-4 lg:gap-6 xl:gap-9 text-base font-semibold" aria-label="Primary">
        <a routerLink="/about" class="bb-nav-desktop-link bb-nav-link bb-nav-link-muted">About Us</a>
        <div
          class="hidden lg:block bb-nav-services"
          (mouseenter)="onServicesMouseEnter()"
          (mouseleave)="onServicesMouseLeave()"
        >
          <button
            type="button"
            class="bb-nav-link bb-nav-link-muted bb-nav-services-trigger"
            [class.is-open]="servicesOpen"
            (click)="toggleServices()"
            [attr.aria-expanded]="servicesOpen"
            aria-haspopup="true"
          >
            Services
            <i class="material-icons-outlined bb-nav-link-icon" aria-hidden="true"
              >expand_more</i
            >
          </button>
          @if (servicesOpen) {
            <div class="bb-nav-menu" role="menu">
              <div class="bb-nav-menu-grid">
                @for (v of verticals; track v.slug) {
                  <a
                    [routerLink]="['/services', v.slug]"
                    class="bb-nav-menu-item"
                    role="menuitem"
                    (click)="closeServices()"
                  >
                    <span class="bb-nav-menu-item-icon">
                      <i class="material-icons-outlined" aria-hidden="true">{{ v.icon }}</i>
                    </span>
                    <span>
                      <p class="bb-nav-menu-item-name">{{ v.title }}</p>
                      <p class="bb-nav-menu-item-blurb">{{ v.blurb }}</p>
                    </span>
                  </a>
                }
              </div>
              <div class="bb-nav-menu-footer">
                <span class="bb-nav-menu-footer-text">Every service, one platform.</span>
                <a routerLink="/services" class="bb-nav-menu-footer-link" (click)="closeServices()">
                  Explore all services
                  <i class="material-icons-outlined" aria-hidden="true">arrow_forward</i>
                </a>
              </div>
            </div>
          }
        </div>
        <a routerLink="/blog" class="bb-nav-desktop-link bb-nav-link bb-nav-link-muted">Blog</a>
        <a routerLink="/faq" class="bb-nav-desktop-link bb-nav-link bb-nav-link-muted">FAQ</a>
        <a routerLink="/careers" class="bb-nav-desktop-link bb-nav-link bb-nav-link-muted">Careers</a>
        <a routerLink="/auth/login" class="bb-nav-cta">
          Sign In
          <i class="material-icons-outlined text-lg" aria-hidden="true">arrow_forward</i>
        </a>
        <a routerLink="/" fragment="consultation" class="bb-nav-cta bb-nav-cta-primary">
          <i class="material-icons-outlined text-lg" aria-hidden="true">event_available</i>
          Book Discovery Call
        </a>
      </nav>
      </div>

      @if (mobileMenuOpen) {
        <div id="bb-mobile-menu" class="bb-mobile-menu" role="menu">
          <a
            routerLink="/about"
            class="bb-mobile-menu-link"
            role="menuitem"
            (click)="closeMobileMenu()"
          >
            <i class="material-icons-outlined" aria-hidden="true">info</i>
            About Us
          </a>
          <a
            routerLink="/services"
            class="bb-mobile-menu-link"
            role="menuitem"
            (click)="closeMobileMenu()"
          >
            <i class="material-icons-outlined" aria-hidden="true">apps</i>
            Services
          </a>
          <a
            routerLink="/blog"
            class="bb-mobile-menu-link"
            role="menuitem"
            (click)="closeMobileMenu()"
          >
            <i class="material-icons-outlined" aria-hidden="true">article</i>
            Blog
          </a>
          <a
            routerLink="/faq"
            class="bb-mobile-menu-link"
            role="menuitem"
            (click)="closeMobileMenu()"
          >
            <i class="material-icons-outlined" aria-hidden="true">help_outline</i>
            FAQ
          </a>
          <a
            routerLink="/careers"
            class="bb-mobile-menu-link"
            role="menuitem"
            (click)="closeMobileMenu()"
          >
            <i class="material-icons-outlined" aria-hidden="true">work_outline</i>
            Careers
          </a>
          <a
            routerLink="/"
            fragment="consultation"
            class="bb-mobile-menu-link bb-mobile-menu-cta"
            role="menuitem"
            (click)="closeMobileMenu()"
          >
            <i class="material-icons-outlined" aria-hidden="true">event_available</i>
            Book Discovery Call
          </a>
        </div>
      }
    </header>
  `,
})
export class NavbarComponent {
  readonly verticals: ServiceVertical[] = SERVICE_VERTICALS;
  servicesOpen = false;
  mobileMenuOpen = false;
  // When true, the navbar starts fully transparent with light (on-dark) text
  // — for sitting directly over a dark hero panel — and only gains its
  // normal solid ivory background + dark text once the page scrolls past
  // SCROLL_THRESHOLD. Pages without a dark hero behind the navbar should
  // leave this false so the header stays solid/legible throughout.
  @Input() immersive = false;
  scrolled = false;
  private readonly scrollThreshold = 40;
  // Small delay before closing on mouseleave so moving the cursor from the
  // trigger down into the panel (a diagonal path) doesn't flicker it shut.
  private closeTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(private elementRef: ElementRef<HTMLElement>) {
    if (typeof window !== 'undefined') {
      this.scrolled = window.scrollY > this.scrollThreshold;
    }
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    if (!this.immersive) return;
    this.scrolled = window.scrollY > this.scrollThreshold;
  }

  private clearCloseTimeout(): void {
    if (this.closeTimeout !== null) {
      clearTimeout(this.closeTimeout);
      this.closeTimeout = null;
    }
  }

  onServicesMouseEnter(): void {
    this.clearCloseTimeout();
    this.servicesOpen = true;
  }

  onServicesMouseLeave(): void {
    this.clearCloseTimeout();
    this.closeTimeout = setTimeout(() => {
      this.servicesOpen = false;
    }, 150);
  }

  toggleServices(): void {
    this.clearCloseTimeout();
    this.servicesOpen = !this.servicesOpen;
  }

  closeServices(): void {
    this.clearCloseTimeout();
    this.servicesOpen = false;
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen = !this.mobileMenuOpen;
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen = false;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.servicesOpen && !this.elementRef.nativeElement.contains(event.target as Node)) {
      this.clearCloseTimeout();
      this.servicesOpen = false;
    }
    if (this.mobileMenuOpen && !this.elementRef.nativeElement.contains(event.target as Node)) {
      this.mobileMenuOpen = false;
    }
  }

  @HostListener('keydown.escape')
  onEscape(): void {
    this.clearCloseTimeout();
    this.servicesOpen = false;
    this.mobileMenuOpen = false;
  }
}
