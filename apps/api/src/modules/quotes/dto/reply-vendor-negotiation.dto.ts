import { IsNotEmpty, IsString } from 'class-validator';

export class ReplyVendorNegotiationDto {
  @IsString()
  @IsNotEmpty()
  reply: string;
}
