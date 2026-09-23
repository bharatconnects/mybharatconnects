import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Case, CaseSchema } from '../cases/schemas/case.schema';
import { FeedbackController } from './feedback.controller';
import { FeedbackService } from './feedback.service';
import { Rating, RatingSchema } from './schemas/rating.schema';
import { Testimonial, TestimonialSchema } from './schemas/testimonial.schema';
import { Complaint, ComplaintSchema } from './schemas/complaint.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Rating.name, schema: RatingSchema },
      { name: Testimonial.name, schema: TestimonialSchema },
      { name: Complaint.name, schema: ComplaintSchema },
      { name: Case.name, schema: CaseSchema },
    ]),
  ],
  controllers: [FeedbackController],
  providers: [FeedbackService],
  exports: [FeedbackService],
})
export class FeedbackModule {}
