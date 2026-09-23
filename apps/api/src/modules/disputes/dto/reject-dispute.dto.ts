import { IsString } from 'class-validator';

export class RejectDisputeDto {
  @IsString()
  reason: string;
}
