import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { SitemapService } from './sitemap.service';
import { Public } from '../../common/decorators/public.decorator';

@Controller()
export class SitemapController {
  constructor(private readonly sitemapService: SitemapService) {}

  // @Res() bypasses the global TransformInterceptor's {success,data,...}
  // JSON envelope — crawlers need raw XML at this path, not a wrapped
  // response.
  @Get('sitemap.xml')
  @Public()
  async getSitemap(@Res() res: Response) {
    const xml = await this.sitemapService.generate();
    res.setHeader('Content-Type', 'application/xml');
    res.send(xml);
  }
}
