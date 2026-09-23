import { IsNotEmpty, IsString } from 'class-validator';

export class AnswerQuoteInfoDto {
  @IsString()
  @IsNotEmpty()
  answer: string;
}
