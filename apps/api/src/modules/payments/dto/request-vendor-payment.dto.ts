import { IsInt, IsMongoId, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class RequestVendorPaymentDto {
  @IsMongoId()
  caseId: string;

  @IsInt()
  @Min(1)
  amountInPaise: number;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsMongoId()
  @IsOptional()
  milestoneId?: string;
}
