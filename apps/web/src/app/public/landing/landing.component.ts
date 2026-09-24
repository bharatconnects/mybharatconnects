import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Title, Meta } from '@angular/platform-browser';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { RecaptchaService } from '../../core/services/recaptcha.service';
import { NavbarComponent } from '../shared/navbar.component';
import { FooterComponent } from '../shared/footer.component';
import { PhoneInputComponent } from '../../shared/components/phone-input/phone-input.component';
import { ScrollRevealDirective } from '../../shared/directives/scroll-reveal.directive';
import { CountUpDirective } from '../../shared/directives/count-up.directive';
import { SERVICE_VERTICALS } from '../../shared/data/service-catalog';
import {
  OTHER_SERVICE_VALUE,
  COUNTRY_OPTIONS,
  INTENT_OPTIONS,
  timezonesForCountry,
  SelectOption,
} from '../../shared/data/lead-form-options';

interface PublicTestimonial {
  _id: string;
  clientName: string;
  clientCountry?: string;
  content: string;
  serviceType?: string;
  ratingId?: { starRating?: number };
}

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [
    RouterLink,
    FormsModule,
    NavbarComponent,
    FooterComponent,
    PhoneInputComponent,
    ScrollRevealDirective,
    CountUpDirective,
  ],
  template: `
    <!-- Ticker -->
    <div
      class="bg-[var(--ivory-mute)] text-[var(--ink)] overflow-hidden whitespace-nowrap py-2 text-[11px] font-medium tracking-[0.14em] uppercase"
    >
      <div class="inline-block bb-ticker-track">
        @for (v of verticals; track v.slug) {
          <span class="bb-ticker-span">
            <a [routerLink]="['/services', v.slug]" class="bb-ticker-link">{{ v.name }}</a>
            &nbsp;·&nbsp;
          </span>
        }
        <!-- 7 more aria-hidden copies (8 total). For a seamless loop the
             track must stay wider than the viewport at every point of the
             scroll, i.e. (copies-1) * oneCopyWidth >= viewport width; with
             4 short items per copy (~600px), fewer copies visibly ran out
             of content on wide desktop screens before looping. 8 copies
             covers viewports up to ~4200px. -->
        @for (copy of [1, 2, 3, 4, 5, 6, 7]; track copy) {
          <span class="bb-ticker-span" aria-hidden="true">
            @for (v of verticals; track v.slug) {
              <a [routerLink]="['/services', v.slug]" class="bb-ticker-link" tabindex="-1">{{
                v.name
              }}</a>
              &nbsp;·&nbsp;
            }
          </span>
        }
      </div>
    </div>

    <app-navbar [immersive]="true" />

    <main>
      <!-- ══ HERO ══
           One continuous full-bleed photo panel running behind the navbar
           above AND the hero content below — no card, no frame, no inset
           margins. The negative top margin pulls the panel's background up
           underneath the transparent sticky navbar so there's no seam
           between the two; the navbar's own (separate) scroll listener
           still solidifies it once the page scrolls, which is the entire
           "premium scroll" effect now that the hero itself is static.
           The photo carries a real image when one is supplied (drop
           apps/web/public/hero.png) and falls back to the wheel motif on a
           navy field otherwise — deliberate either way, never a broken
           image. -->
      <section class="bb-hero">
        <div class="bb-hero-inner">
          <div class="bb-hero-copy">
            <p appReveal class="bb-hero-eyebrow">Trusted NRI services platform</p>
            <h1 appReveal [revealDelay]="90" class="bb-hero-title">
              Expert India Services for<br class="hidden sm:block" />
              NRIs and Their Families
            </h1>
            <p appReveal [revealDelay]="170" class="bb-hero-sub">
              Tax &amp; compliance, wealth management, real estate, and legal documentation — run
              end-to-end by a dedicated advisor in your time zone, tracked on one secure
              dashboard.
            </p>
            <div appReveal [revealDelay]="210" class="bb-hero-rotator">
              <span class="bb-hero-rotator-label">Specialists in</span>
              <span class="bb-hero-rotator-stage">
                @for (v of verticals; track v.slug; let i = $index) {
                  <span class="bb-hero-rotator-word" [style.animation-delay.s]="i * -2">{{
                    v.name
                  }}</span>
                }
              </span>
            </div>
            <div appReveal [revealDelay]="250" class="bb-hero-actions">
              <a href="#consultation" class="bb-hero-btn bb-hero-btn-primary">
                Get in touch
                <i class="material-icons-outlined text-lg" aria-hidden="true">arrow_forward</i>
              </a>
              <a routerLink="/services" class="bb-hero-btn bb-hero-btn-ghost">Explore services</a>
            </div>
          </div>

          <div appReveal [revealDelay]="320" class="bb-hero-trust">
            @for (t of trustPoints; track t.label) {
              <div class="bb-hero-trust-item">
                <span class="bb-hero-trust-icon">
                  <i class="material-icons-outlined text-[18px]" aria-hidden="true">{{
                    t.icon
                  }}</i>
                </span>
                <span>{{ t.label }}</span>
              </div>
            }
          </div>
        </div>
      </section>

      <!-- ══ INTRO — two column ══ -->
      <section class="px-6 sm:px-8 lg:px-12 py-14 sm:py-20">
        <div class="max-w-[1240px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <!-- Product preview: a stylised view of the real case dashboard,
               which says more about the service than stock photography would. -->
          <div class="bb-preview" appReveal>
            <div class="bb-preview-bar">
              <div class="flex items-center gap-1.5">
                <span class="bb-preview-dot"></span>
                <span class="bb-preview-dot"></span>
                <span class="bb-preview-dot"></span>
              </div>
              <span class="bb-preview-title">Case BB-2026-00184 · Property Sale</span>
              <span class="bb-preview-live">
                <span class="bb-preview-live-dot" aria-hidden="true"></span>
                Live
              </span>
            </div>
            <div class="bb-preview-body">
              @for (s of previewSteps; track s.label; let i = $index) {
                <div class="bb-preview-step">
                  <div class="bb-preview-marker-col">
                    <span
                      class="bb-preview-marker"
                      [class.is-done]="s.state === 'done'"
                      [class.is-active]="s.state === 'active'"
                    >
                      @if (s.state === 'done') {
                        <i class="material-icons-outlined text-[14px]" aria-hidden="true">check</i>
                      } @else {
                        {{ i + 1 }}
                      }
                    </span>
                    @if (i < previewSteps.length - 1) {
                      <span class="bb-preview-connector" [class.is-done]="s.state === 'done'"></span>
                    }
                  </div>
                  <div class="bb-preview-step-content">
                    <span class="bb-preview-step-label" [class.is-muted]="s.state === 'todo'">{{
                      s.label
                    }}</span>
                    @if (s.state === 'active') {
                      <span class="bb-preview-chip">In progress</span>
                    }
                  </div>
                </div>
              }
            </div>
            <div class="bb-preview-footer">
              <i class="material-icons-outlined text-[15px]" aria-hidden="true">history</i>
              Updated 2 hours ago by your advisor
            </div>
          </div>

          <div>
            <p appReveal class="bb-eyebrow">Professional services, managed</p>
            <h2 appReveal [revealDelay]="80" class="bb-h2">
              One advisor for everything you need in India
            </h2>
            <p appReveal [revealDelay]="140" class="bb-body mt-4">
              Managing matters in India from abroad usually means chasing a different CA, lawyer,
              and agent across twelve time zones. We replace that with a single accountable
              relationship — your advisor coordinates every specialist, and you watch it happen on
              a dashboard built for people who are not in the room.
            </p>
            <ul class="mt-7 flex flex-col gap-3.5">
              @for (p of introPoints; track p; let i = $index) {
                <li class="bb-check-item" appReveal [revealDelay]="180 + i * 70">
                  <span class="bb-check-mark">
                    <i class="material-icons-outlined text-[15px]" aria-hidden="true">check</i>
                  </span>
                  {{ p }}
                </li>
              }
            </ul>
            <a routerLink="/about" class="bb-link-arrow mt-8" appReveal [revealDelay]="420">
              More about us
              <i class="material-icons-outlined text-base" aria-hidden="true">arrow_forward</i>
            </a>
          </div>
        </div>
      </section>

      <!-- ══ SERVICES ══ -->
      <section class="px-4 sm:px-6 lg:px-10 py-16 sm:py-20" style="background: var(--ivory-soft)" id="services">
        <div class="w-full">
          <header appReveal class="max-w-2xl mb-12">
            <p class="bb-eyebrow">What we do</p>
            <h2 class="bb-h2">Everything you need. One platform.</h2>
            <p class="bb-body mt-4">
              Complete solutions across tax, wealth, property, and legal — handled by your
              dedicated advisor from enquiry through settlement.
            </p>
          </header>

          <ul class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 sm:gap-6">
            @for (v of verticals; track v.slug; let i = $index) {
              <li class="bb-service-card" appReveal [revealDelay]="i * 80">
                <div class="bb-service-icon">
                  <i class="material-icons-outlined" aria-hidden="true">{{ v.icon }}</i>
                </div>
                <h3 class="bb-h3">{{ v.name }}</h3>
                <p class="bb-body-sm mt-2.5 mb-5">{{ v.blurb }}</p>
                <ul class="flex flex-col gap-2 mb-6">
                  @for (s of v.services.slice(0, 3); track s.name) {
                    <li class="flex items-start gap-2.5 text-[15px] text-[var(--ink)]/75">
                      <i
                        class="material-icons-outlined text-[16px] mt-[3px] shrink-0 text-[var(--saffron)]"
                        aria-hidden="true"
                        >check</i
                      >
                      {{ s.name }}
                    </li>
                  }
                </ul>
                <a
                  [routerLink]="['/services', v.slug]"
                  class="bb-link-arrow"
                  [attr.aria-label]="'Explore all services in ' + v.name"
                >
                  Explore all services
                  <i class="material-icons-outlined text-base" aria-hidden="true">arrow_forward</i>
                </a>
                <span class="bb-service-numeral" aria-hidden="true">{{ '0' + (i + 1) }}</span>
              </li>
            }
          </ul>
        </div>
      </section>

      <!-- ══ WHY US ══ -->
      <section class="px-6 sm:px-8 lg:px-12 py-16 sm:py-20">
        <div class="max-w-[1240px] mx-auto">
          <header appReveal class="max-w-2xl mb-12">
            <p class="bb-eyebrow">Why MyBharatConnects</p>
            <h2 class="bb-h2">Built for the distance</h2>
          </header>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            @for (w of whyUs; track w.title; let i = $index) {
              <div class="bb-why-card" appReveal [revealDelay]="i * 70">
                <i class="material-icons-outlined bb-why-icon" aria-hidden="true">{{ w.icon }}</i>
                <h3 class="font-semibold text-[var(--ink)] text-[17px] mb-2">{{ w.title }}</h3>
                <p class="bb-body-sm">{{ w.desc }}</p>
              </div>
            }
          </div>
        </div>
      </section>

      <!-- ══ PROCESS — animated flow diagram ══
           A journey rail: a start dot, four step markers, a finish flag —
           each pair joined by a connector where a chevron pattern visibly
           travels from one marker to the next, so the whole thing reads as
           a live route rather than a static 4-box grid. -->
      <section
        class="bg-[var(--ink)] text-[var(--ivory)] px-6 sm:px-8 lg:px-12 pt-10 sm:pt-12 lg:pt-14 pb-14 sm:pb-16 lg:pb-20"
        id="about"
      >
        <div class="max-w-[1240px] mx-auto">
          <p appReveal class="bb-eyebrow-light">The process</p>
          <h2 appReveal class="bb-h2 !text-[var(--ivory)] !mb-16 sm:!mb-20 max-w-2xl">
            How MyBharatConnects works
          </h2>

          <ol class="bb-flow-rail">
            <div class="bb-flow-track" aria-hidden="true">
              <i class="material-icons-outlined bb-flow-track-arrow bb-flow-track-arrow-1">arrow_forward</i>
              <i class="material-icons-outlined bb-flow-track-arrow bb-flow-track-arrow-2">arrow_forward</i>
              <i class="material-icons-outlined bb-flow-track-arrow bb-flow-track-arrow-3">arrow_forward</i>
            </div>
            <li class="bb-flow-endpoint" aria-hidden="true">
              <span class="bb-flow-marker bb-flow-dot-marker">
                <span class="bb-flow-dot"></span>
              </span>
              <span class="bb-flow-endpoint-label">Start</span>
            </li>

            @for (step of steps; track step.num; let i = $index) {
              <li class="bb-flow-connector" aria-hidden="true">
                <span class="bb-flow-connector-line"></span>
              </li>
              <li class="bb-flow-step" appReveal [revealDelay]="i * 120">
                <span class="bb-flow-marker bb-flow-circle">
                  <i class="material-icons-outlined text-2xl" aria-hidden="true">{{
                    step.icon
                  }}</i>
                </span>
                <div class="bb-flow-step-body">
                  <span class="bb-flow-num">Step {{ step.num }}</span>
                  <h3 class="bb-flow-title">{{ step.title }}</h3>
                  <p class="bb-flow-desc">{{ step.desc }}</p>
                </div>
              </li>
            }

            <li class="bb-flow-connector" aria-hidden="true">
              <span class="bb-flow-connector-line"></span>
            </li>
            <li class="bb-flow-endpoint" aria-hidden="true">
              <span class="bb-flow-marker bb-flow-flag-marker">
                <i class="material-icons-outlined text-xl" aria-hidden="true">flag</i>
              </span>
              <span class="bb-flow-endpoint-label">Complete</span>
            </li>
          </ol>
        </div>
      </section>

      <!-- ══ STATS ══ -->
      <section class="grid grid-cols-2 md:grid-cols-4 bg-[var(--navy-800)]" aria-label="Key statistics" appReveal>
        @for (stat of stats; track stat.num; let i = $index) {
          <div
            class="flex flex-col items-center justify-center p-7 sm:p-9 gap-1.5"
            [class.border-r]="i < stats.length - 1"
            style="border-color: rgba(245,240,230,0.1)"
          >
            <span
              class="text-3xl sm:text-4xl font-extrabold text-[var(--saffron)] tracking-tight"
              [appCountUp]="stat.num"
              >{{ stat.num }}</span
            >
            <span
              class="text-[11px] sm:text-xs font-semibold tracking-[0.12em] uppercase text-center"
              style="color: rgba(245,240,230,0.82)"
              >{{ stat.lbl }}</span
            >
          </div>
        }
      </section>

      <!-- ══ CONSULTATION FORM ══ -->
      <!-- scroll-mt clears the sticky header so the section isn't tucked
           underneath it when jumped to via the hero's #consultation link -->
      <section class="px-6 sm:px-8 lg:px-12 py-16 sm:py-20 scroll-mt-24" id="consultation">
        <div class="max-w-[1240px] mx-auto grid grid-cols-1 lg:grid-cols-[0.85fr_1.15fr] gap-10 lg:gap-14 items-start">
          <div appReveal>
            <p class="bb-eyebrow">Get started today</p>
            <h2 class="bb-h2">Talk to an expert</h2>
            <p class="bb-body mt-4">
              Book a free 30-minute discovery call. We'll scope your situation and recommend
              exactly the services you need, with transparent pricing before you commit.
            </p>
            <ul class="mt-7 flex flex-col gap-3.5">
              @for (p of consultPoints; track p) {
                <li class="bb-check-item">
                  <span class="bb-check-mark">
                    <i class="material-icons-outlined text-[15px]" aria-hidden="true">check</i>
                  </span>
                  {{ p }}
                </li>
              }
            </ul>
          </div>

          <div class="bb-form-card" appReveal [revealDelay]="100">
            @if (leadSubmitted) {
              <div class="bb-lead-success">
                <span class="bb-lead-success-icon">
                  <i class="material-icons-outlined" aria-hidden="true">check</i>
                </span>
                <h3 class="bb-lead-success-title">Request received</h3>
                <p class="bb-lead-success-body">
                  Thanks, {{ lead.name || 'there' }} — a member of our team will reach out within
                  one business day to schedule your consultation.
                </p>
                <button type="button" class="bb-lead-success-reset" (click)="resetLeadForm()">
                  Submit another request
                </button>
              </div>
            } @else {
            <form class="flex flex-col gap-4" (ngSubmit)="onLeadSubmit()">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="bb-dark-field">
                  <label class="bb-dark-label" for="lead-name">Your name</label>
                  <input
                    id="lead-name"
                    class="bb-dark-input"
                    type="text"
                    [(ngModel)]="lead.name"
                    name="name"
                    placeholder="e.g. Priya Sharma"
                    autocomplete="name"
                    required
                  />
                </div>
                <div class="bb-dark-field">
                  <label class="bb-dark-label" for="lead-email">Email</label>
                  <input
                    id="lead-email"
                    class="bb-dark-input"
                    type="email"
                    [(ngModel)]="lead.email"
                    name="email"
                    placeholder="you@example.com"
                    autocomplete="email"
                    required
                  />
                </div>
              </div>

              <div class="bb-dark-field">
                <label class="bb-dark-label" for="lead-phone">Phone / WhatsApp</label>
                <app-phone-input
                  inputId="lead-phone"
                  theme="dark"
                  [(ngModel)]="lead.phone"
                  name="phone"
                  defaultCountryIso2="US"
                  placeholder="415 555 0100"
                />
              </div>

              <div class="bb-dark-field">
                <label class="bb-dark-label" for="lead-service">What service do you need?</label>
                <select
                  id="lead-service"
                  class="bb-dark-input bb-dark-select"
                  [(ngModel)]="lead.serviceType"
                  name="serviceType"
                >
                  <option value="" disabled selected>Choose a service…</option>
                  @for (g of serviceGroups; track g.label) {
                    <optgroup [label]="g.label">
                      @for (s of g.options; track s) {
                        <option [value]="s">{{ s }}</option>
                      }
                    </optgroup>
                  }
                  <option [value]="otherServiceValue">Other (please specify)</option>
                </select>
              </div>

              @if (lead.serviceType === otherServiceValue) {
                <div class="bb-dark-field">
                  <label class="bb-dark-label" for="lead-message">Tell us what you need</label>
                  <textarea
                    id="lead-message"
                    class="bb-dark-input"
                    rows="3"
                    [(ngModel)]="lead.message"
                    name="message"
                    placeholder="Describe the service or situation you need help with…"
                    required
                  ></textarea>
                </div>
              }

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="bb-dark-field">
                  <label class="bb-dark-label" for="lead-country">Country</label>
                  <select
                    id="lead-country"
                    class="bb-dark-input bb-dark-select"
                    [(ngModel)]="lead.country"
                    name="country"
                    (ngModelChange)="onLeadCountryChange()"
                  >
                    <option value="" disabled selected>Where are you based?</option>
                    @for (c of countryOptions; track c.value) {
                      <option [value]="c.value">{{ c.label }}</option>
                    }
                  </select>
                </div>
                <div class="bb-dark-field">
                  <label class="bb-dark-label" for="lead-timezone">Best time to call</label>
                  <select
                    id="lead-timezone"
                    class="bb-dark-input bb-dark-select"
                    [(ngModel)]="lead.timezone"
                    name="timezone"
                  >
                    <option value="" disabled selected>Pick a timezone</option>
                    @for (t of availableTimezoneOptions(); track t.value) {
                      <option [value]="t.value">{{ t.label }}</option>
                    }
                  </select>
                </div>
              </div>

              <div class="bb-dark-field">
                <label class="bb-dark-label" for="lead-intent">
                  Urgency <span class="text-[var(--ivory)]/50 font-normal">(optional)</span>
                </label>
                <select
                  id="lead-intent"
                  class="bb-dark-input bb-dark-select"
                  [(ngModel)]="lead.intentTag"
                  name="intentTag"
                >
                  <option value="">Not sure yet</option>
                  @for (i of intentOptions; track i.value) {
                    <option [value]="i.value">{{ i.label }}</option>
                  }
                </select>
              </div>

              @if (leadError) {
                <p class="bb-lead-error">
                  <i class="material-icons-outlined text-base" aria-hidden="true">error_outline</i>
                  {{ leadError }}
                </p>
              }

              <button class="bb-dark-submit mt-2" type="submit" [disabled]="leadSubmitting">
                @if (leadSubmitting) {
                  <span class="loading loading-spinner loading-sm"></span>
                  Sending…
                } @else {
                  Request Consultation
                  <i class="material-icons-outlined" aria-hidden="true">arrow_forward</i>
                }
              </button>

              <p class="text-xs text-[var(--ivory)]/55 text-center mt-1 leading-relaxed">
                By submitting you agree to receive follow-up from our team. No spam, ever.
              </p>
            </form>
            }
          </div>
        </div>
      </section>

      <!-- ══ TESTIMONIALS ══ -->
      @if (testimonials.length > 0) {
        <section class="px-4 sm:px-6 lg:px-10 py-16 sm:py-20" style="background: var(--ivory-soft)">
          <div class="max-w-[1400px] mx-auto">
            <header appReveal class="max-w-2xl mb-12 mx-auto text-center">
              <p class="bb-eyebrow mx-auto">Client stories</p>
              <h2 class="bb-h2">What families say about us</h2>
            </header>

            <div class="bb-testimonial-scroll">
              @for (t of testimonials; track t._id; let i = $index) {
                <div class="bb-testimonial-card" appReveal [revealDelay]="i * 80">
                  <i class="material-icons-outlined bb-testimonial-quote" aria-hidden="true"
                    >format_quote</i
                  >
                  @if (testimonialStars(t) > 0) {
                    <div class="bb-testimonial-stars" aria-hidden="true">
                      @for (s of [1, 2, 3, 4, 5]; track s) {
                        <i class="material-icons-outlined">{{
                          s <= testimonialStars(t) ? 'star' : 'star_border'
                        }}</i>
                      }
                    </div>
                  }
                  <p class="bb-testimonial-content">{{ t.content }}</p>
                  <div class="bb-testimonial-author">
                    <span class="bb-testimonial-avatar" aria-hidden="true">{{
                      initials(t.clientName)
                    }}</span>
                    <div class="min-w-0">
                      <span class="bb-testimonial-name">{{ t.clientName }}</span>
                      @if (testimonialMeta(t)) {
                        <span class="bb-testimonial-meta">{{ testimonialMeta(t) }}</span>
                      }
                    </div>
                  </div>
                </div>
              }
            </div>
          </div>
        </section>
      }

      <!-- ══ CTA BANNER ══ -->
      <section
        class="px-6 sm:px-8 lg:px-12 py-16 sm:py-20 text-center"
        style="background: linear-gradient(135deg, var(--saffron) 0%, var(--saffron-hover) 100%)"
      >
        <p class="text-[15px] font-semibold tracking-[0.22em] uppercase mb-4" style="color: #ffffff">
          Take the first step
        </p>
        <h2 class="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[var(--navy-900)] mb-3 leading-[1.15] tracking-tight">
          Ready to put India on autopilot?
        </h2>
        <p class="mb-8 text-base" style="color: #ffffff">
          Join 100+ NRIs who trust MyBharatConnects across tax, wealth, property, and legal.
        </p>
        <a
          routerLink="/auth/register"
          class="bb-btn bb-btn-lg inline-flex"
          style="background: var(--ink); color: var(--ivory); border-color: var(--ink)"
        >
          Create Free Account
          <i class="material-icons-outlined" aria-hidden="true">arrow_forward</i>
        </a>
      </section>
    </main>

    <app-footer />
  `,
  styles: [
    `
      /* ═══ Ticker ═══ */
      .bb-ticker-track {
        animation: bb-ticker 34s linear infinite;
      }
      @keyframes bb-ticker {
        0% {
          transform: translateX(0);
        }
        100% {
          /* Shift by exactly one copy's width (1 of 8 equal copies) so the
           * next copy lands pixel-for-pixel where the previous one started
           * — the loop reset is invisible since nothing on screen changes. */
          transform: translateX(-12.5%);
        }
      }
      .bb-ticker-link {
        color: var(--ink);
        text-decoration: none;
        opacity: 0.65;
        transition:
          opacity 0.15s ease,
          color 0.15s ease;
      }
      .bb-ticker-link:hover {
        opacity: 1;
        color: var(--saffron-deep);
      }

      /* ═══ Hero panel ═══
       * One continuous full-bleed photo panel — no card, no rounded frame,
       * no inset margins. The negative top margin (undone by matching
       * padding-top, so the content itself doesn't shift) pulls the
       * background up underneath the sticky navbar above, which stays
       * fully transparent at rest (navbar.component.ts's [immersive]
       * input) — so the two read as one uninterrupted photo rather than
       * a bar sitting on top of a separate panel. If /hero.png is absent
       * the gradient carries the panel, so there is never a broken-image
       * state. */
      .bb-hero {
        position: relative;
        overflow: hidden;
        margin-top: -80px;
        padding-top: 80px;
        /* Full-bleed to the true viewport edge, including underneath the
           vertical scrollbar gutter — without this, the section only fills
           html's *content* width (viewport minus scrollbar), leaving a
           sliver of the page's light background visible beside the photo
           wherever the scrollbar sits. .bb-hero's left edge already sits
           flush at the viewport's true left edge (no centered max-width
           ancestor to break out of here), so unlike the usual "full-bleed
           from a centered container" trick, NO margin-left correction is
           needed — 100vw alone extends the box exactly far enough to the
           right to bleed under the scrollbar. Paired with body's
           overflow-x: hidden so this deliberate overflow doesn't introduce
           a second, horizontal scrollbar. */
        width: 100vw;
        background-image:
          linear-gradient(
            180deg,
            rgba(12, 33, 53, 0.5) 0%,
            rgba(12, 33, 53, 0.7) 45%,
            rgba(12, 33, 53, 0.92) 100%
          ),
          url('/hero.png'),
          linear-gradient(135deg, #1f4e79 0%, #12304d 55%, #0c2135 100%);
        background-size: cover, cover, cover;
        background-position: center, center, center;
        background-repeat: no-repeat;
      }

      .bb-hero-inner {
        position: relative;
        max-width: 1720px;
        margin: 0 auto;
        padding: 40px 20px 48px;
      }
      @media (min-width: 640px) {
        .bb-hero-inner {
          padding: 46px 32px 54px;
        }
      }
      @media (min-width: 1024px) {
        .bb-hero-inner {
          padding: 64px 56px 64px;
        }
      }

      .bb-hero-copy {
        position: relative;
        max-width: 680px;
      }

      .bb-hero-eyebrow {
        display: inline-block;
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: var(--saffron);
        border: 1px solid rgba(232, 119, 34, 0.45);
        border-radius: 9999px;
        padding: 6px 14px;
        margin: 0 0 16px;
      }

      .bb-hero-title {
        font-family: 'Plus Jakarta Sans', sans-serif;
        font-weight: 800;
        letter-spacing: -0.025em;
        line-height: 1.08;
        color: #ffffff;
        font-size: clamp(1.9rem, 4.4vw, 3.25rem);
        margin: 0 0 16px;
      }

      .bb-hero-sub {
        font-size: 1rem;
        line-height: 1.6;
        color: rgba(255, 255, 255, 0.88);
        max-width: 42rem;
        margin: 0 0 26px;
      }

      /* Rotating service-vertical word — one shared 8s crossfade keyframe,
       * phase-shifted per word via a negative animation-delay (2s apart for
       * 4 words) so exactly one is ever visible; no JS interval needed. */
      .bb-hero-rotator {
        display: flex;
        align-items: center;
        gap: 10px;
        margin: 0 0 24px;
        font-size: 13.5px;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.55);
      }
      .bb-hero-rotator-stage {
        position: relative;
        display: inline-block;
        min-width: 172px;
        height: 1.3em;
      }
      .bb-hero-rotator-word {
        position: absolute;
        left: 0;
        top: 0;
        white-space: nowrap;
        color: var(--saffron);
        font-weight: 700;
        opacity: 0;
        animation: bb-hero-rotate 8s ease-in-out infinite;
      }
      @keyframes bb-hero-rotate {
        0%,
        4% {
          opacity: 0;
          transform: translateY(6px);
        }
        9%,
        21% {
          opacity: 1;
          transform: translateY(0);
        }
        26%,
        100% {
          opacity: 0;
          transform: translateY(-6px);
        }
      }

      .bb-hero-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
      }
      .bb-hero-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        min-height: 48px;
        padding: 0 28px;
        border-radius: 9999px;
        font-size: 15px;
        font-weight: 700;
        letter-spacing: 0.01em;
        border: 2px solid transparent;
        transition:
          background-color 0.16s ease,
          border-color 0.16s ease,
          color 0.16s ease,
          transform 0.16s ease;
      }
      .bb-hero-btn:active {
        transform: translateY(1px);
      }
      .bb-hero-btn:focus-visible {
        outline: none;
        box-shadow: 0 0 0 3px rgba(232, 119, 34, 0.55);
      }
      .bb-hero-btn-primary {
        background: var(--saffron);
        border-color: var(--saffron);
        color: var(--navy-900);
      }
      .bb-hero-btn-primary:hover {
        background: var(--saffron-hover);
        border-color: var(--saffron-hover);
        color: #ffffff;
      }
      .bb-hero-btn-ghost {
        background: transparent;
        border-color: rgba(255, 255, 255, 0.55);
        color: #ffffff;
      }
      .bb-hero-btn-ghost:hover {
        background: #ffffff;
        border-color: #ffffff;
        color: var(--navy-900);
      }

      /* ═══ Trust strip — now inside the hero card itself ═══
       * A frosted sub-panel across the bottom of the dark card, echoing the
       * card-within-a-card composition without breaking from the hero's own
       * navy/saffron palette. */
      .bb-hero-trust {
        position: relative;
        display: grid;
        grid-template-columns: 1fr;
        gap: 14px;
        margin-top: 40px;
        padding: 18px 20px;
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 16px;
        backdrop-filter: blur(6px);
        max-width: 900px;
      }
      @media (min-width: 640px) {
        .bb-hero-trust {
          grid-template-columns: repeat(2, 1fr);
          margin-top: 48px;
        }
      }
      @media (min-width: 1024px) {
        .bb-hero-trust {
          grid-template-columns: repeat(4, 1fr);
          margin-top: 56px;
          padding: 20px 28px;
          max-width: none;
        }
      }
      .bb-hero-trust-item {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        font-size: 15px;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.92);
      }
      .bb-hero-trust-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 30px;
        height: 30px;
        border-radius: 9999px;
        background: rgba(232, 119, 34, 0.18);
        color: var(--saffron);
        flex-shrink: 0;
      }

      /* ═══ Shared type scale ═══ */
      .bb-eyebrow {
        font-size: 14px;
        font-weight: 700;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: var(--saffron-deep);
        margin: 0 0 14px;
      }
      .bb-eyebrow-light {
        font-size: 14px;
        font-weight: 700;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: var(--saffron);
        margin: 0 0 14px;
      }
      .bb-h2 {
        font-family: 'Plus Jakarta Sans', sans-serif;
        font-weight: 800;
        letter-spacing: -0.022em;
        line-height: 1.12;
        color: var(--ink);
        font-size: clamp(1.75rem, 3.4vw, 2.75rem);
        margin: 0;
      }
      .bb-h3 {
        font-family: 'Plus Jakarta Sans', sans-serif;
        font-weight: 700;
        letter-spacing: -0.012em;
        font-size: 1.3125rem;
        line-height: 1.3;
        color: var(--ink);
        margin: 0;
      }
      .bb-body {
        font-size: 1.0625rem;
        line-height: 1.7;
        color: var(--ink-80);
        margin: 0;
      }
      .bb-body-sm {
        font-size: 0.9375rem;
        line-height: 1.65;
        color: var(--ink-80);
        margin: 0;
      }

      .bb-check-item {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        font-size: 1rem;
        line-height: 1.55;
        color: var(--ink-80);
      }
      .bb-check-mark {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 22px;
        height: 22px;
        border-radius: 9999px;
        background: var(--saffron-50);
        color: var(--saffron-deep);
        flex-shrink: 0;
        margin-top: 2px;
      }

      .bb-link-arrow {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        font-size: 15px;
        font-weight: 700;
        color: var(--brand-navy);
        transition:
          gap 0.2s ease,
          color 0.2s ease;
      }
      .bb-link-arrow:hover {
        gap: 12px;
        color: var(--saffron-deep);
      }

      /* ═══ Process — animated flow diagram ═══
       * A single rail: start dot → connector → step → connector → step →
       * … → connector → finish flag. Each connector is a real element (not
       * a pseudo-element) carrying a small chevron pattern whose
       * background-position keyframes so the arrows visibly travel from one
       * marker to the next. Mobile stacks the rail vertically; desktop
       * (1024px+) lays it out horizontally. */
      .bb-flow-rail {
        position: relative;
        z-index: 0;
        display: flex;
        flex-direction: column;
        list-style: none;
        margin: 0;
        padding: 0;
      }
      @media (min-width: 1024px) {
        .bb-flow-rail {
          flex-direction: row;
          align-items: flex-start;
        }
      }

      /* Shared marker sizing — every marker (dot/circle/flag) reserves the
       * same 56px box so connectors always meet at the same center point. */
      .bb-flow-marker {
        width: 56px;
        height: 56px;
        border-radius: 9999px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      @media (min-width: 1024px) {
        .bb-flow-marker {
          margin-bottom: 16px;
        }
      }

      .bb-flow-circle {
        background: var(--navy-700);
        border: 2px solid var(--saffron);
        color: var(--saffron);
        transition:
          transform 0.2s ease,
          background-color 0.2s ease,
          color 0.2s ease;
      }
      .bb-flow-step:hover .bb-flow-circle {
        transform: scale(1.08);
        background: var(--saffron);
        color: var(--navy-900);
      }

      .bb-flow-dot-marker {
        background: transparent;
      }
      .bb-flow-dot {
        width: 14px;
        height: 14px;
        border-radius: 9999px;
        background: var(--saffron);
        box-shadow: 0 0 0 5px rgba(232, 119, 34, 0.2);
      }

      .bb-flow-flag-marker {
        background: var(--saffron);
        border: 2px solid var(--saffron);
        color: var(--navy-900);
      }

      /* Endpoints (start dot / finish flag) — marker + short caption */
      .bb-flow-endpoint {
        display: flex;
        align-items: center;
        gap: 16px;
        padding-bottom: 12px;
      }
      @media (min-width: 1024px) {
        .bb-flow-endpoint {
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 0;
          flex: 0 0 auto;
          width: 72px;
          padding-bottom: 0;
        }
      }
      .bb-flow-endpoint-label {
        font-size: 12.5px;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.65);
      }

      /* Steps — marker + text body */
      .bb-flow-step {
        display: flex;
        align-items: flex-start;
        gap: 16px;
        padding-bottom: 28px;
      }
      @media (min-width: 1024px) {
        .bb-flow-step {
          flex: 0 1 240px;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 0;
          padding: 0 8px;
        }
      }
      .bb-flow-step-body {
        min-width: 0;
      }

      .bb-flow-num {
        display: block;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--saffron);
        margin-bottom: 6px;
      }
      .bb-flow-title {
        font-size: 18px;
        font-weight: 700;
        color: #ffffff;
        margin: 0 0 8px;
      }
      .bb-flow-desc {
        font-size: 14.5px;
        line-height: 1.6;
        color: rgba(255, 255, 255, 0.78);
        margin: 0;
      }
      @media (min-width: 1024px) {
        .bb-flow-desc {
          max-width: 21rem;
        }
      }

      /* Journey rail — ONE continuous dashed line drawn behind the markers,
       * running from the first marker's true center to the last's, plus a
       * single arrow that travels its full length. A per-marker connector
       * only ever fills the thin strip between rows/columns; markers sit
       * centered inside much larger step boxes (icon beside text on
       * mobile/tablet, icon above text on desktop, with the text block's
       * height varying by wrap), so a per-segment line never actually
       * reaches the marker it's supposed to meet. One continuous track
       * anchored to the first/last marker's fixed center sidesteps that
       * regardless of how tall the in-between steps render. Mobile/tablet
       * stack vertically (<1024px); desktop lays the rail out horizontally. */
      .bb-flow-connector-line {
        display: none;
      }
      .bb-flow-track {
        position: absolute;
        left: 28px; /* center of the 56px marker column */
        top: 28px; /* center of the first marker */
        bottom: 28px; /* center of the last marker */
        width: 3px;
        border-radius: 9999px;
        background-image: repeating-linear-gradient(
          180deg,
          var(--saffron) 0 7px,
          rgba(255, 255, 255, 0.16) 7px 15px
        );
        animation: bb-flow-dash-v 0.9s linear infinite;
        z-index: -1;
      }
      @keyframes bb-flow-dash-v {
        from {
          background-position: 0 0;
        }
        to {
          background-position: 0 15px;
        }
      }
      .bb-flow-track-arrow {
        position: absolute;
        left: 50%;
        font-size: 17px;
        line-height: 1;
        color: var(--saffron);
        transform: translateX(-50%) rotate(90deg);
        animation: bb-flow-track-arrow-v 3.6s linear infinite;
      }
      @keyframes bb-flow-track-arrow-v {
        0% {
          top: 0;
          opacity: 0;
        }
        6% {
          opacity: 1;
        }
        94% {
          opacity: 1;
        }
        100% {
          top: calc(100% - 13px);
          opacity: 0;
        }
      }
      @media (min-width: 1024px) {
        .bb-flow-connector {
          flex: 1 1 32px;
          align-self: flex-start;
        }
        .bb-flow-track {
          left: 36px; /* center of the 72px start/finish marker column */
          right: 36px;
          top: 28px; /* center of the 56px marker */
          bottom: auto;
          width: auto;
          height: 3px;
          background-image: repeating-linear-gradient(
            90deg,
            var(--saffron) 0 7px,
            rgba(255, 255, 255, 0.16) 7px 15px
          );
          animation: bb-flow-dash-h 0.9s linear infinite;
        }
        .bb-flow-track-arrow {
          left: auto;
          top: 50%;
          transform: translateY(-50%) rotate(0deg);
          animation: bb-flow-track-arrow-h 3.6s linear infinite;
        }
      }
      @keyframes bb-flow-dash-h {
        from {
          background-position: 0 0;
        }
        to {
          background-position: 15px 0;
        }
      }
      @keyframes bb-flow-track-arrow-h {
        0% {
          left: 0;
          opacity: 0;
        }
        6% {
          opacity: 1;
        }
        94% {
          opacity: 1;
        }
        100% {
          left: calc(100% - 13px);
          opacity: 0;
        }
      }
      /* Three arrows share one cycle, staggered by a third each via a
       * negative delay (starts mid-cycle instead of waiting), so the track
       * always shows motion rather than one arrow's lonely round trip. Kept
       * after both orientations' animation shorthand rules — that shorthand
       * implicitly resets delay to 0, so an override placed earlier in the
       * cascade gets clobbered again at the next breakpoint. */
      .bb-flow-track-arrow-2 {
        animation-delay: -1.2s;
      }
      .bb-flow-track-arrow-3 {
        animation-delay: -2.4s;
      }

      /* ═══ Product preview card ═══ */
      .bb-preview {
        border-radius: 20px;
        overflow: hidden;
        background: #ffffff;
        border: 1px solid rgba(22, 40, 60, 0.1);
        box-shadow: 0 30px 70px rgba(12, 33, 53, 0.16);
      }
      .bb-preview-bar {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 14px 18px;
        background: var(--navy-900);
      }
      .bb-preview-dot {
        width: 9px;
        height: 9px;
        border-radius: 9999px;
        background: rgba(255, 255, 255, 0.28);
      }
      .bb-preview-title {
        font-size: 12.5px;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.82);
        letter-spacing: 0.01em;
      }
      .bb-preview-live {
        margin-left: auto;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #7ee0a8;
      }
      .bb-preview-live-dot {
        width: 6px;
        height: 6px;
        border-radius: 9999px;
        background: #34d17c;
        box-shadow: 0 0 0 3px rgba(52, 209, 124, 0.25);
        animation: bb-live-pulse 1.8s ease-in-out infinite;
      }
      @keyframes bb-live-pulse {
        0%,
        100% {
          opacity: 1;
        }
        50% {
          opacity: 0.35;
        }
      }
      .bb-preview-body {
        padding: 26px 24px 22px;
        display: flex;
        flex-direction: column;
      }
      .bb-preview-step {
        display: flex;
        gap: 14px;
      }
      .bb-preview-marker-col {
        display: flex;
        flex-direction: column;
        align-items: center;
      }
      .bb-preview-marker {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border-radius: 9999px;
        background: var(--navy-50);
        color: var(--ink-40);
        font-size: 12px;
        font-weight: 700;
        flex-shrink: 0;
      }
      .bb-preview-marker.is-done {
        background: var(--brand-navy);
        color: #ffffff;
      }
      .bb-preview-marker.is-active {
        background: var(--saffron);
        color: var(--navy-900);
        box-shadow: 0 0 0 4px rgba(232, 119, 34, 0.2);
      }
      .bb-preview-connector {
        width: 2px;
        flex: 1;
        min-height: 20px;
        background: var(--ivory-mute);
        margin: 3px 0;
      }
      .bb-preview-connector.is-done {
        background: var(--brand-navy);
        opacity: 0.35;
      }
      .bb-preview-step-content {
        display: flex;
        align-items: center;
        gap: 10px;
        padding-bottom: 22px;
        flex: 1;
        min-width: 0;
      }
      .bb-preview-step-label {
        font-size: 14.5px;
        font-weight: 600;
        color: var(--ink);
      }
      .bb-preview-step-label.is-muted {
        color: var(--ink-40);
        font-weight: 500;
      }
      .bb-preview-chip {
        margin-left: auto;
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--saffron-deep);
        background: var(--saffron-50);
        padding: 4px 9px;
        border-radius: 9999px;
        white-space: nowrap;
      }
      .bb-preview-footer {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 14px 24px;
        border-top: 1px solid var(--ivory-mute);
        font-size: 12.5px;
        font-weight: 500;
        color: var(--ink-40);
      }

      /* ═══ Why-us cards ═══ */
      .bb-why-card {
        background: #ffffff;
        border: 1px solid rgba(22, 40, 60, 0.08);
        border-radius: 14px;
        padding: 26px 24px;
        transition:
          transform 0.2s ease,
          box-shadow 0.2s ease;
      }
      .bb-why-card:hover {
        transform: translateY(-3px);
        box-shadow: 0 12px 30px rgba(12, 33, 53, 0.09);
      }
      .bb-why-icon {
        font-size: 26px;
        color: var(--brand-navy);
        margin-bottom: 14px;
        display: block;
      }

      /* ═══ Service cards ═══ */
      .bb-service-card {
        position: relative;
        overflow: hidden;
        padding: 36px 32px 32px;
        background: #ffffff;
        border: 1px solid var(--ivory-mute);
        border-radius: 16px;
        transition:
          transform 0.25s ease,
          box-shadow 0.25s ease,
          border-color 0.25s ease;
      }
      .bb-service-card:hover {
        transform: translateY(-4px);
        box-shadow: 0 16px 38px rgba(12, 33, 53, 0.11);
        border-color: rgba(31, 78, 121, 0.35);
      }
      .bb-service-card::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 3px;
        background: var(--saffron);
        transform: scaleX(0);
        transform-origin: left;
        transition: transform 0.3s ease;
      }
      .bb-service-card:hover::before {
        transform: scaleX(1);
      }
      .bb-service-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 54px;
        height: 54px;
        border-radius: 14px;
        background: var(--navy-50);
        color: var(--brand-navy);
        margin-bottom: 22px;
        transition:
          background-color 0.25s ease,
          color 0.25s ease,
          transform 0.25s ease;
      }
      .bb-service-icon i {
        font-size: 27px;
      }
      .bb-service-card:hover .bb-service-icon {
        background: var(--brand-navy);
        color: #ffffff;
        transform: scale(1.05);
      }
      .bb-service-numeral {
        position: absolute;
        top: 20px;
        right: 24px;
        font-family: 'Plus Jakarta Sans', sans-serif;
        font-size: 19px;
        font-weight: 800;
        color: var(--ink);
        opacity: 0.14;
        letter-spacing: 0.02em;
      }

      /* ═══ Testimonials ═══
       * Snap-scrolling row on mobile/tablet (native touch scroll, one card
       * peeking at the edge to hint there's more); a static 3-column grid
       * once there's room for all of them side by side on desktop. */
      .bb-testimonial-scroll {
        display: flex;
        gap: 20px;
        overflow-x: auto;
        padding: 4px 4px 12px;
        margin: 0 -4px;
        scroll-snap-type: x mandatory;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: none;
      }
      .bb-testimonial-scroll::-webkit-scrollbar {
        display: none;
      }
      @media (min-width: 1024px) {
        .bb-testimonial-scroll {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          overflow: visible;
          padding: 0;
          margin: 0;
        }
      }
      .bb-testimonial-card {
        scroll-snap-align: start;
        flex: 0 0 82vw;
        display: flex;
        flex-direction: column;
        background: #ffffff;
        border: 1px solid rgba(22, 40, 60, 0.08);
        border-radius: 18px;
        padding: 28px 26px 24px;
        box-shadow: 0 10px 30px rgba(12, 33, 53, 0.05);
        transition:
          transform 0.25s ease,
          box-shadow 0.25s ease;
      }
      @media (min-width: 480px) {
        .bb-testimonial-card {
          flex-basis: 340px;
        }
      }
      @media (min-width: 1024px) {
        .bb-testimonial-card {
          flex: initial;
        }
      }
      .bb-testimonial-card:hover {
        transform: translateY(-4px);
        box-shadow: 0 16px 38px rgba(12, 33, 53, 0.12);
      }
      .bb-testimonial-quote {
        font-size: 32px;
        color: var(--saffron);
        opacity: 0.4;
        margin-bottom: 4px;
      }
      .bb-testimonial-stars {
        display: flex;
        gap: 2px;
        margin-bottom: 14px;
      }
      .bb-testimonial-stars i {
        font-size: 17px;
        color: var(--saffron);
      }
      .bb-testimonial-content {
        font-size: 14.5px;
        line-height: 1.65;
        color: var(--ink-80);
        margin: 0 0 22px;
        flex: 1;
      }
      .bb-testimonial-author {
        display: flex;
        align-items: center;
        gap: 12px;
        padding-top: 16px;
        border-top: 1px solid var(--ivory-mute);
      }
      .bb-testimonial-avatar {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        border-radius: 9999px;
        background: var(--navy-50);
        color: var(--brand-navy);
        font-weight: 700;
        font-size: 13.5px;
        flex-shrink: 0;
      }
      .bb-testimonial-name {
        display: block;
        font-size: 14px;
        font-weight: 700;
        color: var(--ink);
      }
      .bb-testimonial-meta {
        display: block;
        font-size: 12.5px;
        color: var(--ink-40);
        margin-top: 1px;
      }

      /* ═══ Consultation form card (navy panel) ═══ */
      .bb-form-card {
        background: var(--ink);
        color: var(--ivory);
        border-radius: 20px;
        padding: 30px 26px;
        border-top: 3px solid var(--saffron);
        box-shadow: 0 24px 60px rgba(12, 33, 53, 0.2);
      }
      @media (min-width: 640px) {
        .bb-form-card {
          padding: 38px 36px;
        }
      }

      .bb-dark-field {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .bb-dark-label {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.09em;
        text-transform: uppercase;
        color: rgba(245, 240, 230, 0.8);
      }
      .bb-dark-input {
        width: 100%;
        height: 48px;
        padding: 0 14px;
        background: rgba(245, 240, 230, 0.06);
        border: 1px solid rgba(245, 240, 230, 0.22);
        border-radius: 10px;
        color: var(--ivory);
        font-family: 'Inter', sans-serif;
        font-size: 15px;
        font-weight: 400;
        outline: none;
        appearance: none;
        transition:
          background-color 0.15s ease,
          border-color 0.15s ease,
          box-shadow 0.15s ease;
      }
      .bb-dark-input::placeholder {
        color: rgba(245, 240, 230, 0.45);
      }
      textarea.bb-dark-input {
        height: auto;
        min-height: 88px;
        padding: 10px 14px;
        resize: vertical;
      }
      .bb-dark-input:hover:not(:disabled):not(:focus) {
        background: rgba(245, 240, 230, 0.09);
        border-color: rgba(245, 240, 230, 0.35);
      }
      .bb-dark-input:focus {
        background: rgba(245, 240, 230, 0.1);
        border-color: var(--saffron);
        box-shadow: 0 0 0 3px rgba(232, 119, 34, 0.22);
      }
      .bb-dark-input:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }
      .bb-dark-input option {
        background: var(--ink);
        color: var(--ivory);
        padding: 8px;
      }
      .bb-dark-input option:checked {
        background: rgba(232, 119, 34, 0.25);
        color: var(--ivory);
      }
      /* Browsers don't inherit <select>/<option> theming onto <optgroup> —
         left unstyled it falls back to a white system label bar. Match it to
         the dark dropdown explicitly. */
      .bb-dark-input optgroup {
        background: var(--ink);
        color: rgba(245, 240, 230, 0.65);
        font-style: normal;
        font-weight: 700;
        padding: 8px;
      }

      .bb-dark-select {
        padding-right: 42px;
        cursor: pointer;
        background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8' fill='none'><path d='M1 1.5L6 6.5L11 1.5' stroke='%23f7f5f0' stroke-opacity='0.65' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/></svg>");
        background-position: right 16px center;
        background-size: 12px 8px;
        background-repeat: no-repeat;
        background-attachment: local;
      }
      .bb-dark-select:focus,
      .bb-dark-select:active {
        background-image: none;
      }
      .bb-dark-select::-ms-expand {
        display: none;
      }

      .bb-dark-submit {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        width: 100%;
        height: 54px;
        border-radius: 9999px;
        background: var(--saffron);
        color: var(--navy-900);
        font-family: 'Plus Jakarta Sans', sans-serif;
        font-size: 15px;
        font-weight: 700;
        letter-spacing: 0.02em;
        border: 2px solid var(--saffron);
        cursor: pointer;
        transition:
          background-color 0.15s ease,
          border-color 0.15s ease,
          color 0.15s ease,
          transform 0.06s ease,
          box-shadow 0.15s ease;
      }
      .bb-dark-submit:hover:not(:disabled) {
        background: var(--saffron-hover);
        border-color: var(--saffron-hover);
        color: #ffffff;
      }
      .bb-dark-submit:focus-visible {
        outline: none;
        box-shadow: 0 0 0 3px rgba(232, 119, 34, 0.45);
      }
      .bb-dark-submit:active:not(:disabled) {
        transform: translateY(1px);
      }
      .bb-dark-submit:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }

      .bb-lead-error {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        color: #ffb4a8;
        margin: -4px 0 0;
      }

      /* Inline confirmation shown in place of the form after a successful
       * submit — same dark card shell, no navigation away from the page. */
      .bb-lead-success {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        padding: 24px 8px;
      }
      .bb-lead-success-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 56px;
        height: 56px;
        border-radius: 9999px;
        background: rgba(232, 119, 34, 0.16);
        color: var(--saffron);
        margin-bottom: 18px;
      }
      .bb-lead-success-icon i {
        font-size: 28px;
      }
      .bb-lead-success-title {
        font-family: 'Plus Jakarta Sans', sans-serif;
        font-weight: 800;
        font-size: 22px;
        color: var(--ivory);
        margin: 0 0 10px;
      }
      .bb-lead-success-body {
        font-size: 14.5px;
        line-height: 1.6;
        color: rgba(245, 240, 230, 0.75);
        max-width: 30rem;
        margin: 0 0 22px;
      }
      .bb-lead-success-reset {
        font-size: 13.5px;
        font-weight: 700;
        color: var(--saffron);
        background: none;
        border: none;
        cursor: pointer;
        padding: 6px 4px;
        transition: color 0.15s ease;
      }
      .bb-lead-success-reset:hover {
        color: var(--saffron-hover);
      }
    `,
  ],
})
export class LandingComponent implements OnInit {
  readonly verticals = SERVICE_VERTICALS;
  readonly serviceGroups = SERVICE_VERTICALS.map((v) => ({
    label: v.name,
    options: v.services.map((s) => s.name),
  }));

  readonly otherServiceValue = OTHER_SERVICE_VALUE;
  readonly countryOptions = COUNTRY_OPTIONS;
  readonly intentOptions = INTENT_OPTIONS;

  lead = {
    name: '',
    email: '',
    phone: '',
    serviceType: '',
    country: '',
    timezone: '',
    intentTag: '',
    message: '',
  };
  leadSubmitting = false;
  leadSubmitted = false;
  leadError = '';

  testimonials: PublicTestimonial[] = [];

  constructor(
    private title: Title,
    private meta: Meta,
    private http: HttpClient,
    private recaptcha: RecaptchaService,
  ) {}

  ngOnInit(): void {
    const pageTitle =
      'MyBharatConnects — NRI Services Platform | Tax, Wealth, Real Estate & Legal';
    const description =
      'End-to-end services for NRIs across four verticals — tax & compliance, wealth management, real estate, and legal documentation. Trusted by 100+ NRI clients.';
    const ogImage = '/og-image.png';

    this.title.setTitle(pageTitle);
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({
      name: 'keywords',
      content:
        'NRI tax filing, NRI wealth management, NRI real estate, NRI legal documentation, US tax filing for NRIs, India ITR filing, property management India, NRI advisory',
    });
    this.meta.updateTag({ name: 'robots', content: 'index, follow' });

    this.meta.updateTag({ property: 'og:title', content: pageTitle });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
    this.meta.updateTag({ property: 'og:image', content: ogImage });
    this.meta.updateTag({ property: 'og:site_name', content: 'MyBharatConnects' });

    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:title', content: pageTitle });
    this.meta.updateTag({ name: 'twitter:description', content: description });
    this.meta.updateTag({ name: 'twitter:image', content: ogImage });

    this.loadTestimonials();
  }

  loadTestimonials(): void {
    this.http
      .get<{ data: PublicTestimonial[] }>(`${environment.apiUrl}/feedback/testimonials/public?limit=9`)
      .subscribe({
        next: (res) => {
          this.testimonials = res?.data ?? [];
        },
        error: () => {
          this.testimonials = [];
        },
      });
  }

  testimonialStars(t: PublicTestimonial): number {
    return t.ratingId?.starRating ?? 0;
  }

  testimonialMeta(t: PublicTestimonial): string {
    return [t.clientCountry, t.serviceType].filter(Boolean).join(' · ');
  }

  initials(name: string): string {
    return (name || '')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }

  availableTimezoneOptions(): SelectOption[] {
    return timezonesForCountry(this.lead.country);
  }

  onLeadCountryChange(): void {
    // Clear a previously-picked timezone if it no longer fits the new country
    // (e.g. switched from US to India) rather than silently submitting a
    // mismatched selection.
    const stillValid = this.availableTimezoneOptions().some((t) => t.value === this.lead.timezone);
    if (!stillValid) {
      this.lead.timezone = '';
    }
  }

  async onLeadSubmit() {
    const { name, email, phone, serviceType, country, timezone, intentTag, message } = this.lead;
    if (!name || !email || !serviceType) {
      this.leadError = 'Please fill in your name, email, and the service you need.';
      return;
    }
    if (serviceType === this.otherServiceValue && !message.trim()) {
      this.leadError = 'Please tell us what you need.';
      return;
    }
    this.leadError = '';
    this.leadSubmitting = true;
    const recaptchaToken = await this.recaptcha.execute('lead_submit');
    this.http
      .post(`${environment.apiUrl}/leads`, {
        name,
        email,
        phone,
        serviceType,
        country,
        timezone,
        intentTag,
        message: message.trim() || undefined,
        recaptchaToken,
      })
      .subscribe({
        next: () => {
          this.leadSubmitting = false;
          this.leadSubmitted = true;
        },
        error: () => {
          this.leadSubmitting = false;
          this.leadError = 'Something went wrong on our end — please try again in a moment.';
        },
      });
  }

  resetLeadForm(): void {
    this.lead = {
      name: '',
      email: '',
      phone: '',
      serviceType: '',
      country: '',
      timezone: '',
      intentTag: '',
      message: '',
    };
    this.leadSubmitted = false;
    this.leadError = '';
  }

  trustPoints = [
    { icon: 'verified_user', label: 'Credential-verified professionals' },
    { icon: 'schedule', label: 'US-hours support' },
    { icon: 'lock', label: 'Secure document vault' },
    { icon: 'receipt_long', label: 'Transparent pricing' },
  ];

  // Mirrors the real case pipeline shown in the client dashboard.
  previewSteps = [
    { label: 'Enquiry received', state: 'done' },
    { label: 'Advisor assigned', state: 'done' },
    { label: 'Quotes from vetted specialists', state: 'active' },
    { label: 'Documents & execution', state: 'todo' },
    { label: 'Completion & sign-off', state: 'todo' },
  ];

  introPoints = [
    'One dedicated advisor coordinating every specialist on your file',
    'Every CA, lawyer, and property partner verified before they touch your case',
    'Quotes, milestones, and documents tracked in one place',
    'Nothing moves without your approval',
  ];

  consultPoints = [
    'No obligation and no cost for the first call',
    'Scoped pricing before any work begins',
    'Straight answers on what is and is not possible',
  ];

  stats = [
    { num: '100+', lbl: 'NRI Clients Served' },
    { num: '₹50Cr+', lbl: 'Assets Managed' },
    { num: '10+', lbl: 'Cities Covered' },
    { num: '50+', lbl: 'Expert Consultants' },
  ];

  whyUs = [
    {
      icon: 'support_agent',
      title: 'One dedicated advisor',
      desc: 'A single point of contact coordinates every vertical you need — no re-explaining your situation.',
    },
    {
      icon: 'payments',
      title: 'Transparent pricing',
      desc: 'See every quote and milestone before you commit — no surprise invoices.',
    },
    {
      icon: 'lock',
      title: 'Secure document vault',
      desc: 'Upload, sign, and track paperwork on one dashboard, visible only to who you allow.',
    },
    {
      icon: 'groups',
      title: 'Vetted specialists',
      desc: 'CAs, lawyers, and property partners empanelled and reviewed before they touch your case.',
    },
  ];

  steps = [
    {
      num: '01',
      icon: 'edit_note',
      title: 'Submit Enquiry',
      desc: 'Tell us your requirements — the service, your situation, and any deadline.',
    },
    {
      num: '02',
      icon: 'headset_mic',
      title: 'Discovery Call',
      desc: 'Your dedicated advisor calls within 24 hours to understand your needs deeply.',
    },
    {
      num: '03',
      icon: 'description',
      title: 'Curated Proposals',
      desc: 'We match you with vetted specialists and send tailored quotes for your approval.',
    },
    {
      num: '04',
      icon: 'verified',
      title: 'Seamless Delivery',
      desc: 'Track your case end-to-end on the dashboard. We handle every detail.',
    },
  ];
}
