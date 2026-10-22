import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PaymentDocument = HydratedDocument<Payment>;

export type PaymentStatus =
  | 'PENDING'
  // An off-platform payment a CM has recorded that an Admin has not yet
  // approved. Never counts as money received and is never payable by the
  // client, so every `status === 'PENDING'` path (pay now, edit, withdraw)
  // naturally ignores it.
  | 'PENDING_APPROVAL'
  | 'AUTHORIZED'
  | 'CAPTURED'
  | 'REFUNDED'
  | 'FAILED'
  // An off-platform payment an Admin declined.
  | 'REJECTED';

export type PaymentType = 'AUTH_HOLD' | 'CAPTURE' | 'REFUND';

export type PaymentProvider = 'STRIPE' | 'OFFLINE';

// How a CAPTURED client payment was actually settled — what the payment
// checkpoints trust. STRIPE: confirmed by Stripe (webhook or a server-side
// status check). OFFLINE_APPROVED: recorded outside Stripe and approved by an
// Admin. LEGACY_MANUAL: marked paid by hand before this rule existed;
// backfilled so cases already in flight keep their payment history.
export type PaymentSettlement = 'STRIPE' | 'OFFLINE_APPROVED' | 'LEGACY_MANUAL';

export type OfflinePaymentMethod =
  | 'BANK_TRANSFER'
  | 'UPI'
  | 'CASH'
  | 'CHEQUE'
  | 'OTHER';

export type OfflineApprovalStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';

export class OfflinePaymentDetails {
  @Prop({ type: String, enum: ['BANK_TRANSFER', 'UPI', 'CASH', 'CHEQUE', 'OTHER'], required: true })
  method: OfflinePaymentMethod;

  // Bank/UPI reference number, cheque number, etc.
  @Prop({ type: String })
  reference?: string;

  @Prop({ type: Types.ObjectId, ref: 'Document' })
  proofDocumentId?: Types.ObjectId;

  // The CM's own explanation for why this was taken off-platform.
  @Prop({ type: String })
  note?: string;

  @Prop({
    type: String,
    enum: ['PENDING_APPROVAL', 'APPROVED', 'REJECTED'],
    default: 'PENDING_APPROVAL',
  })
  status: OfflineApprovalStatus;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  requestedBy: Types.ObjectId;

  @Prop({ type: Date, required: true })
  requestedAt: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  decidedBy?: Types.ObjectId;

  @Prop({ type: Date })
  decidedAt?: Date;

  @Prop({ type: String })
  decisionNote?: string;

  // A still-unpaid Stripe request this record replaces (the client paid
  // outside the app instead). Removed on approval so it cannot be paid twice.
  @Prop({ type: Types.ObjectId, ref: 'Payment' })
  supersedesPaymentId?: Types.ObjectId;
}

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
    enum: ['STRIPE', 'OFFLINE'],
    default: 'STRIPE',
    index: true,
  })
  provider: PaymentProvider;

  @Prop({ type: String, enum: ['STRIPE', 'OFFLINE_APPROVED', 'LEGACY_MANUAL'] })
  settlement?: PaymentSettlement;

  @Prop({
    type: {
      method: { type: String, enum: ['BANK_TRANSFER', 'UPI', 'CASH', 'CHEQUE', 'OTHER'], required: true },
      reference: String,
      proofDocumentId: { type: Types.ObjectId, ref: 'Document' },
      note: String,
      status: {
        type: String,
        enum: ['PENDING_APPROVAL', 'APPROVED', 'REJECTED'],
        default: 'PENDING_APPROVAL',
      },
      requestedBy: { type: Types.ObjectId, ref: 'User', required: true },
      requestedAt: { type: Date, required: true },
      decidedBy: { type: Types.ObjectId, ref: 'User' },
      decidedAt: Date,
      decisionNote: String,
      supersedesPaymentId: { type: Types.ObjectId, ref: 'Payment' },
    },
    _id: false,
  })
  offline?: OfflinePaymentDetails;

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
    enum: [
      'PENDING',
      'PENDING_APPROVAL',
      'AUTHORIZED',
      'CAPTURED',
      'REFUNDED',
      'FAILED',
      'REJECTED',
    ],
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
