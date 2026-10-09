import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BrandLogoComponent } from '../../shared/components/brand-logo/brand-logo.component';
import { SERVICE_VERTICALS } from '../../shared/data/service-catalog';
import { ConsentService } from '../../core/services/consent.service';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink, BrandLogoComponent],
  template: `
    <footer class="bg-[var(--ink)] text-[var(--ivory)] px-6 sm:px-8 lg:px-12 pt-16">
      <div
        class="max-w-[1240px] mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr] gap-10 lg:gap-12 pb-12 border-b border-white/10"
      >
        <div>
          <app-brand-logo variant="full" [size]="34" [onDark]="true"></app-brand-logo>
          <p class="text-sm opacity-55 mt-3 leading-relaxed max-w-xs">
            India's premier NRI services platform. Managed with care, delivered with transparency.
          </p>
          <address class="flex flex-col gap-2 mt-4 not-italic">
            <a
              href="mailto:info@mybharatconnects.com"
              class="flex items-center gap-2 text-sm opacity-55 hover:opacity-100 transition w-fit"
            >
              <i class="material-icons-outlined text-base" aria-hidden="true">email</i>
              info&#64;mybharatconnects.com
            </a>
          </address>
          <ul class="flex items-center gap-3 mt-5" aria-label="Follow us on social media">
            @for (s of socials; track s.label) {
              <li>
                <a
                  [href]="s.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  [attr.aria-label]="s.label"
                  class="bb-social"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path [attr.d]="s.path" />
                  </svg>
                </a>
              </li>
            }
          </ul>
        </div>
        <nav aria-label="Services" class="flex flex-col gap-1">
          <h3 class="text-xs font-bold tracking-[0.14em] uppercase text-[var(--saffron)] mb-3">
            Services
          </h3>
          @for (v of verticals; track v.slug) {
            <a
              [routerLink]="['/services', v.slug]"
              class="text-sm opacity-55 hover:opacity-100 transition py-1"
              >{{ v.title }}</a
            >
          }
        </nav>
        <nav aria-label="Platform" class="flex flex-col gap-1">
          <h3 class="text-xs font-bold tracking-[0.14em] uppercase text-[var(--saffron)] mb-3">
            Platform
          </h3>
          <a routerLink="/about" class="text-sm opacity-55 hover:opacity-100 transition py-1"
            >About Us</a
          >
          <a routerLink="/blog" class="text-sm opacity-55 hover:opacity-100 transition py-1"
            >Blog</a
          >
          <a routerLink="/auth/login" class="text-sm opacity-55 hover:opacity-100 transition py-1"
            >Login</a
          >
          <a routerLink="/auth/register" class="text-sm opacity-55 hover:opacity-100 transition py-1"
            >Create your account</a
          >
        </nav>
      </div>
      <div
        class="max-w-[1240px] mx-auto flex flex-col sm:flex-row justify-between py-5 text-xs opacity-35 gap-2"
      >
        <span>© 2026 MyBharatConnects. All rights reserved.</span>
        <span>
          <a routerLink="/privacy" class="hover:text-[var(--saffron)] transition-colors"
            >Privacy Policy</a
          >
          &nbsp;·&nbsp;
          <a routerLink="/terms" class="hover:text-[var(--saffron)] transition-colors"
            >Terms of Service</a
          >
          &nbsp;·&nbsp;
          <button
            type="button"
            class="hover:text-[var(--saffron)] transition-colors cursor-pointer"
            (click)="consent.openPreferences()"
          >
            Cookie settings
          </button>
        </span>
      </div>
    </footer>
  `,
  styles: [
    `
      .bb-social {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        border-radius: 9999px;
        border: 1px solid rgba(255, 255, 255, 0.22);
        color: rgba(247, 245, 240, 0.75);
        transition:
          background-color 0.15s ease,
          border-color 0.15s ease,
          color 0.15s ease;
      }
      .bb-social svg {
        width: 16px;
        height: 16px;
      }
      .bb-social:hover,
      .bb-social:focus-visible {
        background: var(--saffron);
        border-color: var(--saffron);
        color: var(--ink);
        outline: none;
      }
    `,
  ],
})
export class FooterComponent {
  protected readonly consent = inject(ConsentService);
  readonly verticals = SERVICE_VERTICALS;

  // Brand glyphs aren't in Material Icons, so the paths are inlined here.
  readonly socials = [
    {
      label: 'YouTube',
      url: 'https://www.youtube.com/@MyBharatConnects',
      path: 'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z',
    },
    {
      label: 'LinkedIn',
      url: 'https://www.linkedin.com/company/my-bharat-connects/',
      path: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z',
    },
    {
      label: 'Facebook',
      url: 'https://www.facebook.com/profile.php?id=61594754618064',
      path: 'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z',
    },
    {
      label: 'Instagram',
      url: 'https://www.instagram.com/mybharatconnects/',
      path: 'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z',
    },
  ];
}
