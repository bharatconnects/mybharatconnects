import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { S3Service } from './documents.s3.service';
import { Document, DocumentSchema } from './schemas/document.schema';
import { Case, CaseSchema } from '../cases/schemas/case.schema';
import { Vendor, VendorSchema } from '../vendors/schemas/vendor.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Document.name, schema: DocumentSchema },
      { name: Case.name, schema: CaseSchema },
      { name: Vendor.name, schema: VendorSchema },
    ]),
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService, S3Service],
  exports: [DocumentsService, S3Service],
})
export class DocumentsModule {}
