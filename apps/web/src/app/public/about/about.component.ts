import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { NavbarComponent } from '../shared/navbar.component';
import { FooterComponent } from '../shared/footer.component';
import { ScrollRevealDirective } from '../../shared/directives/scroll-reveal.directive';

interface StoryBlock {
  heading: string;
  body: string;
}

interface Pillar {
  icon: string;
  title: string;
  desc: string;
}

const STORY: StoryBlock[] = [
  {
    heading: 'The NRI Reality',
    body: 'Every NRI knows the moment. A parent in India needs an urgent document signed. A family property sits quiet for months while uncertainty builds. Or an unexpected tax notice from India arrives in your inbox on a Tuesday morning in New Jersey, leaving you twelve time zones and one anxious phone call away from a solution.',
  },
  {
    heading: 'Why We Built the Bridge',
    body: 'MyBharatConnects was founded by US-based NRIs who lived those exact challenges. We operate directly from the United States to ensure every engagement begins here, is managed here, and stays fully accountable in your time zone. When you reach out, you speak with a team that knows your file and stays with you from inquiry to final resolution.',
  },
  {
    heading: 'Our Mission',
    body: 'To provide US-based NRIs with a single, trusted platform for managed tax, legal, and real estate services in India, combining verified local execution with seamless US-based relationship management.',
  },
];

const PILLARS: Pillar[] = [
  {
    icon: 'verified_user',
    title: 'Thoroughly Verified Specialists',
    desc: 'Every Chartered Accountant, advocate, property manager, and consultant on our panel is credential-verified and reference-checked before taking on client files.',
  },
  {
    icon: 'support_agent',
    title: 'Fully Managed, Never Just Matched',
    desc: 'You are assigned a dedicated relationship manager who owns your file end-to-end. No hand-offs, no chasing multiple vendors, and no unreturned messages.',
  },
  {
    icon: 'visibility',
    title: 'Transparent CRM Tracking',
    desc: 'Monitor real-time progress through our digital portal. View document updates, active milestones, and next steps with complete clarity.',
  },
  {
    icon: 'public',
    title: 'Global Governance, Local Execution',
    desc: 'We deliver cross-border tax, legal, and property solutions with the institutional discipline of a global firm and the care of a trusted neighbor.',
  },
];

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [RouterLink, NavbarComponent, FooterComponent, ScrollRevealDirective],
  template: `
    <app-navbar />

    <main>
      <!-- Hero -->
      <section
        class="px-6 sm:px-8 lg:px-12 pt-14 pb-12"
        style="background: radial-gradient(ellipse 80% 55% at 50% -10%, rgba(31,78,121,0.1) 0%, transparent 60%), var(--ivory)"
      >
        <div class="max-w-5xl mx-auto text-center">
          <p appReveal class="font-mono text-[15px] tracking-widest text-[var(--saffron-deep)] mb-4 uppercase">
            Our Story &amp; Mission
          </p>
          <h1
            appReveal
            [revealDelay]="80"
            class="font-serif font-light text-[var(--ink)] text-4xl sm:text-5xl leading-[1.15]"
          >
            <span class="block text-balance">Built by NRIs. Designed for NRIs,</span>
            <em class="block text-balance italic text-[var(--saffron)]"
              >Operated in the US. Accountable to You.</em
            >
          </h1>
        </div>
      </section>

      <!-- Story -->
      <section class="px-6 sm:px-8 lg:px-12 py-12 sm:py-16" style="background: var(--ivory)">
        <div class="max-w-3xl mx-auto flex flex-col gap-10">
          @for (b of story; track b.heading; let i = $index) {
            <div appReveal [revealDelay]="i * 80">
              <h2 class="font-serif text-2xl sm:text-3xl font-light text-[var(--ink)] leading-snug mb-3">
                {{ b.heading }}
              </h2>
              <p class="text-base sm:text-[17px] text-[var(--ink)]/75 leading-relaxed">{{ b.body }}</p>
            </div>
          }
        </div>
      </section>

      <!-- Leadership -->
      <section class="px-6 sm:px-8 lg:px-12 py-16 sm:py-20" style="background: var(--ivory-soft)">
        <div class="max-w-3xl mx-auto">
          <header appReveal class="text-center mb-10">
            <p class="font-mono text-[15px] tracking-[0.22em] text-[var(--saffron-deep)] mb-4 uppercase">
              Leadership &amp; Governance
            </p>
            <h2 class="font-serif text-3xl sm:text-4xl font-light text-[var(--ink)] leading-[1.15]">
              Who's Behind MyBharatConnects
            </h2>
          </header>

          <div class="flex flex-col gap-5">
            <p appReveal class="text-base sm:text-[17px] text-[var(--ink)]/75 leading-relaxed">
              Behind My Bharat Connects is an executive team with over 25 years of combined
              experience spanning legal compliance, real estate management, corporate operations,
              and client advocacy across the United States and India.
            </p>
            <p appReveal [revealDelay]="80" class="text-base sm:text-[17px] text-[var(--ink)]/75 leading-relaxed">
              Having managed complex international portfolios and family matters firsthand, our
              leadership team understands the operational precision and empathy required to handle
              affairs from afar. We don't just connect you with specialists; we manage every
              engagement from start to finish to guarantee results.
            </p>
          </div>

          <blockquote appReveal [revealDelay]="160" class="bb-quote">
            "Behind every request is a person, a family, and something that matters to them. When
            you trust us with your affairs, we own the outcome."
          </blockquote>
        </div>
      </section>

      <!-- Team photo -->
      <section class="px-6 sm:px-8 lg:px-12 pt-4 pb-4 sm:pb-6" style="background: var(--ivory)">
        <figure appReveal class="bb-team-photo max-w-3xl mx-auto">
          <img
            src="/about-office.jpg"
            width="1408"
            height="768"
            loading="lazy"
            alt="A family meeting with advisors in a bright India office, reviewing a financial plan together"
          />
        </figure>
      </section>

      <!-- Advantage -->
      <section class="px-6 sm:px-8 lg:px-12 py-16 sm:py-20" style="background: var(--ivory)">
        <div class="max-w-5xl mx-auto">
          <header appReveal class="text-center mb-12 max-w-3xl mx-auto">
            <p class="font-mono text-[15px] tracking-[0.22em] text-[var(--saffron-deep)] mb-4 uppercase">
              The MyBharatConnects Advantage
            </p>
            <h2 class="font-serif text-3xl sm:text-4xl font-light text-[var(--ink)] leading-[1.15] text-balance">
              How We Deliver Complete Peace of Mind
            </h2>
          </header>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
            @for (p of pillars; track p.title; let i = $index) {
              <div class="bb-offer-card" appReveal [revealDelay]="i * 90">
                <div class="bb-offer-icon">
                  <i class="material-icons-outlined" aria-hidden="true">{{ p.icon }}</i>
                </div>
                <h3 class="font-semibold text-[var(--ink)] text-lg mb-2">{{ p.title }}</h3>
                <p class="text-sm text-[var(--ink)]/70 leading-relaxed">{{ p.desc }}</p>
              </div>
            }
          </div>
        </div>
      </section>

      <!-- Closing + CTA -->
      <section
        class="px-6 sm:px-8 lg:px-12 py-16 sm:py-20 text-center"
        style="background: linear-gradient(135deg, var(--saffron) 0%, var(--saffron-hover) 100%)"
      >
        <div class="max-w-2xl mx-auto">
          <h2 appReveal class="font-serif text-3xl sm:text-4xl font-light text-white mb-5 leading-snug">
            Making India Feel Close Again
          </h2>
          <p appReveal [revealDelay]="80" class="text-base sm:text-lg text-white/95 leading-relaxed mb-9">
            We stand beside you in your time zone, on your schedule, so you can manage your assets
            in India with absolute confidence.
          </p>
          <div class="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
            <a routerLink="/" fragment="consultation" class="bb-cta-btn">
              Schedule a Free US Strategy Call
              <i class="material-icons-outlined text-lg" aria-hidden="true">arrow_forward</i>
            </a>
            <a routerLink="/services" class="bb-cta-btn bb-cta-btn-alt">Explore Our Practice Areas</a>
          </div>
        </div>
      </section>
    </main>

    <app-footer />
  `,
  styles: [
    `
      .bb-offer-card {
        background: #ffffff;
        border: 1px solid rgba(22, 40, 60, 0.08);
        border-radius: 10px;
        padding: 26px 24px;
        transition:
          transform 0.2s ease,
          box-shadow 0.2s ease;
      }
      .bb-offer-card:hover {
        transform: translateY(-3px);
        box-shadow: 0 12px 28px rgba(12, 33, 53, 0.09);
      }
      .bb-offer-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 48px;
        height: 48px;
        border-radius: 12px;
        background: var(--navy-50);
        color: var(--brand-navy);
        margin-bottom: 16px;
      }
      .bb-offer-icon i {
        font-size: 24px;
      }

      .bb-team-photo {
        margin-inline: auto;
        overflow: hidden;
        border-radius: 24px;
      }
      .bb-team-photo img {
        display: block;
        width: 100%;
        height: auto;
      }

      .bb-quote {
        margin: 40px 0 0;
        padding: 6px 0 6px 22px;
        border-left: 3px solid var(--saffron);
        font-family: 'Fraunces', Georgia, serif;
        font-style: italic;
        font-size: 1.25rem;
        line-height: 1.5;
        color: var(--ink);
      }

      .bb-cta-btn {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 13px 28px;
        background: var(--ink);
        color: var(--ivory);
        font-family: 'Inter', sans-serif;
        font-size: 15px;
        font-weight: 700;
        letter-spacing: 0.01em;
        border: 2px solid var(--ink);
        border-radius: 8px;
        text-decoration: none;
        transition:
          background-color 0.15s ease,
          color 0.15s ease,
          border-color 0.15s ease;
      }
      .bb-cta-btn:hover {
        background: var(--ivory);
        color: var(--ink);
        border-color: var(--ivory);
      }
      .bb-cta-btn-alt {
        background: transparent;
        color: #ffffff;
        border-color: #ffffff;
      }
      .bb-cta-btn-alt:hover {
        background: var(--ivory);
        color: var(--ink);
        border-color: var(--ivory);
      }
    `,
  ],
})
export class AboutComponent implements OnInit {
  readonly story = STORY;
  readonly pillars = PILLARS;

  constructor(
    private title: Title,
    private meta: Meta,
  ) {}

  ngOnInit(): void {
    this.title.setTitle('About Us | MyBharatConnects');
    this.meta.updateTag({
      name: 'description',
      content:
        'MyBharatConnects was founded by US-based NRIs who lived these challenges. We operate from the United States, giving NRIs a single trusted platform for managed tax, legal, and real estate services in India.',
    });
  }
}
