import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SitemapController } from './sitemap.controller';
import { SitemapService } from './sitemap.service';

@Module({
  imports: [ConfigModule],
  controllers: [SitemapController],
  providers: [SitemapService],
})
export class SitemapModule {}
