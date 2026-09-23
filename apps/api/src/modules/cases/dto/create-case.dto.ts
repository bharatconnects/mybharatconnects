import { IsString, IsOptional, IsEnum, IsObject, IsInt, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class PropertyDetailsDto {
  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  state?: string;

  @IsString()
  @IsOptional()
  pincode?: string;

  @IsString()
  @IsOptional()
  type?: string;

  @IsOptional()
  area?: number;

  @IsString()
  @IsOptional()
  areaUnit?: string;
}

export class CreateCaseDto {
  @IsString()
  clientId: string;

  @IsString()
  serviceType: string;

  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => PropertyDetailsDto)
  propertyDetails?: PropertyDetailsDto;

  @IsString()
  @IsOptional()
  leadId?: string;

  @IsEnum(['LOW', 'MEDIUM', 'HIGH'])
  @IsOptional()
  priority?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  vendorResponseWindowHours?: number;
}
