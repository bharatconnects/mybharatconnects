import { IsNotEmpty, IsString } from 'class-validator';

export class AnnotateDocumentDto {
  @IsString()
  @IsNotEmpty()
  annotation: string;
}
