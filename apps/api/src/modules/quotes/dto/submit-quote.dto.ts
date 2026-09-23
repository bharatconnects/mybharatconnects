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
import { QuoteItemDto } from './create-quote.dto';
import { MilestoneAmountType, QuoteType } from '../schemas/quote.schema';

export class MilestoneInputDto {
  @IsString()
  title: string;

  @IsEnum(MilestoneAmountType)
  amountType: MilestoneAmountType;

  @IsNumber()
  @Min(0)
  amountValue: number;
}

export class SubmitQuoteDto {
  @IsEnum(QuoteType)
  @IsOptional()
  quoteType?: QuoteType;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuoteItemDto)
  items: QuoteItemDto[];

  @IsNumber()
  @Min(0)
  @IsOptional()
  taxPercent?: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MilestoneInputDto)
  @IsOptional()
  milestones?: MilestoneInputDto[];
}
