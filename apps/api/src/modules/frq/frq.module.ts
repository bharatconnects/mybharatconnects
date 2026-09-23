import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FrqController } from './frq.controller';
import { FrqService } from './frq.service';
import { Frq, FrqSchema } from './schemas/frq.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Frq.name, schema: FrqSchema }]),
  ],
  controllers: [FrqController],
  providers: [FrqService],
  exports: [FrqService],
})
export class FrqModule {}
