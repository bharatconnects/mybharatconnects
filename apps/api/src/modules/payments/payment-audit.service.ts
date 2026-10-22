import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  PaymentEvent,
  PaymentEventDocument,
  PaymentEventSource,
  PaymentEventType,
} from './schemas/payment-event.schema';

export interface PaymentAuditEntry {
  paymentId: string | Types.ObjectId;
  caseId?: string | Types.ObjectId;
  type: PaymentEventType;
  source: PaymentEventSource;
  actorUserId?: string;
  actorRole?: string;
  fromStatus?: string;
  toStatus?: string;
  amount?: number;
  stripeEventId?: string;
  note?: string;
}

const toObjectId = (value?: string | Types.ObjectId): Types.ObjectId | undefined =>
  value && Types.ObjectId.isValid(value.toString())
    ? new Types.ObjectId(value.toString())
    : undefined;

@Injectable()
export class PaymentAuditService {
  private readonly logger = new Logger(PaymentAuditService.name);

  constructor(
    @InjectModel(PaymentEvent.name)
    private readonly eventModel: Model<PaymentEventDocument>,
  ) {}

  // Auditing must never roll back or block the payment change it describes,
  // so a failure here is logged and swallowed. A duplicate Stripe event id
  // (a redelivered webhook) is expected and silent.
  async record(entry: PaymentAuditEntry): Promise<void> {
    try {
      await this.eventModel.create({
        paymentId: toObjectId(entry.paymentId),
        caseId: toObjectId(entry.caseId),
        type: entry.type,
        source: entry.source,
        actorUserId: toObjectId(entry.actorUserId),
        actorRole: entry.actorRole,
        fromStatus: entry.fromStatus,
        toStatus: entry.toStatus,
        amount: entry.amount,
        stripeEventId: entry.stripeEventId,
        note: entry.note,
      });
    } catch (err) {
      const code = (err as { code?: number }).code;
      if (code === 11000) return;
      const msg = err instanceof Error ? err.message : 'unknown error';
      this.logger.error(
        `Failed to record ${entry.type} audit event for payment ${entry.paymentId.toString()}: ${msg}`,
      );
    }
  }

  async findForPayment(paymentId: string): Promise<PaymentEventDocument[]> {
    return this.eventModel
      .find({ paymentId: new Types.ObjectId(paymentId) })
      .populate('actorUserId', 'name email role')
      .sort({ createdAt: 1 })
      .exec();
  }
}
