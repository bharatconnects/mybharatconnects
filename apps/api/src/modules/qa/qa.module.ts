import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { QaController } from './qa.controller';
import { QaService } from './qa.service';
import { QaReview, QaReviewSchema } from './schemas/qa-review.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: QaReview.name, schema: QaReviewSchema },
    ]),
  ],
  controllers: [QaController],
  providers: [QaService],
  exports: [QaService],
})
export class QaModule {}
