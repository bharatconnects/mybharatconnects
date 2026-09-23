import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsMongoId,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class VendorInvoiceItemDto {
  @IsString()
  description: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;
}

export class CreateVendorInvoiceDto {
  @IsMongoId()
  caseId: string;

  @IsMongoId()
  quoteId: string;

  // Required for MILESTONE quotes (the milestone must already be PAID),
  // must be omitted for FIXED quotes — validated in the service, not here,
  // since the rule depends on the quote's type.
  @IsMongoId()
  @IsOptional()
  milestoneId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => VendorInvoiceItemDto)
  items: VendorInvoiceItemDto[];

  @IsNumber()
  @Min(0)
  @IsOptional()
  gstRate?: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;

  @IsMongoId()
  @IsOptional()
  attachmentDocumentId?: string;
}
