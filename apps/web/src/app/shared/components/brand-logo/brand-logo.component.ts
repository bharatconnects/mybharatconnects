import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * MyBharatConnects brand lockup — faithful vector recreation of the official
 * logo: chakra wheel (navy ring, 24 spokes with rim dots, saffron hub) beside
 * a stacked serif wordmark — "My Bharat" (navy italic) over "Connects"
 * (saffron, upright, heavier) — with the letterspaced tagline underneath.
 *
 * Variants:
 *  - 'full'      wheel + stacked wordmark + tagline (official lockup)
 *  - 'lockup'    wheel + stacked wordmark (no tagline)
 *  - 'mark'      wheel only (collapsed sidebar, tight spaces)
 */
@Component({
  selector: 'app-brand-logo',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span
      class="bb-logo"
      [class.bb-logo-on-dark]="onDark"
      [class.bb-logo-monochrome]="monochrome"
      [style.--bb-logo-size.px]="size"
    >
      <svg
        class="bb-logo-mark"
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <circle cx="50" cy="50" r="45" class="bb-logo-ring" stroke-width="5.5" />
        @for (s of spokes; track s) {
          <line
            [attr.x1]="50 + 12 * cos(s)"
            [attr.y1]="50 + 12 * sin(s)"
            [attr.x2]="50 + 37 * cos(s)"
            [attr.y2]="50 + 37 * sin(s)"
            class="bb-logo-spoke"
            stroke-width="1.7"
            stroke-linecap="round"
          />
          <circle
            [attr.cx]="50 + 40.5 * cos(s)"
            [attr.cy]="50 + 40.5 * sin(s)"
            r="2"
            class="bb-logo-dot"
          />
        }
        <circle cx="50" cy="50" r="9" class="bb-logo-hub" />
      </svg>

      @if (variant !== 'mark') {
        <span class="bb-logo-text">
          <em class="bb-logo-my">My Bharat</em>
          <span class="bb-logo-connects">Connects</span>
          @if (variant === 'full') {
            <span class="bb-logo-tagline">Your India, Everywhere</span>
          }
        </span>
      }
    </span>
  `,
  styles: [
    `
      .bb-logo {
        display: inline-flex;
        align-items: center;
        gap: calc(var(--bb-logo-size) * 0.26);
        line-height: 1;
        user-select: none;
      }

      .bb-logo-mark {
        width: var(--bb-logo-size);
        height: var(--bb-logo-size);
        flex-shrink: 0;
      }

      .bb-logo-ring,
      .bb-logo-spoke {
        stroke: var(--brand-navy, #1f4e79);
      }
      .bb-logo-dot {
        fill: var(--brand-navy, #1f4e79);
      }
      .bb-logo-hub {
        fill: var(--saffron, #e87722);
      }

      /* Stacked wordmark, exactly like the official lockup */
      .bb-logo-text {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: calc(var(--bb-logo-size) * 0.04);
        min-width: 0;
      }

      .bb-logo-my {
        font-family: 'Fraunces', Georgia, 'Times New Roman', serif;
        font-style: italic;
        font-weight: 500;
        font-size: calc(var(--bb-logo-size) * 0.42);
        color: var(--brand-navy, #1f4e79);
        white-space: nowrap;
        letter-spacing: 0.01em;
      }

      .bb-logo-connects {
        font-family: 'Fraunces', Georgia, 'Times New Roman', serif;
        font-style: normal;
        font-weight: 600;
        font-size: calc(var(--bb-logo-size) * 0.46);
        color: var(--saffron, #e87722);
        white-space: nowrap;
        letter-spacing: 0.005em;
      }

      .bb-logo-tagline {
        font-family: 'Inter', sans-serif;
        font-weight: 500;
        font-size: clamp(9px, calc(var(--bb-logo-size) * 0.145), 16px);
        letter-spacing: 0.34em;
        text-transform: uppercase;
        color: var(--ink-60, rgba(22, 40, 60, 0.6));
        white-space: nowrap;
        margin-top: calc(var(--bb-logo-size) * 0.06);
      }

      /* Light-on-dark (navy sidebar / dark panels) — wheel and "My Bharat"
       * flip to ivory so they read on navy; "Connects" stays saffron. */
      .bb-logo-on-dark .bb-logo-ring,
      .bb-logo-on-dark .bb-logo-spoke {
        stroke: var(--ivory, #f7f5f0);
      }
      .bb-logo-on-dark .bb-logo-dot {
        fill: var(--ivory, #f7f5f0);
      }
      .bb-logo-on-dark .bb-logo-my {
        color: var(--ivory, #f7f5f0);
      }
      .bb-logo-on-dark .bb-logo-tagline {
        color: rgba(248, 246, 241, 0.55);
      }

      /* Fully white lockup — for the immersive/transparent navbar over a
       * photo background, where the saffron "Connects"/hub accent doesn't
       * reliably read against whatever the photo happens to show behind it.
       * Layers on top of .bb-logo-on-dark rather than replacing it, so the
       * navy-panel usages (sidebar, footer, auth pages) keep their saffron
       * accent untouched. */
      .bb-logo-monochrome .bb-logo-hub {
        fill: var(--ivory, #f7f5f0);
      }
      .bb-logo-monochrome .bb-logo-connects {
        color: var(--ivory, #f7f5f0);
      }
    `,
  ],
})
export class BrandLogoComponent {
  @Input() variant: 'full' | 'lockup' | 'mark' = 'lockup';
  /** Height of the wheel mark in px; the wordmark scales proportionally. */
  @Input() size = 40;
  /** Light treatment for dark (navy) backgrounds. */
  @Input() onDark = false;
  /** Fully white lockup (also whites out the saffron hub/"Connects") — for
   * placement over a photo/transparent background rather than a solid navy
   * panel. Has no effect unless `onDark` is also true. */
  @Input() monochrome = false;

  // 24 spokes, one every 15° — precomputed angle list for the template.
  readonly spokes = Array.from({ length: 24 }, (_, i) => (i * 15 * Math.PI) / 180);

  cos(a: number): number {
    return Math.round(Math.cos(a) * 1000) / 1000;
  }
  sin(a: number): number {
    return Math.round(Math.sin(a) * 1000) / 1000;
  }
}
