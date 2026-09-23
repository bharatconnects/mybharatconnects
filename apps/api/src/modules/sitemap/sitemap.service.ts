import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface SitemapUrl {
  loc: string;
  lastmod?: string;
  changefreq?: string;
  priority?: string;
}

const STATIC_PATHS: { path: string; changefreq: string; priority: string }[] = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/services', changefreq: 'monthly', priority: '0.9' },
  { path: '/services/tax-compliance', changefreq: 'monthly', priority: '0.8' },
  { path: '/services/wealth-management', changefreq: 'monthly', priority: '0.8' },
  { path: '/services/real-estate', changefreq: 'monthly', priority: '0.8' },
  { path: '/services/legal-documents', changefreq: 'monthly', priority: '0.8' },
  { path: '/about', changefreq: 'monthly', priority: '0.8' },
  { path: '/blog', changefreq: 'monthly', priority: '0.5' },
];

const CACHE_TTL_MS = 5 * 60 * 1000;

@Injectable()
export class SitemapService {
  private cachedXml: string | null = null;
  private cachedAt = 0;
  private readonly siteUrl: string;

  constructor(config: ConfigService) {
    this.siteUrl = (config.get<string>('FRONTEND_URL') ?? 'https://mybharatconnects.com').replace(
      /\/+$/,
      '',
    );
  }

  async generate(): Promise<string> {
    const now = Date.now();
    if (this.cachedXml && now - this.cachedAt < CACHE_TTL_MS) {
      return this.cachedXml;
    }

    const urls: SitemapUrl[] = STATIC_PATHS.map((p) => ({
      loc: `${this.siteUrl}${p.path}`,
      changefreq: p.changefreq,
      priority: p.priority,
    }));

    const xml = this.toXml(urls);
    this.cachedXml = xml;
    this.cachedAt = now;
    return xml;
  }

  private toXml(urls: SitemapUrl[]): string {
    const entries = urls
      .map((u) => {
        const parts = [`    <loc>${this.escapeXml(u.loc)}</loc>`];
        if (u.lastmod) parts.push(`    <lastmod>${u.lastmod}</lastmod>`);
        if (u.changefreq) parts.push(`    <changefreq>${u.changefreq}</changefreq>`);
        if (u.priority) parts.push(`    <priority>${u.priority}</priority>`);
        return `  <url>\n${parts.join('\n')}\n  </url>`;
      })
      .join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>`;
  }

  private escapeXml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
