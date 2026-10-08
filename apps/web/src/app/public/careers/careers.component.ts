import { Component, OnInit } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';
import { NavbarComponent } from '../shared/navbar.component';
import { FooterComponent } from '../shared/footer.component';
import { ScrollRevealDirective } from '../../shared/directives/scroll-reveal.directive';

interface Value {
  icon: string;
  title: string;
  desc: string;
}

const VALUES: Value[] = [
  {
    icon: 'verified_user',
    title: 'Accountability',
    desc: 'When someone trusts you with something important, you own the outcome.',
  },
  {
    icon: 'visibility',
    title: 'Transparency',
    desc: 'Clients see what is happening, who is doing it, and what is next at every stage.',
  },
  {
    icon: 'task_alt',
    title: 'Execution',
    desc: 'We do not just connect people with providers. We make sure the connection works.',
  },
];

@Component({
  selector: 'app-careers',
  standalone: true,
  imports: [NavbarComponent, FooterComponent, ScrollRevealDirective],
  template: `
    <app-navbar />

    <main>
      <section
        class="px-6 sm:px-8 lg:px-12 pt-14 pb-12"
        style="background: radial-gradient(ellipse 80% 55% at 50% -10%, rgba(31,78,121,0.1) 0%, transparent 60%), var(--ivory)"
      >
        <div class="max-w-3xl mx-auto text-center">
          <p appReveal class="font-mono text-[15px] tracking-widest text-[var(--saffron-deep)] mb-4 uppercase">
            Careers
          </p>
          <h1
            appReveal
            [revealDelay]="80"
            class="font-serif font-light text-[var(--ink)] text-4xl sm:text-5xl leading-[1.1] mb-6"
          >
            Help us bring India
            <em class="italic text-[var(--saffron)]">closer.</em>
          </h1>
          <p appReveal [revealDelay]="160" class="text-base sm:text-lg text-[var(--ink)]/75 leading-relaxed">
            My Bharat Connects was founded in 2026 by NRIs, for NRIs. We are building a managed
            platform that makes handling matters in India feel close, whatever time zone you are in.
          </p>
        </div>
      </section>

      <section class="px-6 sm:px-8 lg:px-12 py-14 sm:py-16" style="background: var(--ivory-soft)">
        <div class="max-w-5xl mx-auto">
          <header appReveal class="text-center mb-10 max-w-xl mx-auto">
            <p class="font-mono text-[15px] tracking-[0.22em] text-[var(--saffron-deep)] mb-4">
              HOW WE WORK
            </p>
            <h2 class="font-serif text-3xl sm:text-4xl font-light text-[var(--ink)] leading-[1.15]">
              What we care about
            </h2>
          </header>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-5 sm:gap-6">
            @for (v of values; track v.title; let i = $index) {
              <div class="bb-value-card" appReveal [revealDelay]="i * 90">
                <div class="bb-value-icon">
                  <i class="material-icons-outlined" aria-hidden="true">{{ v.icon }}</i>
                </div>
                <h3 class="font-semibold text-[var(--ink)] text-lg mb-2">{{ v.title }}</h3>
                <p class="text-sm text-[var(--ink)]/70 leading-relaxed">{{ v.desc }}</p>
              </div>
            }
          </div>
        </div>
      </section>

      <section class="px-6 sm:px-8 lg:px-12 py-16 sm:py-20 text-center" style="background: var(--ink)">
        <div class="max-w-2xl mx-auto">
          <p class="font-mono text-[15px] tracking-[0.22em] text-[var(--saffron)] mb-4 uppercase">
            Open roles
          </p>
          <h2 class="font-serif text-2xl sm:text-3xl font-light text-[var(--ivory)] mb-4 leading-snug">
            No roles are listed right now.
          </h2>
          <p class="text-base text-[var(--ivory)]/75 leading-relaxed mb-8">
            If you would like to work with us, email your CV and a few lines on how you could help
            to the address below.
          </p>
          <a href="mailto:info@mybharatconnects.com?subject=Careers%20at%20MyBharatConnects" class="bb-cta-btn">
            info&#64;mybharatconnects.com
            <i class="material-icons-outlined text-lg" aria-hidden="true">arrow_forward</i>
          </a>
        </div>
      </section>
    </main>

    <app-footer />
  `,
  styles: [
    `
      .bb-value-card {
        background: #ffffff;
        border: 1px solid rgba(22, 40, 60, 0.08);
        border-radius: 10px;
        padding: 26px 24px;
        transition:
          transform 0.2s ease,
          box-shadow 0.2s ease;
      }
      .bb-value-card:hover {
        transform: translateY(-3px);
        box-shadow: 0 12px 28px rgba(12, 33, 53, 0.09);
      }
      .bb-value-icon {
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
      .bb-value-icon i {
        font-size: 24px;
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
export class CareersComponent implements OnInit {
  readonly values = VALUES;

  constructor(
    private title: Title,
    private meta: Meta,
  ) {}

  ngOnInit(): void {
    this.title.setTitle('Careers | MyBharatConnects');
    this.meta.updateTag({
      name: 'description',
      content:
        'Careers at My Bharat Connects, a US-based team building a managed platform for NRIs. Send us your CV.',
    });
  }
}
