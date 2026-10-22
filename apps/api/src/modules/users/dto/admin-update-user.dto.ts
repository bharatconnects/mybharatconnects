import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';
import { Cluster } from '../../../common/enums/cluster.enum';
import { Role } from '../../../common/enums/roles.enum';
import { IsPhone } from '../../../common/validators/is-phone.validator';

export class AdminUpdateUserDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsPhone()
  phone?: string | null;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsEnum(Cluster)
  cluster?: Cluster;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
