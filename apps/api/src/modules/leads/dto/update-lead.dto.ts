import { PartialType } from '@nestjs/mapped-types';
import {
  IsDateString,
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
  IsUrl,
} from 'class-validator';
import { LeadStatus } from '../schemas/lead.schema';
import { CreateLeadDto } from './create-lead.dto';

export class UpdateLeadDto extends PartialType(CreateLeadDto) {
  @IsEnum(LeadStatus)
  @IsOptional()
  status?: LeadStatus;

  @IsString()
  @IsOptional()
  lostReason?: string;

  @IsMongoId()
  @IsOptional()
  assignedCaseManager?: string;

  @IsString()
  @IsOptional()
  actionTaken?: string;

  @IsDateString()
  @IsOptional()
  actionDate?: string;

  @IsUrl({ require_tld: false }, { message: 'meetingLink must be a valid URL' })
  @IsOptional()
  meetingLink?: string;

  @IsDateString()
  @IsOptional()
  nextFollowUpAt?: string;

  @IsString()
  @IsOptional()
  internalNote?: string;
}
