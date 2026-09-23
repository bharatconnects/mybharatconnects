import { Directive, ElementRef, Input, OnDestroy, OnInit } from '@angular/core';

/**
 * Counts a numeric stat up from 0 once it scrolls into view. Parses the
 * leading number out of strings like "500+", "₹500Cr+", "10+" and animates
 * just that number, re-appending the original prefix/suffix untouched.
 */
@Directive({
  selector: '[appCountUp]',
  standalone: true,
})
export class CountUpDirective implements OnInit, OnDestroy {
  @Input('appCountUp') value = '';
  @Input() duration = 1400;

  private observer?: IntersectionObserver;
  private rafId?: number;

  constructor(private el: ElementRef<HTMLElement>) {}

  ngOnInit(): void {
    const match = this.value.match(/^(\D*)([\d,]+)(\D*)$/);
    if (!match) {
      this.el.nativeElement.textContent = this.value;
      return;
    }
    const [, prefix, numStr, suffix] = match;
    const target = Number(numStr.replace(/,/g, ''));

    if (typeof IntersectionObserver === 'undefined') {
      this.el.nativeElement.textContent = this.value;
      return;
    }

    this.el.nativeElement.textContent = `${prefix}0${suffix}`;
    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            this.animate(target, prefix, suffix);
            this.observer?.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.4 },
    );
    this.observer.observe(this.el.nativeElement);
  }

  private animate(target: number, prefix: string, suffix: string): void {
    const start = performance.now();
    const step = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / this.duration);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out-cubic
      const current = Math.round(target * eased);
      this.el.nativeElement.textContent = `${prefix}${current.toLocaleString()}${suffix}`;
      if (progress < 1) {
        this.rafId = requestAnimationFrame(step);
      }
    };
    this.rafId = requestAnimationFrame(step);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    if (this.rafId) cancelAnimationFrame(this.rafId);
  }
}
