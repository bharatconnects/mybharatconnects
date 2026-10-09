import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import { NavbarComponent } from '../shared/navbar.component';
import { FooterComponent } from '../shared/footer.component';
import { verticalBySlug } from '../../shared/data/service-catalog';
import { BLOG_POSTS, BlogPost, postBySlug } from './blog-posts';

@Component({
  selector: 'app-blog-post',
  standalone: true,
  imports: [RouterLink, NavbarComponent, FooterComponent],
  template: `
    <app-navbar />

    <main>
      @if (post; as p) {
        <section
          class="px-6 sm:px-8 lg:px-12 pt-12 pb-10"
          style="background: radial-gradient(ellipse 80% 55% at 50% -10%, rgba(31,78,121,0.1) 0%, transparent 60%), var(--ivory)"
        >
          <div class="max-w-3xl mx-auto" [style.--card-accent]="accent">
            <nav aria-label="Breadcrumb" class="mb-6">
              <ol class="flex flex-wrap items-center gap-2 text-sm text-[var(--ink)]/60">
                <li>
                  <a routerLink="/" class="hover:text-[var(--saffron-deep)] transition-colors"
                    >Home</a
                  >
                </li>
                <li aria-hidden="true">/</li>
                <li>
                  <a routerLink="/blog" class="hover:text-[var(--saffron-deep)] transition-colors"
                    >Blog</a
                  >
                </li>
                <li aria-hidden="true">/</li>
                <li aria-current="page" class="font-semibold text-[var(--ink)]">
                  {{ p.category }}
                </li>
              </ol>
            </nav>

            <p class="bb-art-meta">
              <span class="bb-art-chip">
                <i class="material-icons-outlined" aria-hidden="true">{{ icon }}</i>
                {{ p.category }}
              </span>
              <span class="bb-art-time">{{ p.readTime }}</span>
            </p>
            <h1
              class="font-serif font-light text-[var(--ink)] text-3xl sm:text-4xl leading-[1.15] text-balance"
            >
              {{ p.title }}
            </h1>
          </div>
        </section>

        <article class="px-6 sm:px-8 lg:px-12 pb-14" style="background: var(--ivory)">
          <div class="bb-art max-w-3xl mx-auto" [style.--card-accent]="accent">
            @for (para of p.intro; track para) {
              <p class="bb-art-p">{{ para }}</p>
            }

            @for (s of p.sections; track s.heading) {
              <h2 class="bb-art-h2">{{ s.heading }}</h2>
              @for (b of s.blocks; track $index) {
                @switch (b.type) {
                  @case ('p') {
                    <p class="bb-art-p">{{ b.text }}</p>
                  }
                  @case ('ul') {
                    <ul class="bb-art-ul">
                      @for (it of b.items; track it.text) {
                        <li>
                          @if (it.lead) {
                            <strong>{{ it.lead }}</strong>
                          }
                          {{ it.text }}
                        </li>
                      }
                    </ul>
                  }
                  @case ('ol') {
                    <ol class="bb-art-ol">
                      @for (it of b.items; track it.text) {
                        <li>
                          @if (it.lead) {
                            <strong>{{ it.lead }}</strong>
                          }
                          {{ it.text }}
                        </li>
                      }
                    </ol>
                  }
                  @case ('table') {
                    <div class="bb-art-table-wrap">
                      <table class="bb-art-table">
                        <thead>
                          <tr>
                            @for (h of b.head; track h) {
                              <th scope="col">{{ h }}</th>
                            }
                          </tr>
                        </thead>
                        <tbody>
                          @for (row of b.rows; track row[0]) {
                            <tr>
                              @for (cell of row; track $index; let ci = $index) {
                                @if (ci === 0) {
                                  <th scope="row">{{ cell }}</th>
                                } @else {
                                  <td>{{ cell }}</td>
                                }
                              }
                            </tr>
                          }
                        </tbody>
                      </table>
                    </div>
                  }
                  @case ('groups') {
                    <div class="bb-art-groups">
                      @for (g of b.groups; track g.title) {
                        <div class="bb-art-group">
                          <h3>{{ g.title }}</h3>
                          <ul class="bb-art-ul">
                            @for (it of g.items; track it.text) {
                              <li>
                                @if (it.lead) {
                                  <strong>{{ it.lead }}</strong>
                                }
                                {{ it.text }}
                              </li>
                            }
                          </ul>
                        </div>
                      }
                    </div>
                  }
                  @case ('callout') {
                    <aside class="bb-art-callout">
                      <strong>{{ b.title }}</strong>
                      <p>{{ b.text }}</p>
                    </aside>
                  }
                }
              }
            }

            <aside class="bb-art-callout bb-art-closing">
              <strong>{{ p.closing.heading }}</strong>
              <p>{{ p.closing.text }}</p>
              <div class="bb-art-actions">
                <a routerLink="/" fragment="consultation" class="bb-cta-btn">
                  <i class="material-icons-outlined text-lg" aria-hidden="true"
                    >event_available</i
                  >
                  Book Discovery Call
                </a>
                <a [routerLink]="['/services', p.verticalSlug]" class="bb-cta-btn bb-cta-btn-alt">
                  Explore {{ p.category }} services
                  <i class="material-icons-outlined text-lg" aria-hidden="true">arrow_forward</i>
                </a>
              </div>
            </aside>
          </div>
        </article>

        <section class="px-6 sm:px-8 lg:px-12 py-14" style="background: var(--ivory-soft)">
          <div class="max-w-6xl mx-auto">
            <h2 class="font-serif text-2xl sm:text-3xl font-light text-[var(--ink)] mb-8">
              More from the blog
            </h2>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
              @for (o of others; track o.slug) {
                <a [routerLink]="['/blog', o.slug]" class="bb-more-card">
                  <span class="bb-more-cat">{{ o.category }}</span>
                  <span class="bb-more-title">{{ o.title }}</span>
                  <span class="bb-more-time">{{ o.readTime }}</span>
                </a>
              }
            </div>
          </div>
        </section>
      } @else {
        <section
          class="px-6 sm:px-8 lg:px-12 py-24 sm:py-32 text-center"
          style="background: var(--ivory)"
        >
          <div class="max-w-xl mx-auto">
            <p class="font-mono text-[15px] tracking-widest text-[var(--saffron-deep)] mb-4 uppercase">
              Article not found
            </p>
            <h1 class="font-serif font-light text-[var(--ink)] text-4xl leading-[1.1] mb-5">
              We couldn't find that article.
            </h1>
            <a routerLink="/blog" class="bb-cta-btn">
              Back to the blog
              <i class="material-icons-outlined text-lg" aria-hidden="true">arrow_forward</i>
            </a>
          </div>
        </section>
      }
    </main>

    <app-footer />
  `,
  styles: [
    `
      .bb-art-meta {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 12px;
        margin-bottom: 16px;
      }
      .bb-art-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 5px 12px 5px 8px;
        border-radius: 9999px;
        background: color-mix(in srgb, var(--card-accent) 10%, white);
        color: var(--card-accent);
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }
      .bb-art-chip i {
        font-size: 16px;
        width: 16px;
        height: 16px;
        line-height: 1;
      }
      .bb-art-time {
        font-size: 13px;
        color: rgba(22, 40, 60, 0.55);
      }

      .bb-art-p {
        font-size: 17px;
        line-height: 1.75;
        color: rgba(22, 40, 60, 0.82);
        margin: 0 0 20px;
      }
      .bb-art-h2 {
        font-family: var(--font-display);
        font-weight: 400;
        font-size: 1.625rem;
        line-height: 1.25;
        color: var(--ink);
        margin: 44px 0 16px;
        text-wrap: balance;
      }
      .bb-art-ul,
      .bb-art-ol {
        margin: 0 0 24px;
        padding-left: 0;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .bb-art-ul {
        list-style: none;
      }
      .bb-art-ul li {
        position: relative;
        padding-left: 26px;
        font-size: 16.5px;
        line-height: 1.7;
        color: rgba(22, 40, 60, 0.82);
      }
      .bb-art-ul li::before {
        content: '';
        position: absolute;
        left: 4px;
        top: 0.7em;
        width: 8px;
        height: 8px;
        border-radius: 9999px;
        background: var(--card-accent);
      }
      .bb-art-ol {
        list-style: none;
        counter-reset: step;
      }
      .bb-art-ol li {
        position: relative;
        counter-increment: step;
        padding-left: 42px;
        font-size: 16.5px;
        line-height: 1.7;
        color: rgba(22, 40, 60, 0.82);
      }
      .bb-art-ol li::before {
        content: counter(step);
        position: absolute;
        left: 0;
        top: 1px;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border-radius: 9999px;
        background: var(--card-accent);
        color: #ffffff;
        font-size: 13px;
        font-weight: 700;
      }
      .bb-art strong {
        font-weight: 700;
        color: var(--ink);
      }

      .bb-art-table-wrap {
        margin: 4px 0 28px;
        overflow-x: auto;
        border: 1px solid rgba(22, 40, 60, 0.1);
        border-radius: 12px;
        background: #ffffff;
      }
      .bb-art-table {
        width: 100%;
        min-width: 640px;
        border-collapse: collapse;
        font-size: 14.5px;
        line-height: 1.6;
      }
      .bb-art-table th,
      .bb-art-table td {
        padding: 14px 16px;
        text-align: left;
        vertical-align: top;
        border-bottom: 1px solid rgba(22, 40, 60, 0.08);
        color: rgba(22, 40, 60, 0.82);
      }
      .bb-art-table thead th {
        background: var(--card-accent);
        color: #ffffff;
        font-size: 12.5px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }
      .bb-art-table tbody th {
        font-weight: 700;
        color: var(--ink);
        white-space: nowrap;
      }
      .bb-art-table tbody tr:last-child th,
      .bb-art-table tbody tr:last-child td {
        border-bottom: none;
      }

      .bb-art-groups {
        display: grid;
        grid-template-columns: 1fr;
        gap: 16px;
        margin: 4px 0 28px;
      }
      @media (min-width: 768px) {
        .bb-art-groups {
          grid-template-columns: 1fr 1fr;
        }
      }
      .bb-art-group {
        padding: 22px 22px 6px;
        background: #ffffff;
        border: 1px solid rgba(22, 40, 60, 0.08);
        border-top: 4px solid var(--card-accent);
        border-radius: 12px;
      }
      .bb-art-group h3 {
        font-size: 16px;
        font-weight: 700;
        color: var(--ink);
        margin: 0 0 14px;
      }

      .bb-art-callout {
        margin: 36px 0 0;
        padding: 24px 26px;
        background: #ffffff;
        border: 1px solid rgba(22, 40, 60, 0.08);
        border-left: 4px solid var(--card-accent);
        border-radius: 12px;
      }
      .bb-art-callout > strong {
        display: block;
        font-family: var(--font-display);
        font-weight: 400;
        font-size: 1.375rem;
        color: var(--ink);
        margin-bottom: 8px;
      }
      .bb-art-callout > p {
        font-size: 16.5px;
        line-height: 1.7;
        color: rgba(22, 40, 60, 0.82);
        margin: 0;
      }
      .bb-art-closing {
        margin-top: 44px;
      }
      .bb-art-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 20px;
      }

      .bb-more-card {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 22px;
        background: #ffffff;
        border: 1px solid rgba(22, 40, 60, 0.08);
        border-radius: 12px;
        text-decoration: none;
        transition:
          transform 0.2s ease,
          box-shadow 0.2s ease;
      }
      .bb-more-card:hover,
      .bb-more-card:focus-visible {
        transform: translateY(-3px);
        box-shadow: 0 12px 28px rgba(12, 33, 53, 0.09);
        outline: none;
      }
      .bb-more-cat {
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--saffron-deep);
      }
      .bb-more-title {
        font-family: var(--font-display);
        font-size: 1.0625rem;
        line-height: 1.35;
        color: var(--ink);
      }
      .bb-more-time {
        margin-top: auto;
        font-size: 13px;
        color: rgba(22, 40, 60, 0.55);
      }

      .bb-cta-btn {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 13px 24px;
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
        background: var(--ink);
        color: var(--ivory);
        border-color: var(--ink);
      }
      .bb-cta-btn-alt {
        background: transparent;
        color: var(--ink);
        border-color: var(--ink);
      }
      .bb-cta-btn-alt:hover {
        background: var(--ink);
        color: var(--ivory);
        border-color: var(--ink);
      }
    `,
  ],
})
export class BlogPostComponent implements OnInit, OnDestroy {
  post: BlogPost | undefined;
  accent = '#1f4e79';
  icon = 'article';
  others: BlogPost[] = [];

  private sub?: Subscription;

  constructor(
    private route: ActivatedRoute,
    private title: Title,
    private meta: Meta,
  ) {}

  ngOnInit(): void {
    this.sub = this.route.paramMap.subscribe((params) => this.load(params.get('slug') ?? ''));
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  private load(slug: string): void {
    this.post = postBySlug(slug);
    if (!this.post) {
      this.title.setTitle('Article not found | MyBharatConnects');
      this.meta.updateTag({ name: 'robots', content: 'noindex' });
      return;
    }
    const v = verticalBySlug(this.post.verticalSlug);
    this.accent = v?.accent ?? '#1f4e79';
    this.icon = v?.icon ?? 'article';
    this.others = BLOG_POSTS.filter((p) => p.slug !== this.post!.slug);
    this.title.setTitle(`${this.post.title} | MyBharatConnects`);
    this.meta.updateTag({ name: 'description', content: this.post.excerpt });
    this.meta.updateTag({ name: 'keywords', content: this.post.keywords.join(', ') });
    this.meta.updateTag({ name: 'robots', content: 'index, follow' });
  }
}
