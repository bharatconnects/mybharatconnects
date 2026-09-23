import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Case, CaseSchema } from '../cases/schemas/case.schema';
import { ActionItemsController } from './action-items.controller';
import { ActionItemsService } from './action-items.service';
import {
  ActionItem,
  ActionItemSchema,
} from './schemas/action-item.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ActionItem.name, schema: ActionItemSchema },
      { name: Case.name, schema: CaseSchema },
    ]),
  ],
  controllers: [ActionItemsController],
  providers: [ActionItemsService],
  exports: [ActionItemsService],
})
export class ActionItemsModule {}
