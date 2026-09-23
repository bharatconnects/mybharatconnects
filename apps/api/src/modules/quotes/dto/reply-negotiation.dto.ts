import { IsNotEmpty, IsString } from 'class-validator';

export class ReplyNegotiationDto {
  @IsString()
  @IsNotEmpty()
  reply: string;
}
