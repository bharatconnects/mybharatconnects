import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsMongoId,
  IsOptional,
} from 'class-validator';

export class SetDocumentsVisibilityDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsMongoId({ each: true })
  documentIds: string[];

  @IsBoolean()
  @IsOptional()
  clientVisible?: boolean;

  @IsBoolean()
  @IsOptional()
  vendorVisible?: boolean;
}
