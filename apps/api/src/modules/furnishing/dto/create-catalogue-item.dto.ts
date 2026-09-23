import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import type { CatalogueCategory } from '../schemas/furnishing-catalogue.schema';

export const CATALOGUE_CATEGORIES: CatalogueCategory[] = [
  'FURNITURE',
  'LIGHTING',
  'DECOR',
  'KITCHEN',
  'BATHROOM',
  'FLOORING',
  'WINDOW',
  'OTHER',
];

export class CatalogueImageDto {
  @ApiProperty({ description: 'S3 object key for the image' })
  @IsString()
  s3Key: string;

  @ApiProperty({ description: 'Whether this is the primary image' })
  @IsBoolean()
  isPrimary: boolean;
}

export class CataloguePriceRangeDto {
  @ApiProperty({ description: 'Minimum price' })
  @IsNumber()
  @Min(0)
  min: number;

  @ApiProperty({ description: 'Maximum price' })
  @IsNumber()
  @Min(0)
  max: number;

  @ApiProperty({ description: 'ISO 4217 currency code', required: false })
  @IsOptional()
  @IsString()
  currency?: string;
}

export class CreateCatalogueItemDto {
  @ApiProperty({ description: 'Display name of the catalogue item' })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Category of the catalogue item',
    enum: CATALOGUE_CATEGORIES,
  })
  @IsEnum(CATALOGUE_CATEGORIES)
  category: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ type: [CatalogueImageDto], required: false })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => CatalogueImageDto)
  images?: CatalogueImageDto[];

  @ApiProperty({ type: CataloguePriceRangeDto })
  @ValidateNested()
  @Type(() => CataloguePriceRangeDto)
  priceRange: CataloguePriceRangeDto;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsMongoId()
  vendorId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  estimatedDeliveryDays?: number;

  @ApiProperty({ type: [String], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
