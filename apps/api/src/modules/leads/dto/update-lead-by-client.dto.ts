import { IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { ServiceType } from '../schemas/lead.schema';
import { IsPhone } from '../../../common/validators/is-phone.validator';

// Deliberately narrower than UpdateLeadDto — a client may only edit the
// content of their own request, never CM-internal fields (status,
// assignedCaseManager, internalNote, etc).
export class UpdateLeadByClientDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsPhone()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  country?: string;

  @IsEnum(ServiceType)
  @IsOptional()
  serviceType?: ServiceType;

  @IsString()
  @IsOptional()
  message?: string;

  @IsString()
  @IsOptional()
  timezone?: string;

  @IsString()
  @IsOptional()
  intentTag?: string;
}
