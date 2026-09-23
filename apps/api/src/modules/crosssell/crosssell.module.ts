import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CrosssellController } from './crosssell.controller';
import { CrosssellService } from './crosssell.service';
import {
  CrosssellRule,
  CrosssellRuleSchema,
} from './schemas/crosssell-rule.schema';
import {
  CrosssellTrigger,
  CrosssellTriggerSchema,
} from './schemas/crosssell-trigger.schema';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CrosssellRule.name, schema: CrosssellRuleSchema },
      { name: CrosssellTrigger.name, schema: CrosssellTriggerSchema },
    ]),
    NotificationsModule,
  ],
  controllers: [CrosssellController],
  providers: [CrosssellService],
  exports: [CrosssellService],
})
export class CrosssellModule {}
