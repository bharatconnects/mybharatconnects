import { IsNumberString, IsOptional, IsString } from 'class-validator';

export class VendorRoutingDto {
  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  serviceType?: string;

  @IsString()
  @IsOptional()
  preferredLanguage?: string;

  @IsOptional()
  @IsNumberString()
  minRating?: string;

  @IsOptional()
  @IsNumberString()
  maxRating?: string;
}
