import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { QA_REVIEW_TYPES } from '../schemas/qa-review.schema';
import type { QaReviewType } from '../schemas/qa-review.schema';

export class CreateQaReviewDto {
  @IsMongoId()
  caseId: string;

  // Omit to open both reviews for the case.
  @IsEnum(QA_REVIEW_TYPES)
  @IsOptional()
  reviewType?: QaReviewType;
}

export class ChecklistEntryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  item: string;

  @IsBoolean()
  isPassed: boolean;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  note?: string;
}

export class UpdateChecklistDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ChecklistEntryDto)
  checklist: ChecklistEntryDto[];
}

export class ApproveReviewDto {
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  note?: string;
}

export class RejectReviewDto {
  @IsString()
  @MinLength(5, { message: 'Say what needs to change (at least 5 characters)' })
  @MaxLength(2000)
  reason: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  rejectedItems?: string[];
}
