import { IsIn } from 'class-validator';
import type { ActionItemStatus } from '../schemas/action-item.schema';

export class UpdateActionItemDto {
  @IsIn(['OPEN', 'DONE', 'CANCELLED'])
  status: ActionItemStatus;
}
