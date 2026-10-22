import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class UpdatePaymentPolicyDto {
  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  advancePercent?: number;

  @IsBoolean()
  @IsOptional()
  finalPaymentGateEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  deliveryGateEnabled?: boolean;

  @IsInt()
  @Min(1)
  @Max(720)
  @IsOptional()
  closeWindowHours?: number;

  @IsString()
  @MaxLength(500)
  @IsOptional()
  note?: string;
}
