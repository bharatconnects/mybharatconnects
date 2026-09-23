import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { Lead, LeadSchema } from './schemas/lead.schema';
import { NotificationsModule } from '../notifications/notifications.module';
import { CasesModule } from '../cases/cases.module';
import { UsersModule } from '../users/users.module';
import { RecaptchaModule } from '../recaptcha/recaptcha.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Lead.name, schema: LeadSchema }]),
    NotificationsModule,
    CasesModule,
    UsersModule,
    RecaptchaModule,
  ],
  controllers: [LeadsController],
  providers: [LeadsService],
  exports: [LeadsService],
})
export class LeadsModule {}
