import { Type } from 'class-transformer';
import {
  IsDate,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RecordRentPaymentDto {
  @ApiProperty({ description: 'Tenant ID receiving the rent payment' })
  @IsMongoId()
  tenantId: string;

  @ApiProperty({
    description: 'Month identifier for which rent is being recorded (e.g. "2026-06")',
  })
  @IsString()
  month: string;

  @ApiProperty({ description: 'Amount paid (in smallest currency unit-agnostic numeric)' })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({ description: 'Date the rent was due' })
  @IsDate()
  @Type(() => Date)
  dueDate: Date;

  @ApiProperty({ description: 'Date the rent was paid', required: false })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  paidDate?: Date;

  @ApiProperty({ description: 'Payment method (e.g. BANK_TRANSFER, UPI)', required: false })
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @ApiProperty({ description: 'Receipt number for the payment', required: false })
  @IsOptional()
  @IsString()
  receiptNumber?: string;
}
