import { PartialType } from '@nestjs/mapped-types';
import { IsString, IsOptional, IsArray } from 'class-validator';
import { CreateCaseDto } from './create-case.dto';

export class UpdateCaseDto extends PartialType(CreateCaseDto) {
  @IsString()
  @IsOptional()
  caseManagerId?: string;

  @IsString()
  @IsOptional()
  vendorId?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsString()
  @IsOptional()
  internalNotes?: string;
}
