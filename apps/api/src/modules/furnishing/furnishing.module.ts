import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FurnishingController } from './furnishing.controller';
import { FurnishingService } from './furnishing.service';
import {
  FurnishingCatalogue,
  FurnishingCatalogueSchema,
} from './schemas/furnishing-catalogue.schema';
import {
  FurnishingRequest,
  FurnishingRequestSchema,
} from './schemas/furnishing-request.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: FurnishingCatalogue.name, schema: FurnishingCatalogueSchema },
      { name: FurnishingRequest.name, schema: FurnishingRequestSchema },
    ]),
  ],
  controllers: [FurnishingController],
  providers: [FurnishingService],
  exports: [FurnishingService],
})
export class FurnishingModule {}
