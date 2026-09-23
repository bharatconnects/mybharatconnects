import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { AvailabilityWindowDto } from './availability-window.dto';

export class SetAvailabilityDto {
  @IsArray()
  @ArrayMinSize(0)
  @ValidateNested({ each: true })
  @Type(() => AvailabilityWindowDto)
  windows: AvailabilityWindowDto[];
}
