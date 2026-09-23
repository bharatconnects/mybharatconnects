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

export class BillingAddressDto {
  @IsString()
  name: string;

  @IsString()
  line1: string;

  @IsString()
  @IsOptional()
  line2?: string;

  @IsString()
  city: string;

  @IsString()
  state: string;

  @IsString()
  pincode: string;

  @IsString()
  country: string;

  @IsString()
  @IsOptional()
  gstin?: string;
}

export class InvoiceItemDto {
  @IsString()
  description: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;
}

export class CreateInvoiceDto {
  @IsMongoId()
  caseId: string;

  @IsMongoId()
  clientId: string;

  @IsMongoId()
  @IsOptional()
  quoteId?: string;

  @IsObject()
  @ValidateNested()
  @Type(() => BillingAddressDto)
  billingAddress: BillingAddressDto;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items: InvoiceItemDto[];

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

  @IsArray()
  @IsMongoId({ each: true })
  @IsOptional()
  sourceVendorInvoiceIds?: string[];

  @IsMongoId()
  @IsOptional()
  attachmentDocumentId?: string;

  @IsString()
  @IsOptional()
  externalReceiptUrl?: string;

  @IsMongoId()
  @IsOptional()
  sourcePaymentId?: string;
}
