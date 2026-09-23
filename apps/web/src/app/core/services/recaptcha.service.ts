import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../../environments/environment';

declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void;
      execute: (siteKey: string, opts: { action: string }) => Promise<string>;
    };
  }
}

// Loads Google's reCAPTCHA v3 script once and executes it on demand for a
// given form action. Backed by RecaptchaService on the API side, which
// verifies the returned token server-side — this class only ever produces
// a token, it never decides whether a submission is accepted.
//
// No-ops (resolves undefined) whenever environment.recaptchaSiteKey is
// unset — true in every environment except production, since the
// registered site key is scoped to mybharatconnects.com. Mirrors the
// backend's own graceful-skip-when-unconfigured behavior.
@Injectable({ providedIn: 'root' })
export class RecaptchaService {
  private readonly isBrowser: boolean;
  private scriptLoadPromise: Promise<void> | null = null;

  constructor(@Inject(PLATFORM_ID) platformId: object) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  async execute(action: string): Promise<string | undefined> {
    if (!this.isBrowser || !environment.recaptchaSiteKey) {
      return undefined;
    }

    await this.loadScript();

    return new Promise<string | undefined>((resolve) => {
      window.grecaptcha!.ready(() => {
        window
          .grecaptcha!.execute(environment.recaptchaSiteKey, { action })
          .then(resolve)
          // A blocked/failed reCAPTCHA load shouldn't be why a real user
          // can't submit a form — fail open and let the backend's own
          // "token missing" handling decide (it only hard-rejects when
          // RECAPTCHA_SECRET_KEY is actually configured there too).
          .catch(() => resolve(undefined));
      });
    });
  }

  private loadScript(): Promise<void> {
    if (window.grecaptcha) {
      return Promise.resolve();
    }
    if (this.scriptLoadPromise) {
      return this.scriptLoadPromise;
    }

    this.scriptLoadPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `https://www.google.com/recaptcha/api.js?render=${environment.recaptchaSiteKey}`;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load reCAPTCHA script'));
      document.head.appendChild(script);
    }).catch(() => {
      // Same fail-open reasoning as execute()'s catch — swallow here too so
      // a network hiccup loading the script doesn't reject every caller.
      this.scriptLoadPromise = null;
    });

    return this.scriptLoadPromise;
  }
}
