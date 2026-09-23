import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EmailService } from './notifications.email.service';
import {
  Notification,
  NotificationDocument,
} from './schemas/notification.schema';

export interface NotifyEvent {
  userId: string;
  email?: string;
  userName?: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sendEmail?: boolean;
  emailTemplate?: string;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly email: EmailService,
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
  ) {}

  async createInApp(
    userId: string,
    title: string,
    body: string,
    type: string,
    data?: Record<string, unknown>,
  ): Promise<NotificationDocument> {
    return this.notificationModel.create({
      userId,
      title,
      body,
      type,
      data: data ?? {},
    });
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationModel
      .countDocuments({ userId, isRead: false })
      .exec();
  }

  async getUserNotifications(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<NotificationDocument[]> {
    const skip = (page - 1) * limit;
    return this.notificationModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();
  }

  async markRead(notificationId: string, userId: string): Promise<void> {
    const result = await this.notificationModel.findOneAndUpdate(
      { _id: notificationId, userId },
      { isRead: true, readAt: new Date() },
    );
    if (!result) {
      throw new NotFoundException(
        `Notification ${notificationId} not found for this user`,
      );
    }
  }

  async markAllRead(userId: string): Promise<void> {
    await this.notificationModel.updateMany(
      { userId, isRead: false },
      { isRead: true, readAt: new Date() },
    );
  }

  async notify(event: NotifyEvent): Promise<void> {
    // Channel 1 — in-app: always created so the bell icon and notifications
    // list pick it up.
    await this.createInApp(
      event.userId,
      event.title,
      event.body,
      event.type,
      event.data,
    );

    // Channel 2 — email: opt-in via `sendEmail` + a known template name.
    if (event.sendEmail && event.email) {
      const name = event.userName ?? 'User';
      switch (event.emailTemplate) {
        case 'CASE_UPDATE': {
          const caseNumber = String(event.data?.['caseNumber'] ?? '');
          const newStatus = String(event.data?.['newStatus'] ?? '');
          await this.email.sendCaseUpdateEmail(
            event.email,
            name,
            caseNumber,
            newStatus,
          );
          break;
        }
        case 'QUOTE_SENT': {
          const caseNumber = String(event.data?.['caseNumber'] ?? '');
          const amount = Number(event.data?.['amount'] ?? 0);
          await this.email.sendQuoteEmail(
            event.email,
            name,
            caseNumber,
            amount,
          );
          break;
        }
        case 'PAYMENT_RECEIVED': {
          const caseNumber = String(event.data?.['caseNumber'] ?? '');
          const amount = Number(event.data?.['amount'] ?? 0);
          await this.email.sendPaymentConfirmationEmail(
            event.email,
            name,
            amount,
            caseNumber,
          );
          break;
        }
        default:
          // No specific template — skip email
          break;
      }
    }
  }
}
