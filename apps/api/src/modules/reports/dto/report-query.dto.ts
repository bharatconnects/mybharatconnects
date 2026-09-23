import { IsDateString, IsMongoId, IsOptional, IsString } from 'class-validator';
import { CaseStatus } from '../../../common/enums/case-status.enum';

export class CasesReportQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsString()
  status?: CaseStatus | string;

  @IsOptional()
  @IsMongoId()
  caseManagerId?: string;

  @IsOptional()
  @IsString()
  cluster?: string;
}

export class FinanceReportQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

export class QuotesByOutcomeQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
