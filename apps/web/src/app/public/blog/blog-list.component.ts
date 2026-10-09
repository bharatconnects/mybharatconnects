import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { NavbarComponent } from '../shared/navbar.component';
import { FooterComponent } from '../shared/footer.component';
import { ScrollRevealDirective } from '../../shared/directives/scroll-reveal.directive';
import { verticalBySlug } from '../../shared/data/service-catalog';
import { BLOG_POSTS } from './blog-posts';

@Component({
  selector: 'app-blog-list',
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
          <p
            appReveal
            class="font-mono text-[15px] tracking-widest text-[var(--saffron-deep)] mb-4 uppercase"
          >
            The MyBharatConnects Blog
          </p>
          <h1
            appReveal
            [revealDelay]="80"
            class="font-serif font-light text-[var(--ink)] text-4xl sm:text-5xl leading-[1.1] mb-6 text-balance"
          >
            Practical guides for
            <em class="italic text-[var(--saffron)] whitespace-nowrap">NRIs.</em>
          </h1>
          <p
            appReveal
            [revealDelay]="160"
            class="text-base sm:text-lg text-[var(--ink)]/75 leading-relaxed text-balance"
          >
            Clear answers on tax, property, succession, and wealth in India, written for people
            managing it all from abroad.
          </p>
        </div>
      </section>

      <section class="px-6 sm:px-8 lg:px-12 pb-16 sm:pb-20" style="background: var(--ivory)">
        <div class="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
          @for (p of posts; track p.slug; let i = $index) {
            <a
              [routerLink]="['/blog', p.slug]"
              class="bb-post-card"
              [style.--card-accent]="p.accent"
              appReveal
              [revealDelay]="i * 70"
            >
              <span class="bb-post-chip">
                <i class="material-icons-outlined" aria-hidden="true">{{ p.icon }}</i>
                {{ p.category }}
              </span>
              <h2 class="bb-post-title">{{ p.title }}</h2>
              <p class="bb-post-excerpt">{{ p.excerpt }}</p>
              <span class="bb-post-foot">
                <span class="bb-post-time">{{ p.readTime }}</span>
                <span class="bb-post-cta">
                  Read article
                  <i class="material-icons-outlined" aria-hidden="true">arrow_forward</i>
                </span>
              </span>
            </a>
          }
        </div>
      </section>

      <section class="px-6 sm:px-8 lg:px-12 py-16 sm:py-20 text-center" style="background: var(--ink)">
        <div class="max-w-2xl mx-auto">
          <p class="font-mono text-[15px] tracking-[0.22em] text-[var(--saffron)] mb-4 uppercase">
            Have a specific question?
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
      .bb-post-card {
        display: flex;
        flex-direction: column;
        gap: 14px;
        padding: 28px 28px 24px;
        background: #ffffff;
        border: 1px solid rgba(22, 40, 60, 0.08);
        border-top: 4px solid var(--card-accent);
        border-radius: 12px;
        text-decoration: none;
        color: var(--ink);
        transition:
          transform 0.22s ease,
          box-shadow 0.22s ease;
      }
      .bb-post-card:hover,
      .bb-post-card:focus-visible {
        transform: translateY(-4px);
        box-shadow: 0 16px 38px rgba(12, 33, 53, 0.11);
        outline: none;
      }
      .bb-post-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        align-self: flex-start;
        padding: 5px 12px 5px 8px;
        border-radius: 9999px;
        background: color-mix(in srgb, var(--card-accent) 10%, white);
        color: var(--card-accent);
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }
      .bb-post-chip i {
        font-size: 16px;
        width: 16px;
        height: 16px;
        line-height: 1;
      }
      .bb-post-title {
        font-family: var(--font-display);
        font-weight: 400;
        font-size: 1.375rem;
        line-height: 1.3;
        color: var(--ink);
        text-wrap: balance;
      }
      .bb-post-excerpt {
        font-size: 15px;
        line-height: 1.65;
        color: rgba(22, 40, 60, 0.72);
      }
      .bb-post-foot {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-top: auto;
        padding-top: 8px;
      }
      .bb-post-time {
        font-size: 13px;
        color: rgba(22, 40, 60, 0.55);
      }
      .bb-post-cta {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 14.5px;
        font-weight: 700;
        color: var(--card-accent);
      }
      .bb-post-cta i {
        font-size: 18px;
        transition: transform 0.18s ease;
      }
      .bb-post-card:hover .bb-post-cta i {
        transform: translateX(4px);
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
export class BlogListComponent implements OnInit {
  readonly posts = BLOG_POSTS.map((p) => {
    const v = verticalBySlug(p.verticalSlug);
    return { ...p, accent: v?.accent ?? '#1f4e79', icon: v?.icon ?? 'article' };
  });

  constructor(
    private title: Title,
    private meta: Meta,
  ) {}

  ngOnInit(): void {
    this.title.setTitle('Blog | MyBharatConnects');
    this.meta.updateTag({
      name: 'description',
      content:
        'Practical guides for NRIs on Indian property sale TDS, remote property management, inheritance and succession, and NRE/NRO wealth structuring.',
    });
  }
}
