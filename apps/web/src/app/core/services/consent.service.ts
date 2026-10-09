import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ConsentChoice {
  analytics: boolean;
  marketing: boolean;
}

interface StoredConsent extends ConsentChoice {
  v: number;
  at: string;
}

type Gtag = (...args: unknown[]) => void;
type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[];
  push: unknown;
  loaded: boolean;
  version: string;
};

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

const STORAGE_KEY = 'mbc_cookie_consent';
/** Bump when the categories change so everyone is asked again. */
const CONSENT_VERSION = 1;
/** First-time visitors see the banner after this delay, not on page load. */
const BANNER_DELAY_MS = 5000;

/**
 * Cookie consent for the public site. Nothing beyond essential storage runs
 * until the visitor opts in: Google Analytics and Google Ads load only with
 * analytics/marketing consent respectively, and the Meta Pixel only with
 * marketing consent. Choices are kept in localStorage and can be changed any
 * time from the footer ("Cookie settings").
 *
 * Tags are configured through environment.googleAnalyticsId / googleAdsId /
 * metaPixelId. Any that is empty is skipped, so the banner works (and the
 * policy stays truthful) before the accounts exist.
 *
 * Google tags are driven through Consent Mode v2: the default state is
 * denied, then updated to match the visitor's choice.
 */
@Injectable({ providedIn: 'root' })
export class ConsentService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly router = inject(Router);

  /** The saved choice, or null while the visitor hasn't decided. */
  readonly choice = signal<ConsentChoice | null>(null);
  readonly bannerOpen = signal(false);
  /** Opens the banner straight on the category toggles. */
  readonly showPreferences = signal(false);

  private gtagLoaded = false;
  private configured = new Set<string>();
  private pixelLoaded = false;
  private routerHooked = false;

  init(): void {
    if (!this.isBrowser) return;
    const saved = this.read();
    if (saved) {
      this.choice.set(saved);
      this.apply(saved);
    } else {
      setTimeout(() => {
        // Skip if they already chose or opened it from the footer meanwhile.
        if (!this.choice()) this.bannerOpen.set(true);
      }, BANNER_DELAY_MS);
    }
  }

  acceptAll(): void {
    this.commit({ analytics: true, marketing: true });
  }

  rejectNonEssential(): void {
    this.commit({ analytics: false, marketing: false });
  }

  save(choice: ConsentChoice): void {
    this.commit(choice);
  }

  /** Re-opens the banner (footer "Cookie settings" link). */
  openPreferences(): void {
    this.showPreferences.set(true);
    this.bannerOpen.set(true);
  }

  private commit(choice: ConsentChoice): void {
    const previous = this.choice();
    this.choice.set(choice);
    this.bannerOpen.set(false);
    this.showPreferences.set(false);
    try {
      const stored: StoredConsent = { ...choice, v: CONSENT_VERSION, at: new Date().toISOString() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    } catch {
      // Storage blocked: the choice still applies for this page view.
    }
    this.apply(choice, previous);
  }

  private read(): ConsentChoice | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw) as Partial<StoredConsent>;
      if (s.v !== CONSENT_VERSION) return null;
      return { analytics: !!s.analytics, marketing: !!s.marketing };
    } catch {
      return null;
    }
  }

  // ── Applying the choice ────────────────────────────────────────────────

  private apply(choice: ConsentChoice, previous: ConsentChoice | null = null): void {
    const { googleAnalyticsId: ga, googleAdsId: ads, metaPixelId: pixel } = environment;

    if (ga || ads) {
      this.ensureGtag();
      this.gtag('consent', 'update', {
        analytics_storage: choice.analytics ? 'granted' : 'denied',
        ad_storage: choice.marketing ? 'granted' : 'denied',
        ad_user_data: choice.marketing ? 'granted' : 'denied',
        ad_personalization: choice.marketing ? 'granted' : 'denied',
      });
      // Standard order: gtag("js") first, then each "config".
      if ((choice.analytics && ga) || (choice.marketing && ads)) this.loadGtagScript(ga || ads);
      if (choice.analytics && ga) this.configure(ga);
      if (choice.marketing && ads) this.configure(ads);
    }

    if (pixel) {
      if (choice.marketing) {
        this.loadPixel(pixel);
        window.fbq?.('consent', 'grant');
      } else if (this.pixelLoaded) {
        window.fbq?.('consent', 'revoke');
      }
    }

    // Withdrawing consent also clears what was already set.
    if (previous?.analytics && !choice.analytics) this.clearCookies(['_ga', '_gid', '_gat']);
    if (previous?.marketing && !choice.marketing) {
      this.clearCookies(['_gcl_', '_fbp', '_fbc', 'IDE', 'test_cookie']);
    }
  }

  private ensureGtag(): void {
    if (window.gtag) return;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() {
      // Google's loader reads the raw `arguments` object, not an array.
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments);
    };
    this.gtag('consent', 'default', {
      analytics_storage: 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      wait_for_update: 500,
    });
  }

  private gtag(...args: unknown[]): void {
    window.gtag?.(...args);
  }

  private loadGtagScript(id: string): void {
    if (this.gtagLoaded) return;
    this.gtagLoaded = true;
    this.gtag('js', new Date());
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
    document.head.appendChild(s);
  }

  private configure(id: string): void {
    if (this.configured.has(id)) return;
    this.configured.add(id);
    this.gtag('config', id);
  }

  private loadPixel(id: string): void {
    if (this.pixelLoaded) return;
    this.pixelLoaded = true;

    // Meta's standard base code, typed.
    const fbq = function (...args: unknown[]) {
      if (fbq.callMethod) fbq.callMethod(...args);
      else fbq.queue.push(args);
    } as Fbq;
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = '2.0';
    fbq.queue = [];
    window.fbq = fbq;
    window._fbq = fbq;

    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://connect.facebook.net/en_US/fbevents.js';
    document.head.appendChild(s);

    fbq('init', id);
    fbq('track', 'PageView');

    // The pixel doesn't see SPA route changes on its own.
    if (!this.routerHooked) {
      this.routerHooked = true;
      let first = true;
      this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => {
        if (first) {
          first = false;
          return;
        }
        if (this.choice()?.marketing) window.fbq?.('track', 'PageView');
      });
    }
  }

  private clearCookies(prefixes: string[]): void {
    const host = location.hostname;
    const parts = host.split('.');
    const domains = [host, `.${host}`];
    if (parts.length > 2) domains.push(`.${parts.slice(-2).join('.')}`);
    else domains.push(`.${host}`);
    for (const pair of document.cookie.split(';')) {
      const name = pair.split('=')[0].trim();
      if (!prefixes.some((p) => name === p || name.startsWith(p))) continue;
      for (const d of domains) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${d}`;
      }
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    }
  }
}
