import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';

import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { LeadsModule } from './modules/leads/leads.module';
import { FrqModule } from './modules/frq/frq.module';
import { VendorsModule } from './modules/vendors/vendors.module';
import { QuotesModule } from './modules/quotes/quotes.module';
import { CasesModule } from './modules/cases/cases.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { CrosssellModule } from './modules/crosssell/crosssell.module';
import { QaModule } from './modules/qa/qa.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { PropertyModule } from './modules/property/property.module';
import { FurnishingModule } from './modules/furnishing/furnishing.module';
import { FeedbackModule } from './modules/feedback/feedback.module';
import { ActionItemsModule } from './modules/action-items/action-items.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { SchedulingModule } from './modules/scheduling/scheduling.module';
import { InvoicingModule } from './modules/invoicing/invoicing.module';
import { VendorInvoicingModule } from './modules/vendor-invoicing/vendor-invoicing.module';
import { DisputesModule } from './modules/disputes/disputes.module';
import { ReportsModule } from './modules/reports/reports.module';
import { SitemapModule } from './modules/sitemap/sitemap.module';
import { ThrottlerStorageModule } from './common/throttler/throttler-storage.module';
import { MongoThrottlerStorage } from './common/throttler/mongo-throttler-storage.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGODB_URI'),
      }),
    }),
    ThrottlerStorageModule,
    ThrottlerModule.forRootAsync({
      imports: [ThrottlerStorageModule],
      inject: [ConfigService, MongoThrottlerStorage],
      useFactory: (config: ConfigService, storage: MongoThrottlerStorage) => ({
        // Disable globally when THROTTLE_DISABLED=true (used by the e2e suite
        // so existing auth tests aren't tripped by per-route limits).
        skipIf: () =>
          config.get<string>('THROTTLE_DISABLED', 'false').toLowerCase() ===
          'true',
        throttlers: [
          {
            ttl: config.get<number>('THROTTLE_TTL', 60) * 1000,
            limit: config.get<number>('THROTTLE_LIMIT', 100),
          },
        ],
        // Mongo-backed instead of the default in-memory store — keeps the
        // count consistent across every ECS task instead of each task
        // enforcing the limit independently (see MongoThrottlerStorage).
        storage,
      }),
    }),
    AuthModule,
    UsersModule,
    LeadsModule,
    FrqModule,
    VendorsModule,
    QuotesModule,
    CasesModule,
    DocumentsModule,
    PaymentsModule,
    NotificationsModule,
    CrosssellModule,
    QaModule,
    DashboardModule,
    PropertyModule,
    FurnishingModule,
    FeedbackModule,
    ActionItemsModule,
    TasksModule,
    SchedulingModule,
    InvoicingModule,
    VendorInvoicingModule,
    DisputesModule,
    ReportsModule,
    SitemapModule,
  ],
  controllers: [AppController],
  providers: [
    // Enforce ThrottlerModule limits + per-route @Throttle overrides globally.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
