import {
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ServiceType } from '../schemas/lead.schema';
import { Cluster } from '../../../common/enums/cluster.enum';

export class CreateLeadDto {
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  country?: string;

  @IsEnum(ServiceType)
  @IsOptional()
  serviceType?: ServiceType;

  @IsNumber()
  @Min(0)
  @IsOptional()
  budget?: number;

  @IsString()
  @IsOptional()
  preferredCity?: string;

  @IsString()
  @IsOptional()
  message?: string;

  @IsString()
  @IsOptional()
  source?: string;

  @IsString()
  @IsOptional()
  timezone?: string;

  @IsString()
  @IsOptional()
  intentTag?: string;

  @IsEnum(Cluster)
  @IsOptional()
  cluster?: Cluster;

  // Only required/verified on the public POST /leads endpoint — see
  // LeadsController.create(). Optional here because this DTO is shared with
  // POST /leads/mine, which is already authenticated and doesn't need it.
  @IsString()
  @IsOptional()
  recaptchaToken?: string;
}
