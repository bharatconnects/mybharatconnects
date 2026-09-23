import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { MarginType } from '../schemas/quote.schema';

export class ClientQuoteItemDto {
  @IsString()
  description: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  // Used as-is only when marginType/marginValue aren't given — i.e. for a
  // line the CM added beyond the vendor's own item count, with no vendor
  // price to mark up from. Otherwise the server recomputes this from the
  // vendor's current item at the same position.
  @IsNumber()
  @Min(0)
  unitPrice: number;

  @IsEnum(MarginType)
  @IsOptional()
  marginType?: MarginType;

  @IsNumber()
  @IsOptional()
  marginValue?: number;
}

export class UpdateClientQuoteDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ClientQuoteItemDto)
  items: ClientQuoteItemDto[];

  @IsNumber()
  @Min(0)
  @IsOptional()
  taxPercent?: number;

  @IsString()
  @IsOptional()
  currency?: string;
}
