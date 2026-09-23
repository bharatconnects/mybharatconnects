import { IsString } from 'class-validator';

export class VerifyDocumentDto {
  @IsString()
  documentId: string;
}
