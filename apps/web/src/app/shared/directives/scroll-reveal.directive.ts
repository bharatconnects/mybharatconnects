import { Directive, ElementRef, Input, OnDestroy, OnInit } from '@angular/core';

/**
 * Fades + rises an element into view the first time it crosses into the
 * viewport. Pure IntersectionObserver + CSS transition — no animation
 * library dependency. Honors prefers-reduced-motion (handled globally in
 * styles.css, which zeroes transition-duration for all elements).
 *
 * Usage: <div appReveal [revealDelay]="80">...</div>
 */
@Directive({
  selector: '[appReveal]',
  standalone: true,
  host: {
    class: 'bb-reveal',
    '[style.transition-delay.ms]': 'revealDelay',
  },
})
export class ScrollRevealDirective implements OnInit, OnDestroy {
  @Input() revealDelay = 0;

  private observer?: IntersectionObserver;

  constructor(private el: ElementRef<HTMLElement>) {}

  ngOnInit(): void {
    if (typeof IntersectionObserver === 'undefined') {
      // SSR/no-op environment — just show the content.
      this.el.nativeElement.classList.add('bb-reveal-visible');
      return;
    }
    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            this.el.nativeElement.classList.add('bb-reveal-visible');
            this.observer?.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' },
    );
    this.observer.observe(this.el.nativeElement);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
