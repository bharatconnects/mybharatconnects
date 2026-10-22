import {
  IsEnum,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import type { OfflinePaymentMethod, PaymentPurpose } from '../schemas/payment.schema';

const PAYMENT_PURPOSES: PaymentPurpose[] = ['TOKEN', 'PARTIAL', 'MILESTONE', 'FULL'];
export const OFFLINE_METHODS: OfflinePaymentMethod[] = [
  'BANK_TRANSFER',
  'UPI',
  'CASH',
  'CHEQUE',
  'OTHER',
];

// A CM recording that a client paid outside Stripe. Nothing here counts as
// money received until an Admin approves it.
export class RequestOfflinePaymentDto {
  @IsMongoId()
  caseId: string;

  @IsInt()
  @Min(1)
  amountInPaise: number;

  @IsEnum(PAYMENT_PURPOSES)
  purpose: PaymentPurpose;

  @IsEnum(OFFLINE_METHODS)
  method: OfflinePaymentMethod;

  // Bank/UPI reference or cheque number. Optional only for cash.
  @ValidateIf((o: RequestOfflinePaymentDto) => o.method !== 'CASH' || !!o.reference)
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  reference?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  description: string;

  // Why this was taken off-platform, for the approving Admin.
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  note: string;

  @IsMongoId()
  @IsOptional()
  proofDocumentId?: string;

  @IsMongoId()
  @IsOptional()
  quoteId?: string;

  @IsMongoId()
  @IsOptional()
  milestoneId?: string;

  // A still-unpaid Stripe request this replaces.
  @IsMongoId()
  @IsOptional()
  supersedesPaymentId?: string;
}

export class DecideOfflinePaymentDto {
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  note?: string;
}

export class RejectOfflinePaymentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  note: string;
}
