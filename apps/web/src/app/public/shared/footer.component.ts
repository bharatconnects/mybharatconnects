import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BrandLogoComponent } from '../../shared/components/brand-logo/brand-logo.component';
import { SERVICE_VERTICALS } from '../../shared/data/service-catalog';

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
        </div>
        <nav aria-label="Services" class="flex flex-col gap-1">
          <h3 class="text-xs font-bold tracking-[0.14em] uppercase text-[var(--saffron)] mb-3">
            Services
          </h3>
          @for (v of verticals; track v.slug) {
            <a
              [routerLink]="['/services', v.slug]"
              class="text-sm opacity-55 hover:opacity-100 transition py-1"
              >{{ v.name }}</a
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
            >Register</a
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
        </span>
      </div>
    </footer>
  `,
})
export class FooterComponent {
  readonly verticals = SERVICE_VERTICALS;
}
