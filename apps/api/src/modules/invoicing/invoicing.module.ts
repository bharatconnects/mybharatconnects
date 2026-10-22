import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Case, CaseSchema } from '../cases/schemas/case.schema';
import { Counter, CounterSchema } from '../cases/schemas/counter.schema';
import { DocumentsModule } from '../documents/documents.module';
import { InvoicingController } from './invoicing.controller';
import { InvoicingService } from './invoicing.service';
import { Invoice, InvoiceSchema } from './schemas/invoice.schema';
import { Payment, PaymentSchema } from '../payments/schemas/payment.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Invoice.name, schema: InvoiceSchema },
      { name: Counter.name, schema: CounterSchema },
      { name: Case.name, schema: CaseSchema },
      { name: Payment.name, schema: PaymentSchema },
    ]),
    DocumentsModule,
  ],
  controllers: [InvoicingController],
  providers: [InvoicingService],
  exports: [InvoicingService],
})
export class InvoicingModule {}
