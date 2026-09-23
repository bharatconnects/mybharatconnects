import { IsOptional, IsString } from 'class-validator';

export class RejectQuoteByCmDto {
  @IsString()
  @IsOptional()
  reason?: string;
}
