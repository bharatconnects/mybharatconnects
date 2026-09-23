import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum QuoteResponse {
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  NEGOTIATING = 'NEGOTIATING',
}

export class RespondQuoteDto {
  @IsEnum(QuoteResponse)
  response: QuoteResponse;

  @IsString()
  @IsOptional()
  comment?: string;
}
