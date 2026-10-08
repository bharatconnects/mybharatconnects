import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { NavbarComponent } from '../shared/navbar.component';
import { FooterComponent } from '../shared/footer.component';
import { verticalBySlug } from '../../shared/data/service-catalog';

interface Offering {
  title: string;
  desc: string;
}

interface ServiceCard {
  slug: string;
  icon: string;
  title: string;
  tagline: string;
  offerings: Offering[];
  accent: string;
  ctaLabel: string;
}

// Copy for this page's practice-area cards, in display order. The icon and
// header colour come from the shared service catalog so they match the
// homepage cards; the slug links each card to its detail page.
const PAGE_COPY: Omit<ServiceCard, 'icon' | 'accent'>[] = [
  {
    slug: 'tax-compliance',
    title: 'Tax & Cross-Border Compliance',
    tagline:
      'India and US tax filing, double-taxation relief (DTAA), lower withholding tax certificates, and income tax notice management, handled end-to-end by empanelled CAs.',
    offerings: [
      {
        title: 'Lower TDS Certificate (Form 13)',
        desc: 'Minimize upfront withholding tax on Indian property sales.',
      },
      {
        title: 'Form 15CA & 15CB Repatriation Filing',
        desc: 'Seamless legal transfer of funds from NRO/NRE accounts to overseas banks.',
      },
      {
        title: 'Comprehensive Tax & Compliance Bundles',
        desc: 'Cross-border filing and audit defence for dual-tax residents.',
      },
    ],
    ctaLabel: 'Explore Tax & Compliance Solutions',
  },
  {
    slug: 'real-estate',
    title: 'Real Estate & Property Management',
    tagline:
      'Turnkey property oversight, sales execution, estate planning, and curated investment opportunities for NRI property owners across India.',
    offerings: [
      {
        title: 'Turnkey Property Management',
        desc: 'Tenant management, lease agreements, routine inspections, and rent collection.',
      },
      {
        title: 'Remote Property Sale Execution',
        desc: 'End-to-end legal verification, buyer coordination, and capital gains tax optimization.',
      },
      {
        title: 'HNI Real Estate Curation',
        desc: 'Access vetted, high-yield residential and commercial property investments in India.',
      },
    ],
    ctaLabel: 'Explore Real Estate Services',
  },
  {
    slug: 'legal-documents',
    title: 'Legal Services & Estate Administration',
    tagline:
      'Inheritance claims, property succession, mutation, and court representation handled locally in India by empanelled legal counsel.',
    offerings: [
      {
        title: 'Succession & Legal Heir Certificates',
        desc: 'Fast-track court proceedings and estate clearance for ancestral assets.',
      },
      {
        title: 'Property Title Transfer & Revenue Mutation',
        desc: 'Official updating of government land records and municipal titles.',
      },
      {
        title: 'Power of Attorney (PoA) Execution',
        desc: 'Secure drafting, adjudication, and local registration without traveling to India.',
      },
    ],
    ctaLabel: 'Explore Legal & Estate Services',
  },
  {
    slug: 'wealth-management',
    title: 'NRI Wealth & Advisory',
    tagline:
      'Optimize cross-border investments, manage currency risk, and navigate GIFT-City investment vehicles built for international Indian portfolios.',
    offerings: [
      {
        title: 'NRI Mutual Fund & NRE/NRO KYC Setup',
        desc: 'Frictionless onboarding and compliance alignment across global accounts.',
      },
      {
        title: 'Cross-Border Property Financing Desk',
        desc: 'Mortgage setup and refinancing options for Indian real estate acquisitions.',
      },
      {
        title: 'Insurance Claim Recovery & GIFT-City Advisory',
        desc: 'Tax-efficient investment structuring and dormant asset retrieval.',
      },
    ],
    ctaLabel: 'Explore Wealth & Investment Solutions',
  },
];

const SERVICES: ServiceCard[] = PAGE_COPY.map((c) => {
  const v = verticalBySlug(c.slug);
  return { ...c, icon: v?.icon ?? 'apps', accent: v?.accent ?? '#1f4e79' };
});

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
          <nav aria-label="Breadcrumb" class="mb-6">
            <ol class="flex items-center justify-center gap-2 text-sm text-[var(--ink)]/60">
              <li>
                <a routerLink="/" class="hover:text-[var(--saffron-deep)] transition-colors"
                  >Home</a
                >
              </li>
              <li aria-hidden="true">/</li>
              <li aria-current="page" class="font-semibold text-[var(--ink)]">Services</li>
            </ol>
          </nav>
          <p class="font-mono text-[15px] tracking-widest text-[var(--saffron)] mb-4 uppercase">
            Our Practice Areas
          </p>
          <h1
            class="font-serif font-light text-[var(--ink)] text-4xl sm:text-5xl leading-[1.1] mb-5 text-balance"
          >
            Comprehensive <span class="whitespace-nowrap">Cross-Border</span> Solutions
            <em class="italic text-[var(--saffron)]">for NRIs</em>
          </h1>
          <p class="text-base sm:text-lg text-[var(--ink)]/70 leading-relaxed max-w-2xl mx-auto text-balance">
            Four practice areas backed by dedicated US relationship managers, empanelled
            subject-matter experts, fixed upfront pricing, and a secure real-time tracking portal.
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
                class="bb-svc-card group"
                [style.--card-accent]="s.accent"
                [attr.aria-label]="'Learn more about ' + s.title"
              >
                <!-- Coloured header band (shared with the homepage cards) -->
                <div class="bb-card-head">
                  <div class="bb-card-head-icon">
                    <i class="material-icons-outlined" aria-hidden="true">{{ s.icon }}</i>
                  </div>
                  <h2 class="bb-card-head-title">{{ s.title }}</h2>
                  <span class="bb-card-head-num" aria-hidden="true">{{
                    (i + 1).toString().padStart(2, '0')
                  }}</span>
                </div>

                <p class="text-sm text-[var(--ink)]/65 leading-relaxed mb-5">{{ s.tagline }}</p>

                <!-- Key offerings -->
                <ul class="flex flex-col gap-3 mb-6">
                  @for (o of s.offerings; track o.title) {
                    <li class="flex items-start gap-2 text-sm text-[var(--ink)]/75 leading-relaxed">
                      <i
                        class="material-icons-outlined text-base mt-[2px] shrink-0"
                        [style]="'color:' + s.accent"
                        aria-hidden="true"
                        >check_circle</i
                      >
                      <span
                        ><strong class="font-semibold text-[var(--ink)]">{{ o.title }}:</strong>
                        {{ o.desc }}</span
                      >
                    </li>
                  }
                </ul>

                <!-- CTA row -->
                <div class="flex items-center gap-1.5 text-sm font-bold bb-svc-cta-text mt-auto">
                  {{ s.ctaLabel }}
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
        <div class="max-w-3xl mx-auto">
          <p class="font-mono text-[15px] tracking-widest text-[var(--saffron)] mb-4 uppercase">
            Free Discovery Call
          </p>
          <h2
            class="font-serif font-light text-[var(--ivory)] text-3xl sm:text-4xl mb-5 leading-snug"
          >
            Not Sure Where to Start?
          </h2>
          <p class="text-base sm:text-lg text-[var(--ivory)]/70 mb-9 leading-relaxed text-balance">
            Schedule a free 30-minute consultation with a US-based relationship manager. We will
            review your situation, explain your options, and provide a transparent, itemized
            proposal before any work begins.
          </p>
          <div class="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
            <a routerLink="/" fragment="consultation" class="bb-cta-btn">
              Book a Free Discovery Call
              <i class="material-icons-outlined text-lg" aria-hidden="true">arrow_forward</i>
            </a>
            <a href="mailto:info@mybharatconnects.com" class="bb-cta-btn bb-cta-btn-alt">
              Contact US Support Team
            </a>
          </div>
        </div>
      </section>
    </main>

    <app-footer />
  `,
  styles: [
    `
      .bb-svc-card {
        --card-pad-x: 28px;
        --card-pad-y: 32px;
        position: relative;
        overflow: hidden;
        display: flex;
        flex-direction: column;
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
        border-color: color-mix(in srgb, var(--card-accent) 45%, transparent);
      }
      .bb-svc-card:hover .bb-card-head-icon {
        transform: scale(1.06);
      }
      .bb-svc-cta-text {
        color: var(--card-accent);
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
      .bb-cta-btn-alt {
        background: transparent;
        color: var(--ivory);
        border-color: rgba(247, 245, 240, 0.55);
      }
      .bb-cta-btn-alt:hover {
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
    title.setTitle('Our Services | MyBharatConnects');
    meta.updateTag({
      name: 'description',
      content:
        'Explore our four NRI service areas: Cross-Border Tax & Compliance, NRI Wealth & Investment Advisory, Property Management & Sales, and Legal & Estate Planning.',
    });
  }
}
