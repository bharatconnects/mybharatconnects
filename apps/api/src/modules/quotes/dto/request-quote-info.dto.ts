import { IsNotEmpty, IsString } from 'class-validator';

export class RequestQuoteInfoDto {
  @IsString()
  @IsNotEmpty()
  note: string;
}
