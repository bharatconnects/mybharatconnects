import { Component, effect, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ConsentService } from '../../../core/services/consent.service';

/**
 * Cookie consent banner. "Reject non-essential" and "Accept all" are equally
 * prominent on purpose (consent has to be as easy to refuse as to give), and
 * "Customize" opens per-category switches. Re-opened from the footer link.
 */
@Component({
  selector: 'app-cookie-banner',
  standalone: true,
  imports: [RouterLink],
  template: `
    @if (consent.bannerOpen()) {
      <div
        class="cb"
        role="dialog"
        aria-modal="false"
        aria-labelledby="cb-title"
        aria-describedby="cb-desc"
      >
        <div class="cb-inner">
        <span class="cb-icon" aria-hidden="true">
          <i class="material-icons-outlined">cookie</i>
        </span>
        <div class="cb-main">
        <h2 id="cb-title" class="cb-title">Your privacy choices</h2>
        <p id="cb-desc" class="cb-text">
          We use cookies to run this site and, with your permission, to understand how it is used
          and to measure our advertising. Learn more in our
          <a routerLink="/privacy" fragment="cookies" class="cb-link">Privacy Policy</a>.
        </p>

        @if (consent.showPreferences()) {
          <ul class="cb-cats">
            <li class="cb-cat">
              <div>
                <p class="cb-cat-name">Essential</p>
                <p class="cb-cat-desc">Sign-in, security, and basic site features. Always on.</p>
              </div>
              <input type="checkbox" class="cb-switch" checked disabled aria-label="Essential" />
            </li>
            <li class="cb-cat">
              <div>
                <p class="cb-cat-name">Analytics</p>
                <p class="cb-cat-desc">Helps us understand how the site is used.</p>
              </div>
              <input
                type="checkbox"
                class="cb-switch"
                aria-label="Analytics cookies"
                [checked]="analytics"
                (change)="analytics = $any($event.target).checked"
              />
            </li>
            <li class="cb-cat">
              <div>
                <p class="cb-cat-name">Marketing</p>
                <p class="cb-cat-desc">Helps us measure our ads and show relevant ones.</p>
              </div>
              <input
                type="checkbox"
                class="cb-switch"
                aria-label="Marketing cookies"
                [checked]="marketing"
                (change)="marketing = $any($event.target).checked"
              />
            </li>
          </ul>
        }
        </div>

        <div class="cb-actions">
          <button type="button" class="cb-btn cb-btn-outline" (click)="consent.rejectNonEssential()">
            Reject non-essential
          </button>
          @if (consent.showPreferences()) {
            <button type="button" class="cb-btn cb-btn-outline" (click)="saveChoices()">
              Save choices
            </button>
          } @else {
            <button type="button" class="cb-btn cb-btn-outline" (click)="customize()">
              Customize
            </button>
          }
          <button type="button" class="cb-btn cb-btn-primary" (click)="consent.acceptAll()">
            Accept all
          </button>
        </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .cb {
        position: fixed;
        z-index: 70;
        left: 12px;
        right: 12px;
        bottom: 12px;
        margin: 0 auto;
        max-width: 1100px;
        padding: 12px 14px;
        background: #ffffff;
        color: var(--ink);
        border: 1px solid rgba(22, 40, 60, 0.12);
        border-radius: 16px;
        box-shadow:
          0 2px 8px rgba(12, 33, 53, 0.1),
          0 16px 40px rgba(12, 33, 53, 0.22);
        max-height: 80vh;
        overflow-y: auto;
      }
      .cb-inner {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      @media (min-width: 640px) {
        .cb {
          bottom: 20px;
          padding: 12px 16px;
        }
        .cb-inner {
          flex-direction: row;
          align-items: center;
          gap: 14px;
        }
      }
      .cb-main {
        flex: 1;
        min-width: 0;
      }
      .cb-icon {
        display: none;
        flex-shrink: 0;
        align-items: center;
        justify-content: center;
        width: 30px;
        height: 30px;
        border-radius: 9999px;
        background: rgba(232, 119, 34, 0.14);
        color: var(--saffron-deep);
      }
      @media (min-width: 768px) {
        .cb-icon {
          display: inline-flex;
        }
      }
      .cb-icon i {
        font-size: 18px;
        width: 18px;
        height: 18px;
        line-height: 1;
      }
      .cb-title {
        font-family: var(--font-display);
        font-size: 0.875rem;
        font-weight: 600;
        line-height: 1.3;
        color: var(--ink);
        margin-bottom: 1px;
      }
      .cb-text {
        font-size: 12.5px;
        line-height: 1.5;
        color: rgba(22, 40, 60, 0.78);
      }
      .cb-link {
        font-weight: 600;
        color: var(--brand-navy);
        text-decoration: underline;
        text-underline-offset: 2px;
      }
      .cb-link:hover {
        color: var(--saffron-deep);
      }

      .cb-cats {
        display: flex;
        flex-direction: column;
        margin: 12px 0 0;
        max-width: 640px;
        border: 1px solid rgba(22, 40, 60, 0.1);
        border-radius: 10px;
      }
      .cb-cat {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 12px 14px;
      }
      .cb-cat + .cb-cat {
        border-top: 1px solid rgba(22, 40, 60, 0.08);
      }
      .cb-cat-name {
        font-size: 14px;
        font-weight: 700;
        color: var(--ink);
      }
      .cb-cat-desc {
        margin-top: 2px;
        font-size: 12.5px;
        line-height: 1.5;
        color: rgba(22, 40, 60, 0.66);
      }
      .cb-switch {
        appearance: none;
        flex-shrink: 0;
        position: relative;
        width: 42px;
        height: 24px;
        border-radius: 9999px;
        background: rgba(22, 40, 60, 0.25);
        cursor: pointer;
        transition: background-color 0.15s ease;
      }
      .cb-switch::after {
        content: '';
        position: absolute;
        top: 3px;
        left: 3px;
        width: 18px;
        height: 18px;
        border-radius: 9999px;
        background: #ffffff;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
        transition: transform 0.15s ease;
      }
      .cb-switch:checked {
        background: var(--brand-navy);
      }
      .cb-switch:checked::after {
        transform: translateX(18px);
      }
      .cb-switch:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }
      .cb-switch:focus-visible {
        outline: 2px solid var(--saffron);
        outline-offset: 2px;
      }

      .cb-actions {
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: 8px;
        flex-shrink: 0;
      }
      .cb-btn {
        min-height: 32px;
        padding: 4px 12px;
        border-radius: 9999px;
        font-family: 'Inter', sans-serif;
        font-size: 12.5px;
        font-weight: 700;
        white-space: nowrap;
        cursor: pointer;
        border: 1.5px solid var(--ink);
        transition:
          background-color 0.15s ease,
          color 0.15s ease,
          border-color 0.15s ease;
      }
      .cb-btn:focus-visible {
        outline: 2px solid var(--brand-navy);
        outline-offset: 2px;
      }
      .cb-btn-outline {
        background: transparent;
        color: var(--ink);
      }
      .cb-btn-outline:hover {
        background: var(--ink);
        color: var(--ivory);
      }
      .cb-btn-primary {
        background: var(--saffron);
        border-color: var(--saffron);
        color: var(--navy-900);
      }
      .cb-btn-primary:hover {
        background: var(--ink);
        border-color: var(--ink);
        color: var(--ivory);
      }
    `,
  ],
})
export class CookieBannerComponent {
  protected readonly consent = inject(ConsentService);

  protected analytics = false;
  protected marketing = false;

  constructor() {
    // Start the switches from the saved choice whenever the banner opens.
    effect(() => {
      if (!this.consent.bannerOpen()) return;
      const c = this.consent.choice();
      this.analytics = c?.analytics ?? false;
      this.marketing = c?.marketing ?? false;
    });
  }

  protected customize(): void {
    this.consent.showPreferences.set(true);
  }

  protected saveChoices(): void {
    this.consent.save({ analytics: this.analytics, marketing: this.marketing });
  }
}
