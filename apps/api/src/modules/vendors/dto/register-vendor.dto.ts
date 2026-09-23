import { IsMongoId } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CreateVendorDto } from './create-vendor.dto';

/**
 * DTO for POST /api/vendors/register.
 *
 * Wraps {@link CreateVendorDto} (all the vendor profile fields) plus the
 * `userId` of the User document this vendor profile belongs to. A separate
 * DTO is needed because the global `ValidationPipe` runs with
 * `forbidNonWhitelisted: true`, so the controller cannot quietly accept
 * `userId` alongside `CreateVendorDto` — it must be on the validated class.
 */
export class RegisterVendorDto extends CreateVendorDto {
  @ApiProperty({ description: 'User ID this vendor profile belongs to' })
  @IsMongoId()
  userId: string;
}
