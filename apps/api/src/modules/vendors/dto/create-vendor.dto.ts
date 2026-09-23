import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class BankDetailsDto {
  @IsString()
  accountNumber: string;

  @IsString()
  ifsc: string;

  @IsString()
  accountName: string;
}

export class CreateVendorDto {
  @IsString()
  businessName: string;

  @IsArray()
  @IsString({ each: true })
  serviceTypes: string[];

  @IsArray()
  @IsString({ each: true })
  cities: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  languages?: string[];

  @IsNumber()
  @Min(1)
  @IsOptional()
  maxConcurrentJobs?: number;

  @IsBoolean()
  @IsOptional()
  isAvailable?: boolean;

  @ValidateNested()
  @Type(() => BankDetailsDto)
  @IsOptional()
  bankDetails?: BankDetailsDto;
}
