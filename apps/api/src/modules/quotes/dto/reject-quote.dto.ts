import { IsNotEmpty, IsString } from 'class-validator';

export class RejectQuoteDto {
  @IsString()
  @IsNotEmpty()
  reason: string;
}
