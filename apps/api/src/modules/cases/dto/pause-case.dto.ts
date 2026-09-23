import { IsString } from 'class-validator';

export class PauseCaseDto {
  @IsString()
  reason: string;
}
