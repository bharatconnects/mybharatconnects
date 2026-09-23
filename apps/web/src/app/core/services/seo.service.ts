import { DOCUMENT } from '@angular/common';
import { Inject, Injectable } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { environment } from '../../../environments/environment';

export interface PageSeoInput {
  title: string;
  description: string;
  /** Path only, e.g. "/blog/my-post" — joined with environment.siteUrl. */
  canonicalPath: string;
  ogImage?: string;
  jsonLd?: object;
}

const JSON_LD_SCRIPT_ID = 'app-seo-jsonld';
const CANONICAL_LINK_ID = 'app-seo-canonical';

// Formalizes what 6+ public page components previously did ad hoc (each
// injecting Title/Meta directly and calling setTitle/updateTag inline).
// Title/Meta/DOCUMENT are Angular's DI abstractions over document.title/
// <meta>/the DOM — safe to use during SSR (platform-server provides a real
// implementation), unlike touching the raw `document` global directly.
@Injectable({ providedIn: 'root' })
export class SeoService {
  constructor(
    private readonly title: Title,
    private readonly meta: Meta,
    @Inject(DOCUMENT) private readonly document: Document,
  ) {}

  setPageSeo(input: PageSeoInput): void {
    const canonicalUrl = `${environment.siteUrl}${input.canonicalPath}`;

    this.title.setTitle(input.title);
    this.meta.updateTag({ name: 'description', content: input.description });
    this.meta.updateTag({ property: 'og:title', content: input.title });
    this.meta.updateTag({ property: 'og:description', content: input.description });
    this.meta.updateTag({ property: 'og:url', content: canonicalUrl });
    this.meta.updateTag({ property: 'og:type', content: 'article' });
    this.meta.updateTag({
      name: 'twitter:card',
      content: input.ogImage ? 'summary_large_image' : 'summary',
    });
    this.meta.updateTag({ name: 'twitter:title', content: input.title });
    this.meta.updateTag({ name: 'twitter:description', content: input.description });
    if (input.ogImage) {
      this.meta.updateTag({ property: 'og:image', content: input.ogImage });
      this.meta.updateTag({ name: 'twitter:image', content: input.ogImage });
    }

    this.setCanonicalLink(canonicalUrl);
    this.setJsonLd(input.jsonLd);
  }

  private setCanonicalLink(url: string): void {
    // index.html ships a static placeholder <link rel="canonical"> with no
    // id — reuse it (whatever its id) rather than leaving it in place and
    // appending a second canonical tag, which search engines treat as
    // undefined/unreliable behavior.
    let link = this.document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.document.createElement('link');
      link.id = CANONICAL_LINK_ID;
      link.setAttribute('rel', 'canonical');
      this.document.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }

  private setJsonLd(data?: object): void {
    const existing = this.document.getElementById(JSON_LD_SCRIPT_ID);
    if (existing) existing.remove();
    if (!data) return;

    const script = this.document.createElement('script');
    script.id = JSON_LD_SCRIPT_ID;
    script.setAttribute('type', 'application/ld+json');
    script.text = JSON.stringify(data);
    this.document.head.appendChild(script);
  }
}
