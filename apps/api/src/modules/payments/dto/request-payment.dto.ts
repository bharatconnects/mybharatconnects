import {
  IsEnum,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import type { PaymentPurpose } from '../schemas/payment.schema';

const PAYMENT_PURPOSES: PaymentPurpose[] = ['TOKEN', 'PARTIAL', 'MILESTONE', 'FULL'];

export class RequestPaymentDto {
  @IsMongoId()
  caseId: string;

  @IsMongoId()
  clientId: string;

  @IsInt()
  @Min(1)
  amountInPaise: number;

  @IsEnum(PAYMENT_PURPOSES)
  purpose: PaymentPurpose;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsMongoId()
  @IsOptional()
  quoteId?: string;

  @IsMongoId()
  @IsOptional()
  milestoneId?: string;
}
