import {
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import type { BookingPurpose } from '../schemas/booking.schema';

export class BookSlotDto {
  @IsMongoId()
  hostUserId: string;

  @IsOptional()
  @IsMongoId()
  guestUserId?: string;

  @IsString()
  guestName: string;

  @IsEmail()
  guestEmail: string;

  @IsOptional()
  @IsString()
  guestTimezone?: string;

  @IsOptional()
  @IsMongoId()
  caseId?: string;

  @IsIn(['DISCOVERY', 'KICKOFF', 'REVIEW', 'THREE_WAY'])
  purpose: BookingPurpose;

  @IsDateString()
  startAt: string;

  @IsInt()
  @Min(5)
  durationMinutes: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
