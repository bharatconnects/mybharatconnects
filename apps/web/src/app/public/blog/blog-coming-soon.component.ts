import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { NavbarComponent } from '../shared/navbar.component';
import { FooterComponent } from '../shared/footer.component';

@Component({
  selector: 'app-blog-coming-soon',
  standalone: true,
  imports: [RouterLink, NavbarComponent, FooterComponent],
  template: `
    <app-navbar />

    <main>
      <section
        class="px-6 sm:px-8 lg:px-12 py-24 sm:py-32"
        style="background: radial-gradient(ellipse 80% 55% at 50% -10%, rgba(31,78,121,0.1) 0%, transparent 60%), var(--ivory)"
      >
        <div class="max-w-xl mx-auto text-center">
          <p
            class="text-[11px] font-semibold tracking-[0.18em] uppercase mb-4"
            style="color: var(--saffron-deep)"
          >
            MyBharatConnects Blog
          </p>
          <h1
            class="font-serif font-light text-4xl sm:text-5xl leading-[1.1] mb-5"
            style="color: var(--ink)"
          >
            Coming soon
          </h1>
          <p class="text-base leading-relaxed" style="color: var(--ink-80)">
            We're putting together guides on tax, wealth management, real estate, and legal
            documentation for NRIs. Check back soon — or reach out directly and we'll answer
            your question now.
          </p>
          <a routerLink="/#consultation" class="bb-btn bb-btn-primary bb-btn-lg mt-8 inline-flex">
            Talk to an expert
            <i class="material-icons-outlined" aria-hidden="true">arrow_forward</i>
          </a>
        </div>
      </section>
    </main>

    <app-footer />
  `,
})
export class BlogComingSoonComponent implements OnInit {
  constructor(
    private title: Title,
    private meta: Meta,
  ) {}

  ngOnInit(): void {
    this.title.setTitle('Blog — Coming Soon | MyBharatConnects');
    this.meta.updateTag({
      name: 'description',
      content:
        'The MyBharatConnects blog is coming soon — guides on tax, wealth management, real estate, and legal documentation for NRIs.',
    });
  }
}
