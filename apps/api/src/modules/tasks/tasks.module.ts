import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { Case, CaseSchema } from '../cases/schemas/case.schema';
import { Quote, QuoteSchema } from '../quotes/schemas/quote.schema';
import { Lead, LeadSchema } from '../leads/schemas/lead.schema';
import { NotificationsModule } from '../notifications/notifications.module';
import { TasksListener } from './tasks.listener';
import { TasksService } from './tasks.service';
import { CronLock, CronLockSchema } from './schemas/cron-lock.schema';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    MongooseModule.forFeature([
      { name: Case.name, schema: CaseSchema },
      { name: Quote.name, schema: QuoteSchema },
      { name: Lead.name, schema: LeadSchema },
      { name: CronLock.name, schema: CronLockSchema },
    ]),
    NotificationsModule,
  ],
  providers: [TasksService, TasksListener],
  exports: [TasksService],
})
export class TasksModule {}
