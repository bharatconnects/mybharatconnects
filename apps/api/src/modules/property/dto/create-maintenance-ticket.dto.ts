import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDate,
  IsEnum,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import type {
  TicketCategory,
  TicketPriority,
} from '../schemas/maintenance-ticket.schema';

export const TICKET_CATEGORIES: TicketCategory[] = [
  'PLUMBING',
  'ELECTRICAL',
  'STRUCTURAL',
  'APPLIANCE',
  'OTHER',
];

export const TICKET_PRIORITIES: TicketPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

export class MaintenancePhotoDto {
  @ApiProperty({ description: 'S3 object key for the photo' })
  @IsString()
  s3Key: string;

  @ApiProperty({ description: 'When the photo was uploaded' })
  @IsDate()
  @Type(() => Date)
  uploadedAt: Date;
}

export class CreateMaintenanceTicketDto {
  @ApiProperty({ description: 'User ID of the person raising the ticket' })
  @IsMongoId()
  raisedBy: string;

  @ApiProperty({ description: 'Short title of the maintenance issue' })
  @IsString()
  title: string;

  @ApiProperty({ description: 'Detailed description of the issue' })
  @IsString()
  description: string;

  @ApiProperty({
    description: 'Category of maintenance work',
    enum: TICKET_CATEGORIES,
    required: false,
  })
  @IsOptional()
  @IsEnum(TICKET_CATEGORIES)
  category?: string;

  @ApiProperty({
    description: 'Priority level of the ticket',
    enum: TICKET_PRIORITIES,
    required: false,
  })
  @IsOptional()
  @IsEnum(TICKET_PRIORITIES)
  priority?: string;

  @ApiProperty({ description: 'Vendor assigned to handle the ticket', required: false })
  @IsOptional()
  @IsMongoId()
  assignedVendorId?: string;

  @ApiProperty({ description: 'Estimated repair cost', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedCost?: number;

  @ApiProperty({
    description: 'Photos documenting the issue',
    type: [MaintenancePhotoDto],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => MaintenancePhotoDto)
  photos?: MaintenancePhotoDto[];
}
