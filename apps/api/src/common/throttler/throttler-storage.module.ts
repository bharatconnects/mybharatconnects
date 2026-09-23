import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottleHit, ThrottleHitSchema } from './throttle-hit.schema';
import { MongoThrottlerStorage } from './mongo-throttler-storage.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ThrottleHit.name, schema: ThrottleHitSchema },
    ]),
  ],
  providers: [MongoThrottlerStorage],
  exports: [MongoThrottlerStorage],
})
export class ThrottlerStorageModule {}
