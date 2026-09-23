import { IsDateString, IsMongoId, IsOptional, IsString } from 'class-validator';

export class CreateActionItemDto {
  @IsMongoId()
  owner: string;

  @IsString()
  text: string;

  @IsDateString()
  @IsOptional()
  dueDate?: string;
}
