import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { NavbarComponent } from '../shared/navbar.component';
import { FooterComponent } from '../shared/footer.component';
import { SERVICE_VERTICALS } from '../../shared/data/service-catalog';

interface ServiceCard {
  slug: string;
  icon: string;
  title: string;
  tagline: string;
  highlights: string[];
  accent: string;
}

// The four verticals come from the shared catalog; only presentation accents
// live here. Each card previews the first three services in the vertical.
const VERTICAL_ACCENTS: Record<string, string> = {
  'tax-compliance': '#1f4e79',
  'wealth-management': '#c95f10',
  'real-estate': '#2a6399',
  'legal-documents': '#a54c0b',
};

const SERVICES: ServiceCard[] = SERVICE_VERTICALS.map((v) => ({
  slug: v.slug,
  icon: v.icon,
  title: v.name,
  tagline: v.blurb,
  highlights: v.services.slice(0, 3).map((s) => s.name),
  accent: VERTICAL_ACCENTS[v.slug] ?? '#1f4e79',
}));

@Component({
  selector: 'app-services-list',
  standalone: true,
  imports: [RouterLink, NavbarComponent, FooterComponent],
  template: `
    <app-navbar />

    <main>
      <!-- Hero -->
      <section
        class="px-6 sm:px-8 lg:px-12 pt-14 pb-12"
        style="background: radial-gradient(ellipse 80% 50% at 50% -10%, rgba(217,119,6,0.08) 0%, transparent 60%), var(--ivory)"
      >
        <div class="max-w-3xl mx-auto text-center">
          <p class="font-mono text-[11px] tracking-widest text-[var(--saffron)] mb-4 uppercase">
            Everything You Need
          </p>
          <h1
            class="font-serif font-light text-[var(--ink)] text-4xl sm:text-5xl leading-[1.1] mb-5"
          >
            Our <em class="italic text-[var(--saffron)]">Services</em>
          </h1>
          <p class="text-base sm:text-lg text-[var(--ink)]/70 leading-relaxed max-w-xl mx-auto">
            Four specialist verticals designed for NRIs — each backed by a dedicated case
            manager, transparent pricing, and a secure dashboard to track every step.
          </p>
        </div>
      </section>

      <!-- Service Cards Grid -->
      <section class="px-6 sm:px-8 lg:px-12 py-14 sm:py-18" style="background: var(--ivory)">
        <div class="max-w-7xl mx-auto">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-6 lg:gap-8">
            @for (s of services; track s.slug; let i = $index) {
              <a
                [routerLink]="['/services', s.slug]"
                class="bb-svc-card group block"
                [attr.aria-label]="'Learn more about ' + s.title"
              >
                <!-- Card number watermark -->
                <span class="bb-svc-num" aria-hidden="true">{{
                  (i + 1).toString().padStart(2, '0')
                }}</span>

                <!-- Icon pill -->
                <div class="bb-svc-icon-pill mb-5" [style]="'background:' + s.accent + '14'">
                  <i
                    class="material-icons-outlined bb-svc-icon"
                    [style]="'color:' + s.accent"
                    aria-hidden="true"
                    >{{ s.icon }}</i
                  >
                </div>

                <h2 class="text-xl font-bold text-[var(--ink)] mb-2 leading-snug">{{ s.title }}</h2>
                <p class="text-sm text-[var(--ink)]/65 leading-relaxed mb-5">{{ s.tagline }}</p>

                <!-- Highlights -->
                <ul class="flex flex-col gap-2 mb-6">
                  @for (h of s.highlights; track h) {
                    <li class="flex items-start gap-2 text-sm text-[var(--ink)]/75">
                      <i
                        class="material-icons-outlined text-base mt-[1px] shrink-0"
                        [style]="'color:' + s.accent"
                        aria-hidden="true"
                        >check_circle</i
                      >
                      {{ h }}
                    </li>
                  }
                </ul>

                <!-- CTA row -->
                <div
                  class="flex items-center gap-1.5 text-sm font-bold bb-svc-cta-text"
                  [style]="'color:' + s.accent"
                >
                  Explore all services
                  <i class="material-icons-outlined text-base bb-svc-arrow" aria-hidden="true"
                    >arrow_forward</i
                  >
                </div>
              </a>
            }
          </div>
        </div>
      </section>

      <!-- Bottom CTA -->
      <section
        class="px-6 sm:px-8 lg:px-12 py-16 sm:py-20 text-center"
        style="background: var(--ink)"
      >
        <div class="max-w-2xl mx-auto">
          <p class="font-mono text-[11px] tracking-widest text-[var(--saffron)] mb-4 uppercase">
            Get Started
          </p>
          <h2
            class="font-serif font-light text-[var(--ivory)] text-3xl sm:text-4xl mb-5 leading-snug"
          >
            Not sure which service you need?
          </h2>
          <p class="text-base text-[var(--ivory)]/65 mb-8 leading-relaxed">
            Book a free 30-minute discovery call and our team will recommend the right solution for
            your situation.
          </p>
          <a routerLink="/auth/register" class="bb-cta-btn">
            Book Free Consultation
            <i class="material-icons-outlined text-lg" aria-hidden="true">arrow_forward</i>
          </a>
        </div>
      </section>
    </main>

    <app-footer />
  `,
  styles: [
    `
      .bb-svc-card {
        position: relative;
        overflow: hidden;
        padding: 32px 28px 28px;
        background: #ffffff;
        border: 1px solid rgba(15, 26, 46, 0.08);
        border-radius: 10px;
        transition:
          transform 0.22s ease,
          box-shadow 0.22s ease,
          border-color 0.22s ease;
        cursor: pointer;
        text-decoration: none;
      }
      .bb-svc-card:hover {
        transform: translateY(-5px);
        box-shadow: 0 16px 40px rgba(15, 26, 46, 0.1);
        border-color: rgba(217, 119, 6, 0.35);
      }
      .bb-svc-num {
        position: absolute;
        top: 16px;
        right: 20px;
        font-family: 'DM Serif Display', serif;
        font-size: 56px;
        font-weight: 400;
        line-height: 1;
        color: var(--ink);
        opacity: 0.04;
        pointer-events: none;
        user-select: none;
      }
      .bb-svc-icon-pill {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 52px;
        height: 52px;
        border-radius: 14px;
      }
      .bb-svc-icon {
        font-size: 26px;
      }
      .bb-svc-arrow {
        transition: transform 0.18s ease;
      }
      .bb-svc-card:hover .bb-svc-arrow {
        transform: translateX(4px);
      }
      .bb-cta-btn {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 13px 28px;
        background: var(--saffron);
        color: var(--ink);
        font-family: 'Inter', sans-serif;
        font-size: 15px;
        font-weight: 700;
        letter-spacing: 0.01em;
        border: 2px solid var(--saffron);
        text-decoration: none;
        transition:
          background-color 0.15s ease,
          color 0.15s ease;
      }
      .bb-cta-btn:hover {
        background: var(--ivory);
        color: var(--ink);
        border-color: var(--ivory);
      }
    `,
  ],
})
export class ServicesListComponent {
  readonly services = SERVICES;

  constructor(title: Title, meta: Meta) {
    title.setTitle('Our Services — MyBharatConnects');
    meta.updateTag({
      name: 'description',
      content:
        'Explore our four NRI service verticals: Tax & Compliance, Wealth Management, Real Estate, and Legal Documents — every service handled end-to-end.',
    });
  }
}
