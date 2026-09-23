import { IsNotEmpty, IsString } from 'class-validator';

export class RequestQuoteRevisionDto {
  @IsString()
  @IsNotEmpty()
  note: string;
}
