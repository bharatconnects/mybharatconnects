import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { NavbarComponent } from '../shared/navbar.component';
import { FooterComponent } from '../shared/footer.component';
import { ScrollRevealDirective } from '../../shared/directives/scroll-reveal.directive';

interface Offer {
  icon: string;
  title: string;
  desc: string;
}

interface Founder {
  photo: string;
  name: string;
  role: string;
  bio: string;
  quote: string;
}

const FOUNDERS: Founder[] = [
  {
    photo: '/founder-atul-jain.jpg',
    name: 'Atul Jain',
    role: 'Co-Founder — US Operations & Client Experience',
    bio: 'Atul brings more than 25 years of professional and leadership experience across the United States, India, and global organizations, with a focus on complex business operations, compliance, and delivering outcomes across large, geographically distributed teams. At My Bharat Connects, he leads US-facing operations and client experience — accountability, transparency, and execution at every step. His role is not simply to connect clients with a service provider; it is to make sure the connection works.',
    quote: 'When someone trusts you with something important, you own the outcome.',
  },
  {
    photo: '/founder-reshu-jain.jpg',
    name: 'Reshu Jain',
    role: 'Co-Founder — Real Estate, Community Services & Educator',
    bio: 'Reshu brings more than 20 years of experience in education, alongside professional experience as a Realtor, Notary Public, and real estate developer in North Carolina — a career built around people, families, property, and the trust that comes with helping others navigate important decisions. Her background gives My Bharat Connects a practical understanding of what NRIs face when managing property, documents, and family matters from abroad.',
    quote: 'Behind every request is a person, a family, and something that matters to them.',
  },
];

const OFFERS: Offer[] = [
  {
    icon: 'verified_user',
    title: 'Verified professionals only',
    desc: 'Every Chartered Accountant, lawyer, property manager, and specialist on our platform is credential-verified and reference-checked before they ever handle a client engagement.',
  },
  {
    icon: 'support_agent',
    title: 'Managed, not just matched',
    desc: 'A dedicated relationship manager owns your file end-to-end. You are never handed off, never left chasing for updates.',
  },
  {
    icon: 'visibility',
    title: 'Transparent by design',
    desc: 'Our CRM-driven workflow keeps you informed at every stage — what is happening, who is doing it, what is next — so you’re in the loop with each step.',
  },
  {
    icon: 'public',
    title: 'Global framework, local execution',
    desc: 'Legal compliance, taxation, real estate, and documentation services delivered with the discipline of a global firm and the familiarity of home.',
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
        <div class="max-w-3xl mx-auto text-center">
          <p appReveal class="font-mono text-[11px] tracking-widest text-[var(--saffron-deep)] mb-4 uppercase">
            About My Bharat Connects
          </p>
          <h1
            appReveal
            [revealDelay]="80"
            class="font-serif font-light text-[var(--ink)] text-4xl sm:text-5xl leading-[1.1] mb-6"
          >
            Built by NRIs.<br />
            <em class="italic text-[var(--saffron)]">Designed for NRIs.</em>
          </h1>
          <p appReveal [revealDelay]="160" class="text-base sm:text-lg text-[var(--ink)]/75 leading-relaxed">
            Every NRI knows the moment. The parent who needs a document signed and it can't wait.
            The property that has sat quiet for a year and something feels wrong. The tax notice
            from India that arrives in your inbox on a Tuesday morning in New Jersey — and
            suddenly you are twelve time zones and one anxious phone call away from a solution.
          </p>
        </div>
      </section>

      <!-- Story -->
      <section class="px-6 sm:px-8 lg:px-12 py-14 sm:py-16" style="background: var(--ivory)">
        <div class="max-w-3xl mx-auto flex flex-col gap-6">
          <p appReveal class="font-serif text-xl sm:text-2xl font-light text-[var(--ink)] leading-snug">
            So, we built the bridge ourselves.
          </p>
          <p appReveal class="text-base text-[var(--ink)]/75 leading-relaxed">
            My Bharat Connects was founded in 2026 by a team of NRIs based in the US who lived
            those same challenges — managing important matters in India while being thousands of
            miles away.
          </p>
          <p appReveal class="text-base text-[var(--ink)]/75 leading-relaxed">
            We operate from the United States, close to the clients we serve. Every relationship
            begins here, is managed here, and stays accountable here. When you call us, you reach
            a team in your time zone who knows your file, remembers your last conversation, and
            will not hand you off to a stranger.
          </p>
          <p appReveal class="text-base text-[var(--ink)]/75 leading-relaxed">
            Behind the platform is a leadership team with over 25 years of combined experience in
            managing legal compliance and real estate within a global framework — the same kind of
            complex, cross-border matters our clients bring to us. Having that understanding and
            experience shapes everything we do, from how we vet professionals to how we manage
            each engagement.
          </p>
          <p appReveal class="text-base text-[var(--ink)]/75 leading-relaxed">
            Our mission is to give NRIs based in the US a single, trusted platform that connects
            them with verified professionals and managed services across India. Instead of leaving
            you to coordinate with multiple providers, we manage every engagement through a
            dedicated relationship team: one point of contact, transparent communication, and full
            accountability.
          </p>
        </div>
      </section>

      <!-- Leadership -->
      <section class="px-6 sm:px-8 lg:px-12 py-16 sm:py-20" style="background: var(--ivory)">
        <div class="max-w-5xl mx-auto">
          <header appReveal class="text-center mb-12 max-w-xl mx-auto">
            <p class="font-mono text-[11px] tracking-[0.22em] text-[var(--saffron-deep)] mb-4">
              LEADERSHIP
            </p>
            <h2 class="font-serif text-3xl sm:text-4xl font-light text-[var(--ink)] leading-[1.15]">
              Who's behind My Bharat Connects
            </h2>
          </header>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
            @for (f of founders; track f.name; let i = $index) {
              <div class="bb-founder-card" appReveal [revealDelay]="i * 90">
                <img [src]="f.photo" [alt]="f.name" class="bb-founder-photo" />
                <h3 class="font-semibold text-[var(--ink)] text-lg mt-5 mb-1">{{ f.name }}</h3>
                <p class="text-xs font-medium text-[var(--saffron-deep)] uppercase tracking-wide mb-4">
                  {{ f.role }}
                </p>
                <p class="text-sm text-[var(--ink)]/70 leading-relaxed mb-4">{{ f.bio }}</p>
                <p class="font-serif italic text-[var(--ink)]/85 text-[15px] leading-snug">
                  "{{ f.quote }}"
                </p>
              </div>
            }
          </div>
        </div>
      </section>

      <!-- What we offer -->
      <section class="px-6 sm:px-8 lg:px-12 py-16 sm:py-20" style="background: var(--ivory-soft)">
        <div class="max-w-5xl mx-auto">
          <header appReveal class="text-center mb-12 max-w-xl mx-auto">
            <p class="font-mono text-[11px] tracking-[0.22em] text-[var(--saffron-deep)] mb-4">
              WHAT WE OFFER
            </p>
            <h2 class="font-serif text-3xl sm:text-4xl font-light text-[var(--ink)] leading-[1.15]">
              How we work
            </h2>
          </header>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
            @for (o of offers; track o.title; let i = $index) {
              <div class="bb-offer-card" appReveal [revealDelay]="i * 90">
                <div class="bb-offer-icon">
                  <i class="material-icons-outlined" aria-hidden="true">{{ o.icon }}</i>
                </div>
                <h3 class="font-semibold text-[var(--ink)] text-lg mb-2">{{ o.title }}</h3>
                <p class="text-sm text-[var(--ink)]/70 leading-relaxed">{{ o.desc }}</p>
              </div>
            }
          </div>
        </div>
      </section>

      <!-- Closing + CTA -->
      <section
        class="px-6 sm:px-8 lg:px-12 py-16 sm:py-20 text-center"
        style="background: var(--ink)"
      >
        <div class="max-w-2xl mx-auto">
          <p appReveal class="text-lg sm:text-xl text-[var(--ivory)]/90 leading-relaxed mb-8 font-serif font-light">
            At My Bharat Connects, we stand beside you — in your time zone, in your language — and
            make sure India feels close again.
          </p>
          <p class="font-mono text-[11px] tracking-[0.22em] text-[var(--saffron)] mb-4 uppercase">
            Ready to talk?
          </p>
          <h2 class="font-serif text-2xl sm:text-3xl font-light text-[var(--ivory)] mb-8 leading-snug">
            Book a free consultation with our US team.
          </h2>
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

      .bb-founder-card {
        background: #ffffff;
        border: 1px solid rgba(22, 40, 60, 0.08);
        border-radius: 12px;
        padding: 28px 26px 30px;
        transition:
          transform 0.2s ease,
          box-shadow 0.2s ease;
      }
      .bb-founder-card:hover {
        transform: translateY(-3px);
        box-shadow: 0 12px 28px rgba(12, 33, 53, 0.09);
      }
      .bb-founder-photo {
        width: 100px;
        height: 100px;
        border-radius: 50%;
        object-fit: cover;
        border: 3px solid var(--ivory-soft);
        box-shadow: 0 2px 8px rgba(12, 33, 53, 0.12);
      }

      .bb-cta-btn {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 13px 28px;
        background: var(--saffron);
        color: var(--navy-900);
        font-family: 'Inter', sans-serif;
        font-size: 15px;
        font-weight: 700;
        letter-spacing: 0.01em;
        border: 2px solid var(--saffron);
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
    `,
  ],
})
export class AboutComponent implements OnInit {
  readonly offers = OFFERS;
  readonly founders = FOUNDERS;

  constructor(
    private title: Title,
    private meta: Meta,
  ) {}

  ngOnInit(): void {
    this.title.setTitle('About Us — MyBharatConnects');
    this.meta.updateTag({
      name: 'description',
      content:
        'My Bharat Connects was founded by NRIs, for NRIs — a US-based team managing tax, wealth, real estate, and legal matters in India through verified professionals and dedicated relationship managers.',
    });
  }
}
