import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { Payment, PaymentSchema } from './schemas/payment.schema';
import { Case, CaseSchema } from '../cases/schemas/case.schema';
import { Vendor, VendorSchema } from '../vendors/schemas/vendor.schema';
import { Quote, QuoteSchema } from '../quotes/schemas/quote.schema';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: Payment.name, schema: PaymentSchema },
      { name: Case.name, schema: CaseSchema },
      { name: Vendor.name, schema: VendorSchema },
      { name: Quote.name, schema: QuoteSchema },
    ]),
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
