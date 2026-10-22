import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PaymentEventDocument = HydratedDocument<PaymentEvent>;

export type PaymentEventType =
  | 'REQUESTED'
  | 'REQUEST_EDITED'
  | 'REQUEST_WITHDRAWN'
  | 'INTENT_CREATED'
  | 'STRIPE_SUCCEEDED'
  | 'STRIPE_FAILED'
  | 'STRIPE_REFUNDED'
  | 'STRIPE_MISMATCH'
  | 'STATUS_SYNCED'
  | 'AUTHORIZED'
  | 'CAPTURED'
  | 'REFUNDED'
  | 'OFFLINE_REQUESTED'
  | 'OFFLINE_APPROVED'
  | 'OFFLINE_REJECTED'
  | 'MARKED_PAID_PAYOUT';

export type PaymentEventSource =
  | 'STRIPE_WEBHOOK'
  | 'CLIENT_CONFIRM'
  | 'STRIPE_SYNC'
  | 'ADMIN'
  | 'OPS_FINANCE'
  | 'CASE_MANAGER'
  | 'CLIENT'
  | 'VENDOR'
  | 'SYSTEM';

// Append-only audit trail for money movement: who or what changed a payment,
// from which status to which, and (for Stripe) under which event id. Never
// updated or deleted by application code.
@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class PaymentEvent {
  @Prop({ type: Types.ObjectId, ref: 'Payment', required: true, index: true })
  paymentId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Case', index: true })
  caseId?: Types.ObjectId;

  @Prop({ type: String, required: true })
  type: PaymentEventType;

  @Prop({ type: String, required: true })
  source: PaymentEventSource;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  actorUserId?: Types.ObjectId;

  @Prop({ type: String })
  actorRole?: string;

  @Prop({ type: String })
  fromStatus?: string;

  @Prop({ type: String })
  toStatus?: string;

  @Prop({ type: Number })
  amount?: number;

  // Stripe's event id (evt_...). Unique so a redelivered webhook is only
  // audited once.
  @Prop({ type: String, unique: true, sparse: true })
  stripeEventId?: string;

  @Prop({ type: String })
  note?: string;
}

export const PaymentEventSchema = SchemaFactory.createForClass(PaymentEvent);
