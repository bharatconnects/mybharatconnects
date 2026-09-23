import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class FurnishingRoomDto {
  @ApiProperty({ description: 'Room name (e.g. Living Room)' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Budget allocated to this room' })
  @IsNumber()
  @Min(0)
  budget: number;

  @ApiProperty({ description: 'Free-text requirements for the room' })
  @IsString()
  requirements: string;
}

export class CreateFurnishingRequestDto {
  @ApiProperty({ description: 'Optional associated case ID' })
  @IsOptional()
  @IsMongoId()
  caseId?: string;

  @ApiProperty({ description: 'Client user ID' })
  @IsMongoId()
  clientId: string;

  @ApiProperty({ description: 'Case manager user ID' })
  @IsMongoId()
  caseManagerId: string;

  @ApiProperty({ description: 'Optional property ID this request is for' })
  @IsOptional()
  @IsMongoId()
  propertyId?: string;

  @ApiProperty({ description: 'Total budget for the furnishing request' })
  @IsNumber()
  @Min(0)
  budgetTotal: number;

  @ApiProperty({
    description: 'Per-room breakdown of requirements and budgets',
    type: [FurnishingRoomDto],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => FurnishingRoomDto)
  rooms?: FurnishingRoomDto[];

  @ApiProperty({ description: 'Delivery address for the furnishings' })
  @IsString()
  deliveryAddress: string;
}
