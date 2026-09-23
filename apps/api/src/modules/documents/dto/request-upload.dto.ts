import { IsString, IsEnum, IsNumber, IsMongoId, Min, Max } from 'class-validator';
import { DocumentCategory } from '../schemas/document.schema';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export class RequestUploadDto {
  @IsMongoId()
  caseId: string;

  @IsEnum(DocumentCategory)
  category: DocumentCategory;

  @IsString()
  name: string;

  @IsString()
  originalFileName: string;

  @IsString()
  mimeType: string;

  @IsNumber()
  @Min(1)
  @Max(MAX_UPLOAD_BYTES)
  sizeBytes: number;
}
