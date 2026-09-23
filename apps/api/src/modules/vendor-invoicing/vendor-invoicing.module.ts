import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Case, CaseSchema } from '../cases/schemas/case.schema';
import { Counter, CounterSchema } from '../cases/schemas/counter.schema';
import { DocumentsModule } from '../documents/documents.module';
import { Quote, QuoteSchema } from '../quotes/schemas/quote.schema';
import { Vendor, VendorSchema } from '../vendors/schemas/vendor.schema';
import { VendorInvoicingController } from './vendor-invoicing.controller';
import { VendorInvoicingService } from './vendor-invoicing.service';
import { VendorInvoice, VendorInvoiceSchema } from './schemas/vendor-invoice.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: VendorInvoice.name, schema: VendorInvoiceSchema },
      { name: Counter.name, schema: CounterSchema },
      { name: Case.name, schema: CaseSchema },
      { name: Quote.name, schema: QuoteSchema },
      { name: Vendor.name, schema: VendorSchema },
    ]),
    DocumentsModule,
  ],
  controllers: [VendorInvoicingController],
  providers: [VendorInvoicingService],
  exports: [VendorInvoicingService],
})
export class VendorInvoicingModule {}
