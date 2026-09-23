import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { NavbarComponent } from '../shared/navbar.component';
import { FooterComponent } from '../shared/footer.component';
import {
  ServiceVertical,
  SERVICE_VERTICALS,
  verticalBySlug,
} from '../../shared/data/service-catalog';

/**
 * Vertical page — lists every service offered under one of the four service
 * verticals, with delivery steps where the engagement follows a fixed
 * sequence. Content is fully driven by the shared service catalog.
 */
@Component({
  selector: 'app-service-detail',
  standalone: true,
  imports: [RouterLink, NavbarComponent, FooterComponent],
  template: `
    <app-navbar />

    @if (vertical; as v) {
      <main>
        <!-- ── Hero ── -->
        <section
          class="px-6 sm:px-8 lg:px-12 pt-14 pb-12"
          style="background: radial-gradient(ellipse 80% 55% at 50% -10%, rgba(31,78,121,0.1) 0%, transparent 60%), var(--ivory)"
        >
          <div class="max-w-4xl mx-auto text-center">
            <nav class="text-sm text-[var(--ink)]/50 mb-6" aria-label="Breadcrumb">
              <a routerLink="/services" class="hover:text-[var(--brand-navy)] transition"
                >Services</a
              >
              <span class="mx-2" aria-hidden="true">/</span>
              <span class="text-[var(--ink)]/80">{{ v.name }}</span>
            </nav>

            <div class="bb-vertical-icon mx-auto mb-6">
              <i class="material-icons-outlined" aria-hidden="true">{{ v.icon }}</i>
            </div>
            <h1
              class="font-serif font-light text-[var(--ink)] text-4xl sm:text-5xl leading-[1.1] mb-5"
            >
              {{ v.name }}
            </h1>
            <p class="text-base sm:text-lg text-[var(--ink)]/70 leading-relaxed max-w-2xl mx-auto">
              {{ v.blurb }}
            </p>
          </div>
        </section>

        <!-- ── Services in this vertical ── -->
        <section class="px-6 sm:px-8 lg:px-12 py-14" style="background: var(--ivory)">
          <div class="max-w-5xl mx-auto">
            <p class="font-mono text-[11px] tracking-widest text-[var(--saffron-deep)] mb-6 uppercase">
              Services in this vertical
            </p>

            <div class="flex flex-col gap-4">
              @for (s of v.services; track s.name; let i = $index) {
                <article class="bb-svc-row">
                  <div class="flex items-start gap-4">
                    <span class="bb-svc-row-num" aria-hidden="true">{{
                      (i + 1).toString().padStart(2, '0')
                    }}</span>
                    <div class="flex-1 min-w-0">
                      <h2 class="text-lg font-bold text-[var(--ink)] leading-snug">
                        {{ s.name }}
                      </h2>

                      @if (s.steps && s.steps.length > 0) {
                        <!-- Numbered because delivery genuinely follows this order -->
                        <ol class="bb-svc-steps mt-4">
                          @for (step of s.steps; track step; let si = $index) {
                            <li>
                              <span class="bb-svc-step-marker">{{ si + 1 }}</span>
                              <span>{{ step }}</span>
                            </li>
                          }
                        </ol>
                      }
                    </div>
                    <a
                      routerLink="/auth/register"
                      class="bb-svc-row-cta shrink-0 hidden sm:inline-flex"
                      [attr.aria-label]="'Get started with ' + s.name"
                    >
                      Get started
                      <i class="material-icons-outlined text-base" aria-hidden="true"
                        >arrow_forward</i
                      >
                    </a>
                  </div>
                </article>
              }
            </div>

            <!-- Other verticals -->
            <div class="mt-14 pt-8 border-t border-[var(--ink-12)]">
              <p class="text-sm font-semibold text-[var(--ink)]/60 uppercase tracking-wider mb-4">
                Explore other verticals
              </p>
              <div class="flex flex-wrap gap-3">
                @for (o of otherVerticals; track o.slug) {
                  <a [routerLink]="['/services', o.slug]" class="bb-vertical-chip">
                    <i class="material-icons-outlined text-base" aria-hidden="true">{{
                      o.icon
                    }}</i>
                    {{ o.name }}
                  </a>
                }
              </div>
            </div>
          </div>
        </section>

        <!-- ── CTA ── -->
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
              Talk to a {{ v.name }} specialist
            </h2>
            <p class="text-base text-[var(--ivory)]/65 mb-8 leading-relaxed">
              Book a free 30-minute discovery call — we'll scope your situation and recommend
              exactly the services you need, with transparent pricing before you commit.
            </p>
            <a routerLink="/auth/register" class="bb-cta-btn">
              Book Free Consultation
              <i class="material-icons-outlined text-lg" aria-hidden="true">arrow_forward</i>
            </a>
          </div>
        </section>
      </main>

      <app-footer />
    }
  `,
  styles: [
    `
      .bb-vertical-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 64px;
        height: 64px;
        border-radius: 18px;
        background: var(--navy-50);
        color: var(--brand-navy);
      }
      .bb-vertical-icon i {
        font-size: 32px;
      }

      .bb-svc-row {
        background: #ffffff;
        border: 1px solid rgba(22, 40, 60, 0.08);
        border-radius: 10px;
        padding: 22px 24px;
        transition:
          box-shadow 0.2s ease,
          border-color 0.2s ease,
          transform 0.2s ease;
      }
      .bb-svc-row:hover {
        border-color: rgba(31, 78, 121, 0.3);
        box-shadow: 0 10px 30px rgba(12, 33, 53, 0.08);
        transform: translateY(-2px);
      }
      .bb-svc-row-num {
        font-family: 'Plus Jakarta Sans', sans-serif;
        font-size: 1.375rem;
        color: var(--saffron);
        line-height: 1.4;
        min-width: 2rem;
      }
      .bb-svc-row-cta {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 0.875rem;
        font-weight: 700;
        color: var(--brand-navy);
        padding: 8px 14px;
        border-radius: 8px;
        transition:
          background 0.15s ease,
          color 0.15s ease;
      }
      .bb-svc-row-cta:hover {
        background: var(--navy-50);
      }

      .bb-svc-steps {
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .bb-svc-steps li {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        font-size: 0.9375rem;
        color: rgba(22, 40, 60, 0.78);
        line-height: 1.5;
      }
      .bb-svc-step-marker {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 1.5rem;
        height: 1.5rem;
        border-radius: 9999px;
        background: var(--navy-50);
        color: var(--brand-navy);
        font-size: 0.75rem;
        font-weight: 700;
        flex-shrink: 0;
        margin-top: 1px;
      }

      .bb-vertical-chip {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 10px 16px;
        background: #ffffff;
        border: 1px solid rgba(22, 40, 60, 0.12);
        border-radius: 9999px;
        font-size: 0.875rem;
        font-weight: 600;
        color: var(--ink);
        transition:
          border-color 0.15s ease,
          background 0.15s ease,
          color 0.15s ease;
      }
      .bb-vertical-chip:hover {
        border-color: var(--brand-navy);
        background: var(--navy-50);
        color: var(--brand-navy);
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
export class ServiceDetailComponent implements OnInit {
  vertical: ServiceVertical | null = null;
  otherVerticals: ServiceVertical[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private titleSvc: Title,
    private meta: Meta,
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const slug = params.get('slug') ?? '';
      const v = verticalBySlug(slug);
      if (!v) {
        this.router.navigate(['/services']);
        return;
      }
      this.vertical = v;
      this.otherVerticals = SERVICE_VERTICALS.filter((o) => o.slug !== v.slug);
      this.titleSvc.setTitle(`${v.name} — MyBharatConnects`);
      this.meta.updateTag({
        name: 'description',
        content: `${v.name} services for NRIs: ${v.services
          .slice(0, 4)
          .map((s) => s.name)
          .join(', ')} and more — handled end-to-end by MyBharatConnects.`,
      });
    });
  }
}
