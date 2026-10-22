import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { QaController } from './qa.controller';
import { QaService } from './qa.service';
import { QaReview, QaReviewSchema } from './schemas/qa-review.schema';
import { Case, CaseSchema } from '../cases/schemas/case.schema';
import { Document, DocumentSchema } from '../documents/schemas/document.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: QaReview.name, schema: QaReviewSchema },
      { name: Case.name, schema: CaseSchema },
      { name: Document.name, schema: DocumentSchema },
    ]),
  ],
  controllers: [QaController],
  providers: [QaService],
  exports: [QaService],
})
export class QaModule {}
