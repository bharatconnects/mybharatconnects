import { IsNotEmpty, IsString } from 'class-validator';

export class DeclineQuoteDto {
  @IsString()
  @IsNotEmpty()
  reason: string;
}
