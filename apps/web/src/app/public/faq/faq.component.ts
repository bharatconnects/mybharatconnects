import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { NavbarComponent } from '../shared/navbar.component';
import { FooterComponent } from '../shared/footer.component';
import { ScrollRevealDirective } from '../../shared/directives/scroll-reveal.directive';

interface Faq {
  q: string;
  a: string;
}

const FAQS: Faq[] = [
  {
    q: 'Who is My Bharat Connects for?',
    a: 'We work with NRIs based in the US who need to manage tax, wealth, real estate, or legal matters in India without being there in person.',
  },
  {
    q: 'What services do you offer?',
    a: 'Four service areas: Tax & Compliance, Wealth Management, Real Estate, and Legal Documents. Each one is handled end-to-end by verified professionals, coordinated by your dedicated advisor.',
  },
  {
    q: 'What happens on the discovery call?',
    a: 'It is a free 30-minute call. We scope your situation, recommend exactly the services you need, and give you transparent pricing before you commit to anything.',
  },
  {
    q: 'How soon will someone get back to me?',
    a: 'A member of our team will reach out within one business day of your request to schedule your consultation.',
  },
  {
    q: 'Who will handle my case?',
    a: 'A dedicated relationship manager owns your file from enquiry through settlement. You are never handed off, and they coordinate every specialist on your behalf, so you have one point of contact.',
  },
  {
    q: 'Are the professionals you work with verified?',
    a: 'Yes. Every Chartered Accountant, lawyer, property manager, and specialist on our platform is credential-verified and reference-checked before they handle a client engagement.',
  },
  {
    q: 'Can I see what is happening on my case?',
    a: 'Yes. You track your case end-to-end on one dashboard: quotes, milestones, and progress at every stage. Nothing moves forward without your approval.',
  },
  {
    q: 'How does pricing work?',
    a: 'You see every quote and milestone before you commit, so there are no surprise invoices.',
  },
  {
    q: 'Which time zone do you operate in?',
    a: 'We operate from the United States, so you reach a team in your time zone who knows your file and remembers your last conversation.',
  },
];

@Component({
  selector: 'app-faq',
  standalone: true,
  imports: [RouterLink, NavbarComponent, FooterComponent, ScrollRevealDirective],
  template: `
    <app-navbar />

    <main>
      <section
        class="px-6 sm:px-8 lg:px-12 pt-14 pb-10"
        style="background: radial-gradient(ellipse 80% 55% at 50% -10%, rgba(31,78,121,0.1) 0%, transparent 60%), var(--ivory)"
      >
        <div class="max-w-3xl mx-auto text-center">
          <p appReveal class="font-mono text-[15px] tracking-widest text-[var(--saffron-deep)] mb-4 uppercase">
            FAQ
          </p>
          <h1
            appReveal
            [revealDelay]="80"
            class="font-serif font-light text-[var(--ink)] text-4xl sm:text-5xl leading-[1.1] mb-6"
          >
            Questions,
            <em class="italic text-[var(--saffron)]">answered.</em>
          </h1>
          <p appReveal [revealDelay]="160" class="text-base sm:text-lg text-[var(--ink)]/75 leading-relaxed">
            Everything NRIs ask us before getting started. Can't find yours? Book a discovery call
            and we'll answer it directly.
          </p>
        </div>
      </section>

      <section class="px-6 sm:px-8 lg:px-12 pb-16 sm:pb-20" style="background: var(--ivory)">
        <div class="max-w-3xl mx-auto flex flex-col gap-3">
          @for (f of faqs; track f.q; let i = $index) {
            <details class="bb-faq-item" appReveal [revealDelay]="i * 40">
              <summary class="bb-faq-q">{{ f.q }}</summary>
              <p class="bb-faq-a">{{ f.a }}</p>
            </details>
          }
        </div>
      </section>

      <section class="px-6 sm:px-8 lg:px-12 py-16 sm:py-20 text-center" style="background: var(--ink)">
        <div class="max-w-2xl mx-auto">
          <p class="font-mono text-[15px] tracking-[0.22em] text-[var(--saffron)] mb-4 uppercase">
            Still have questions?
          </p>
          <h2 class="font-serif text-2xl sm:text-3xl font-light text-[var(--ivory)] mb-8 leading-snug">
            Talk to our US team.
          </h2>
          <a routerLink="/" fragment="consultation" class="bb-cta-btn">
            Book Discovery Call
            <i class="material-icons-outlined text-lg" aria-hidden="true">arrow_forward</i>
          </a>
        </div>
      </section>
    </main>

    <app-footer />
  `,
  styles: [
    `
      .bb-faq-item {
        background: #ffffff;
        border: 1px solid rgba(22, 40, 60, 0.08);
        border-radius: 10px;
        transition: box-shadow 0.2s ease;
      }
      .bb-faq-item:hover,
      .bb-faq-item[open] {
        box-shadow: 0 10px 24px rgba(12, 33, 53, 0.08);
      }
      .bb-faq-q {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 20px 24px;
        cursor: pointer;
        list-style: none;
        font-size: 17px;
        font-weight: 600;
        color: var(--ink);
      }
      .bb-faq-q::-webkit-details-marker {
        display: none;
      }
      .bb-faq-q::after {
        content: '+';
        flex-shrink: 0;
        font-size: 24px;
        font-weight: 400;
        line-height: 1;
        color: var(--saffron-deep);
        transition: transform 0.2s ease;
      }
      .bb-faq-item[open] .bb-faq-q::after {
        transform: rotate(45deg);
      }
      .bb-faq-q:focus-visible {
        outline: 2px solid var(--brand-navy);
        outline-offset: -2px;
        border-radius: 10px;
      }
      .bb-faq-a {
        padding: 0 24px 22px;
        font-size: 16px;
        line-height: 1.7;
        color: rgba(22, 40, 60, 0.75);
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
export class FaqComponent implements OnInit {
  readonly faqs = FAQS;

  constructor(
    private title: Title,
    private meta: Meta,
  ) {}

  ngOnInit(): void {
    this.title.setTitle('FAQ | MyBharatConnects');
    this.meta.updateTag({
      name: 'description',
      content:
        'Answers to common questions from NRIs about our services, the free discovery call, pricing, response times, and how your case is handled.',
    });
  }
}
