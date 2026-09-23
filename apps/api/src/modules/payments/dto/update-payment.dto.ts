import { IsEnum, IsInt, IsMongoId, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import type { PaymentPurpose } from '../schemas/payment.schema';

const PAYMENT_PURPOSES: PaymentPurpose[] = ['TOKEN', 'PARTIAL', 'MILESTONE', 'FULL'];

export class UpdatePaymentDto {
  @IsInt()
  @Min(1)
  @IsOptional()
  amountInPaise?: number;

  @IsEnum(PAYMENT_PURPOSES)
  @IsOptional()
  purpose?: PaymentPurpose;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  description?: string;

  @IsMongoId()
  @IsOptional()
  milestoneId?: string;
}
