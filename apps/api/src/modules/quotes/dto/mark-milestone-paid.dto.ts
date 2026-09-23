import { IsMongoId, IsOptional } from 'class-validator';

export class MarkMilestonePaidDto {
  @IsMongoId()
  @IsOptional()
  receiptDocumentId?: string;
}
