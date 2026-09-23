import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Case, CaseSchema } from '../cases/schemas/case.schema';
import { SchedulingController } from './scheduling.controller';
import { SchedulingService } from './scheduling.service';
import {
  AvailabilityWindow,
  AvailabilityWindowSchema,
} from './schemas/availability-window.schema';
import { Booking, BookingSchema } from './schemas/booking.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AvailabilityWindow.name, schema: AvailabilityWindowSchema },
      { name: Booking.name, schema: BookingSchema },
      { name: Case.name, schema: CaseSchema },
    ]),
  ],
  controllers: [SchedulingController],
  providers: [SchedulingService],
  exports: [SchedulingService],
})
export class SchedulingModule {}
