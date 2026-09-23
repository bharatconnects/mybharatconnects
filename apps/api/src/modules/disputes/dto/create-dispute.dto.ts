import {
  IsArray,
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
} from 'class-validator';
import { DisputeType } from '../schemas/dispute.schema';

export class CreateDisputeDto {
  @IsMongoId()
  caseId: string;

  @IsEnum(DisputeType)
  type: DisputeType;

  @IsString()
  description: string;

  @IsArray()
  @IsMongoId({ each: true })
  @IsOptional()
  evidenceDocumentIds?: string[];
}
