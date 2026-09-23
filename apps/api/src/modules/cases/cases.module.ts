import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CasesController } from './cases.controller';
import { CasesService } from './cases.service';
import { Case, CaseSchema } from './schemas/case.schema';
import { Counter, CounterSchema } from './schemas/counter.schema';
import { NotificationsModule } from '../notifications/notifications.module';
import {
  Document,
  DocumentSchema,
} from '../documents/schemas/document.schema';
import { DocumentsModule } from '../documents/documents.module';
import { Vendor, VendorSchema } from '../vendors/schemas/vendor.schema';
import { Quote, QuoteSchema } from '../quotes/schemas/quote.schema';
import {
  ActionItem,
  ActionItemSchema,
} from '../action-items/schemas/action-item.schema';
import { Lead, LeadSchema } from '../leads/schemas/lead.schema';
import { UsersModule } from '../users/users.module';
import { CasesListener } from './cases.listener';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Case.name, schema: CaseSchema },
      { name: Counter.name, schema: CounterSchema },
      { name: Document.name, schema: DocumentSchema },
      { name: Vendor.name, schema: VendorSchema },
      { name: Quote.name, schema: QuoteSchema },
      { name: ActionItem.name, schema: ActionItemSchema },
      { name: Lead.name, schema: LeadSchema },
    ]),
    NotificationsModule,
    UsersModule,
    DocumentsModule,
  ],
  controllers: [CasesController],
  providers: [CasesService, CasesListener],
  exports: [CasesService],
})
export class CasesModule {}
