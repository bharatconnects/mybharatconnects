import { PartialType } from '@nestjs/mapped-types';
import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';
import { FrqStatus } from '../schemas/frq.schema';
import { CreateFrqDto } from './create-frq.dto';

export class UpdateFrqDto extends PartialType(CreateFrqDto) {
  @IsEnum(FrqStatus)
  @IsOptional()
  status?: FrqStatus;
}

export class CompleteFrqDto {
  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  crossSellOpportunities?: string[];
}
