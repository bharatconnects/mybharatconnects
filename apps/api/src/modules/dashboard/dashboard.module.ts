import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { Case, CaseSchema } from '../cases/schemas/case.schema';
import { Lead, LeadSchema } from '../leads/schemas/lead.schema';
import { Payment, PaymentSchema } from '../payments/schemas/payment.schema';
import { QaReview, QaReviewSchema } from '../qa/schemas/qa-review.schema';
import { Complaint, ComplaintSchema } from '../feedback/schemas/complaint.schema';
import { Property, PropertySchema } from '../property/schemas/property.schema';
import { RentPayment, RentPaymentSchema } from '../property/schemas/rent-payment.schema';
import { Rating, RatingSchema } from '../feedback/schemas/rating.schema';
import { Vendor, VendorSchema } from '../vendors/schemas/vendor.schema';
import { Frq, FrqSchema } from '../frq/schemas/frq.schema';
import { Quote, QuoteSchema } from '../quotes/schemas/quote.schema';
import {
  Invoice,
  InvoiceSchema,
} from '../invoicing/schemas/invoice.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import {
  Document as CaseDocumentEntity,
  DocumentSchema as CaseDocumentSchema,
} from '../documents/schemas/document.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Case.name, schema: CaseSchema },
      { name: Lead.name, schema: LeadSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: QaReview.name, schema: QaReviewSchema },
      { name: Complaint.name, schema: ComplaintSchema },
      { name: Property.name, schema: PropertySchema },
      { name: RentPayment.name, schema: RentPaymentSchema },
      { name: Rating.name, schema: RatingSchema },
      { name: Vendor.name, schema: VendorSchema },
      { name: Frq.name, schema: FrqSchema },
      { name: Quote.name, schema: QuoteSchema },
      { name: Invoice.name, schema: InvoiceSchema },
      { name: User.name, schema: UserSchema },
      { name: CaseDocumentEntity.name, schema: CaseDocumentSchema },
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
