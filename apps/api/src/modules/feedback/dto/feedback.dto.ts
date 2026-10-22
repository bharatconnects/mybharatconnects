import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

// The customer's sharing choices. Every field is optional on update; on a new
// review anything left out counts as "do not share".
export class ShareConsentDto {
  @IsBoolean()
  @IsOptional()
  name?: boolean;

  @IsBoolean()
  @IsOptional()
  location?: boolean;

  @IsBoolean()
  @IsOptional()
  service?: boolean;

  @IsBoolean()
  @IsOptional()
  publish?: boolean;
}

export class SubmitPlatformRatingDto {
  @IsInt()
  @Min(1)
  @Max(5)
  starRating: number;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  comment?: string;

  @IsMongoId()
  @IsOptional()
  caseId?: string;

  // Shown next to the review if (and only if) the customer agrees below.
  @IsString()
  @IsOptional()
  @MaxLength(80)
  displayName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(80)
  location?: string;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  serviceLabel?: string;

  @ValidateNested()
  @Type(() => ShareConsentDto)
  @IsOptional()
  share?: ShareConsentDto;
}

export class CriterionRatingDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  criterion: string;

  @IsInt()
  @Min(1)
  @Max(5)
  score: number;
}

// Rating of the case manager or the vendor on a specific case.
export class SubmitTargetRatingDto {
  @IsMongoId()
  caseId: string;

  @IsInt()
  @Min(0)
  @Max(10)
  @IsOptional()
  npsScore?: number;

  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  starRating?: number;

  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => CriterionRatingDto)
  @IsOptional()
  criteriaRatings?: CriterionRatingDto[];

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  comment?: string;
}

export class CreateTestimonialBodyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  clientName: string;

  @IsString()
  @IsOptional()
  @MaxLength(80)
  clientCountry?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content: string;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  serviceType?: string;
}

export class PrefillQueryDto {
  @IsMongoId()
  @IsOptional()
  caseId?: string;
}
