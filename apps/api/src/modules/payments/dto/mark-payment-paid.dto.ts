import { IsMongoId, IsOptional } from 'class-validator';

export class MarkPaymentPaidDto {
  @IsMongoId()
  @IsOptional()
  receiptDocumentId?: string;
}
