import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Case, CaseSchema } from '../cases/schemas/case.schema';
import { Vendor, VendorSchema } from '../vendors/schemas/vendor.schema';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsModule } from '../payments/payments.module';
import { QuotesController } from './quotes.controller';
import { QuotesService } from './quotes.service';
import { QuotesListener } from './quotes.listener';
import { Quote, QuoteSchema } from './schemas/quote.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Quote.name, schema: QuoteSchema },
      { name: Case.name, schema: CaseSchema },
      { name: Vendor.name, schema: VendorSchema },
    ]),
    UsersModule,
    NotificationsModule,
    PaymentsModule,
  ],
  controllers: [QuotesController],
  providers: [QuotesService, QuotesListener],
  exports: [QuotesService],
})
export class QuotesModule {}
