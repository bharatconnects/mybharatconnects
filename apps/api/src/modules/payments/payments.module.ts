import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { Payment, PaymentSchema } from './schemas/payment.schema';
import { Case, CaseSchema } from '../cases/schemas/case.schema';
import { Vendor, VendorSchema } from '../vendors/schemas/vendor.schema';
import { Quote, QuoteSchema } from '../quotes/schemas/quote.schema';
import { Document, DocumentSchema } from '../documents/schemas/document.schema';
import { PaymentEvent, PaymentEventSchema } from './schemas/payment-event.schema';
import { PaymentAuditService } from './payment-audit.service';
import { PaymentsListener } from './payments.listener';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: Payment.name, schema: PaymentSchema },
      { name: Case.name, schema: CaseSchema },
      { name: Vendor.name, schema: VendorSchema },
      { name: Quote.name, schema: QuoteSchema },
      { name: Document.name, schema: DocumentSchema },
      { name: PaymentEvent.name, schema: PaymentEventSchema },
    ]),
    UsersModule,
    NotificationsModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentAuditService, PaymentsListener],
  exports: [PaymentsService, PaymentAuditService],
})
export class PaymentsModule {}
