import { IsArray, IsEnum, IsMongoId, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { DisputeType } from '../../disputes/schemas/dispute.schema';

// A client telling us, before the case closes, what is still not right.
export class RaiseIssueDto {
  @IsString()
  @MinLength(10, { message: 'Please describe the problem in at least 10 characters' })
  @MaxLength(2000)
  description: string;

  @IsEnum(DisputeType)
  @IsOptional()
  type?: DisputeType;

  @IsArray()
  @IsMongoId({ each: true })
  @IsOptional()
  evidenceDocumentIds?: string[];
}
