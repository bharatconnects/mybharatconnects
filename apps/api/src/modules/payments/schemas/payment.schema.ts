import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PaymentDocument = HydratedDocument<Payment>;

export type PaymentStatus =
  | 'PENDING'
  | 'AUTHORIZED'
  | 'CAPTURED'
  | 'REFUNDED'
  | 'FAILED';

export type PaymentType = 'AUTH_HOLD' | 'CAPTURE' | 'REFUND';

export type PaymentProvider = 'STRIPE';

// Which way the money moves: the client paying the platform/CM (the
// original, Stripe-backed flow), or the platform/CM paying a vendor for
// completed work (manual — settled the same way as a manual client
// payment, via markPaid(), just never goes through Stripe at all).
export type PaymentDirection = 'CLIENT_TO_CM' | 'CM_TO_VENDOR';

// What this specific payment is for — a case can have several payments over
// its lifecycle (a token/advance, one per milestone, or a single full
// payment), never a single record per case.
export type PaymentPurpose = 'TOKEN' | 'PARTIAL' | 'MILESTONE' | 'FULL';

@Schema({ timestamps: true })
export class Payment {
  @Prop({ type: Types.ObjectId, ref: 'Case', required: true })
  caseId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  clientId: Types.ObjectId;

  @Prop({ type: String, enum: ['CLIENT_TO_CM', 'CM_TO_VENDOR'], default: 'CLIENT_TO_CM' })
  direction: PaymentDirection;

  // Set only when direction is CM_TO_VENDOR — the vendor being paid.
  @Prop({ type: Types.ObjectId, ref: 'Vendor' })
  vendorId?: Types.ObjectId;

  // The Stripe-hosted receipt for a captured card payment (captured
  // best-effort from the payment_intent.succeeded webhook) — lets a CM
  // reference/attach it as an invoice without a separate Stripe Invoicing
  // integration.
  @Prop({ type: String })
  receiptUrl?: string;

  @Prop({ type: Types.ObjectId, ref: 'Quote' })
  quoteId?: Types.ObjectId;

  // References a Quote.milestones[] subdocument _id — milestones live
  // embedded on Quote, not their own collection, so no `ref` here.
  @Prop({ type: Types.ObjectId })
  milestoneId?: Types.ObjectId;

  @Prop({
    type: String,
    enum: ['TOKEN', 'PARTIAL', 'MILESTONE', 'FULL'],
    default: 'FULL',
  })
  purpose: PaymentPurpose;

  @Prop({ type: Types.ObjectId, ref: 'Document' })
  receiptDocumentId?: Types.ObjectId;

  // The CM who requested this payment — absent for the legacy client
  // self-serve auth-hold path.
  @Prop({ type: Types.ObjectId, ref: 'User' })
  requestedBy?: Types.ObjectId;

  @Prop({ type: Date })
  requestedAt?: Date;

  @Prop({
    type: String,
    enum: ['STRIPE'],
    default: 'STRIPE',
    index: true,
  })
  provider: PaymentProvider;

  @Prop({ type: String, unique: true, sparse: true })
  stripePaymentIntentId?: string;

  @Prop({ type: String })
  stripeCustomerId?: string;

  @Prop({ type: Number, required: true })
  amount: number;

  @Prop({ type: String, default: 'usd' })
  currency: string;

  @Prop({
    type: String,
    enum: ['PENDING', 'AUTHORIZED', 'CAPTURED', 'REFUNDED', 'FAILED'],
    default: 'PENDING',
  })
  status: PaymentStatus;

  @Prop({
    type: String,
    enum: ['AUTH_HOLD', 'CAPTURE', 'REFUND'],
    required: true,
  })
  type: PaymentType;

  @Prop({ type: String })
  description?: string;

  @Prop({ type: Map, of: String, default: {} })
  metadata: Record<string, string>;

  @Prop({ type: Date })
  capturedAt?: Date;

  @Prop({ type: Date })
  refundedAt?: Date;

  @Prop({ type: String })
  refundReason?: string;

  @Prop({ type: String })
  stripeRefundId?: string;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);
