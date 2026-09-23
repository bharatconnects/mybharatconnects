import { IsEnum, IsString, IsOptional } from 'class-validator';
import { CaseStatus } from '../../../common/enums/case-status.enum';

export class TransitionStageDto {
  @IsEnum(CaseStatus)
  newStatus: CaseStatus;

  @IsString()
  @IsOptional()
  note?: string;
}
