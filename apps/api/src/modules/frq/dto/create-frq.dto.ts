import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class PropertyDetailsDto {
  @IsString()
  type: string;

  @IsString()
  location: string;

  @IsNumber()
  budget: number;

  @IsString()
  timeline: string;

  @IsString()
  purpose: string;
}

export class CreateFrqDto {
  @IsMongoId()
  leadId: string;

  @IsMongoId()
  @IsOptional()
  clientId?: string;

  @IsMongoId()
  caseManagerId: string;

  @IsDateString()
  scheduledAt: string;

  @ValidateNested()
  @Type(() => PropertyDetailsDto)
  @IsOptional()
  propertyDetails?: PropertyDetailsDto;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  serviceRequirements?: string[];

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  crossSellOpportunities?: string[];
}
