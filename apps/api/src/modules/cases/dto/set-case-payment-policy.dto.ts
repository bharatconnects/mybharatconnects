import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export const ADVANCE_MODES = ['PERCENT', 'FIXED'] as const;

// The advance agreed with the client for one case: a percentage of the
// accepted quote, or a fixed amount. Whatever is changed is kept in the case's
// audit log with the reason.
export class SetCasePaymentPolicyDto {
  @IsEnum(ADVANCE_MODES)
  mode: 'PERCENT' | 'FIXED';

  @ValidateIf((o: SetCasePaymentPolicyDto) => o.mode === 'PERCENT')
  @IsInt()
  @Min(0)
  @Max(100)
  advancePercent?: number;

  // Minor units (cents). Required when mode is FIXED.
  @ValidateIf((o: SetCasePaymentPolicyDto) => o.mode === 'FIXED')
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  advanceAmount?: number;

  // Why the advance differs from the default (what was agreed with the client).
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  note: string;

  // What was agreed about paying the remaining amount, if anything.
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  arrangementNote?: string;
}
