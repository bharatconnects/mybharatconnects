import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class InviteQuotesDto {
  @IsMongoId()
  caseId: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsMongoId({ each: true })
  vendorIds: string[];

  @IsInt()
  @Min(1)
  @IsOptional()
  respondByHours?: number;

  @IsString()
  @IsOptional()
  note?: string;
}
