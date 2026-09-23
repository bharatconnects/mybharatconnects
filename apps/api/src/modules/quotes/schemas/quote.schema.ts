import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type QuoteDocument = HydratedDocument<Quote>;

export enum QuoteStatus {
  INVITED = 'INVITED',
  DRAFT = 'DRAFT',
  SENT = 'SENT',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  NEGOTIATING = 'NEGOTIATING',
  EXPIRED = 'EXPIRED',
  DECLINED = 'DECLINED',
}

export enum QuoteType {
  FIXED = 'FIXED',
  MILESTONE = 'MILESTONE',
}

export enum MilestoneAmountType {
  FIXED = 'FIXED',
  PERCENT = 'PERCENT',
}

export enum MilestoneStatus {
  PENDING = 'PENDING',
  VENDOR_MARKED_DONE = 'VENDOR_MARKED_DONE',
  CLIENT_APPROVED = 'CLIENT_APPROVED',
  PAID = 'PAID',
}

export enum MarginType {
  PERCENT = 'PERCENT',
  FIXED = 'FIXED',
}

export interface QuoteItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  // Client-item-only: how this line's unitPrice was marked up over the
  // vendor's own price for the same line. Absent on vendor items, and on any
  // client item the CM added beyond the vendor's own item count (no vendor
  // price to mark up from — priced directly instead).
  marginType?: MarginType;
  marginValue?: number;
}

export interface PreviousVendorQuote {
  items: QuoteItem[];
  subtotal: number;
  taxPercent: number;
  taxAmount: number;
  totalAmount: number;
  revisionNumber: number;
  capturedAt: Date;
}

export interface PreviousClientQuote {
  items: QuoteItem[];
  subtotal: number;
  taxPercent: number;
  taxAmount: number;
  totalAmount: number;
  capturedAt: Date;
}

export interface QuoteMilestone {
  _id?: Types.ObjectId;
  title: string;
  sequence: number;
  amountType: MilestoneAmountType;
  amountValue: number;
  computedAmount?: number;
  status: MilestoneStatus;
  vendorMarkedDoneAt?: Date;
  clientApprovedAt?: Date;
  clientApprovedBy?: Types.ObjectId;
  paidAt?: Date;
  paidBy?: Types.ObjectId;
  payoutReceiptDocumentId?: Types.ObjectId;
  clientReceiptDocumentId?: Types.ObjectId;
}

@Schema({ timestamps: true })
export class Quote {
  @Prop({ type: Types.ObjectId, ref: 'Case', required: true })
  caseId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Vendor', required: true })
  vendorId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  caseManagerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  clientId: Types.ObjectId;

  @Prop({
    type: [
      {
        description: { type: String, required: true },
        quantity: { type: Number, required: true },
        unitPrice: { type: Number, required: true },
        total: { type: Number, required: true },
      },
    ],
    default: [],
  })
  items: QuoteItem[];

  @Prop({ type: Number })
  subtotal: number;

  @Prop({ type: Number, default: 18 })
  taxPercent: number;

  @Prop({ type: Number })
  taxAmount: number;

  @Prop({ type: Number })
  totalAmount: number;

  @Prop({ type: String, default: 'INR' })
  currency: string;

  // Client-facing quote — a CM-editable copy of the vendor's quote above.
  // Auto-populated from `items`/etc. on the vendor's first submission, then
  // only the CM (via updateClientQuote) changes it. The client is shown
  // these fields, never the vendor fields above — see quotes.service.ts's
  // stripVendorFieldsForClient().
  @Prop({
    type: [
      {
        description: { type: String, required: true },
        quantity: { type: Number, required: true },
        unitPrice: { type: Number, required: true },
        total: { type: Number, required: true },
        marginType: { type: String, enum: MarginType },
        marginValue: { type: Number },
      },
    ],
    default: [],
  })
  clientItems: QuoteItem[];

  @Prop({ type: Number })
  clientSubtotal: number;

  @Prop({ type: Number, default: 18 })
  clientTaxPercent: number;

  @Prop({ type: Number })
  clientTaxAmount: number;

  @Prop({ type: Number })
  clientTotalAmount: number;

  @Prop({ type: Date })
  clientQuoteUpdatedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  clientQuoteUpdatedBy?: Types.ObjectId;

  @Prop({ type: Date })
  validUntil: Date;

  @Prop({ type: String, enum: QuoteStatus, default: QuoteStatus.DRAFT })
  status: QuoteStatus;

  @Prop({ type: String })
  clientResponse: string;

  // The CM's reply to clientResponse while NEGOTIATING — a private
  // CM<->client thread the vendor never sees (see stripClientFieldsForVendor
  // in quotes.service.ts). Cleared whenever a fresh clientResponse comes in
  // (see respond()), same as vendorInfoRequest/cmInfoResponse below.
  @Prop({ type: String })
  cmNegotiationReply?: string;

  @Prop({ type: Date })
  cmNegotiationRepliedAt?: Date;

  @Prop({ type: Number, default: 1 })
  revisionNumber: number;

  @Prop({ type: Types.ObjectId, ref: 'Quote' })
  previousQuoteId: Types.ObjectId;

  // Snapshot of the vendor quote immediately before it was last overwritten
  // (by submit() on resubmission, or by the vendor's own revise()) — so
  // "previous vs. current" is always visible once at least one revision has
  // happened. Absent until the first revision.
  @Prop({
    type: {
      items: {
        type: [
          {
            description: { type: String, required: true },
            quantity: { type: Number, required: true },
            unitPrice: { type: Number, required: true },
            total: { type: Number, required: true },
          },
        ],
        default: [],
      },
      subtotal: { type: Number },
      taxPercent: { type: Number },
      taxAmount: { type: Number },
      totalAmount: { type: Number },
      revisionNumber: { type: Number },
      capturedAt: { type: Date },
    },
    _id: false,
  })
  previousVendorQuote?: PreviousVendorQuote;

  // Same idea for the client-facing quote — snapshot taken in
  // updateClientQuote() before the CM's edit is applied.
  @Prop({
    type: {
      items: {
        type: [
          {
            description: { type: String, required: true },
            quantity: { type: Number, required: true },
            unitPrice: { type: Number, required: true },
            total: { type: Number, required: true },
          },
        ],
        default: [],
      },
      subtotal: { type: Number },
      taxPercent: { type: Number },
      taxAmount: { type: Number },
      totalAmount: { type: Number },
      capturedAt: { type: Date },
    },
    _id: false,
  })
  previousClientQuote?: PreviousClientQuote;

  @Prop({ type: Date })
  sentAt: Date;

  @Prop({ type: Date })
  respondedAt: Date;

  @Prop({ type: [String], default: [] })
  exclusions: string[];

  @Prop({ type: String })
  refundPolicy?: string;

  @Prop({ type: String })
  rejectionReason?: string;

  // Client-facing rejection — deliberately separate from `status`/
  // `rejectionReason` above. The client deals with the CM, not the vendor
  // directly: rejecting a quote as a client must NOT flip the vendor-visible
  // `status` to REJECTED (the vendor would see their quote as dead with no
  // chance to negotiate). Instead this flag surfaces to the CM, who then
  // either renegotiates with the vendor (request-revision) or formally
  // rejects the quote (reject-by-cm) — both existing CM-only actions.
  @Prop({ type: Date })
  clientRejectedAt?: Date;

  @Prop({ type: String })
  clientRejectionReason?: string;

  @Prop({ type: Number, default: 2 })
  revisionsRemaining: number;

  @Prop({ type: String, enum: QuoteType, default: QuoteType.FIXED })
  quoteType: QuoteType;

  @Prop({
    type: [
      {
        title: { type: String, required: true },
        sequence: { type: Number, required: true },
        amountType: { type: String, enum: MilestoneAmountType, required: true },
        amountValue: { type: Number, required: true },
        computedAmount: { type: Number },
        status: { type: String, enum: MilestoneStatus, default: MilestoneStatus.PENDING },
        vendorMarkedDoneAt: { type: Date },
        clientApprovedAt: { type: Date },
        clientApprovedBy: { type: Types.ObjectId, ref: 'User' },
        paidAt: { type: Date },
        paidBy: { type: Types.ObjectId, ref: 'User' },
        payoutReceiptDocumentId: { type: Types.ObjectId, ref: 'Document' },
        clientReceiptDocumentId: { type: Types.ObjectId, ref: 'Document' },
      },
    ],
    default: [],
  })
  milestones: QuoteMilestone[];

  @Prop({ type: Date })
  invitedAt?: Date;

  @Prop({ type: Date })
  respondBy?: Date;

  @Prop({ type: Date })
  declinedAt?: Date;

  @Prop({ type: String })
  declineReason?: string;

  @Prop({ type: String })
  inviteNote?: string;

  // The vendor's reply to the CM's note above — a private vendor<->CM
  // negotiation thread. requestRevision() clears this whenever the CM sends
  // a fresh note, mirroring how vendorInfoRequest/cmInfoResponse reset
  // together below.
  @Prop({ type: String })
  vendorNegotiationReply?: string;

  @Prop({ type: Date })
  vendorNegotiationRepliedAt?: Date;

  // Vendor pre-quote question, asked while the invite is still INVITED (e.g.
  // "can you clarify the scope?") — a fresh request overwrites any prior
  // answered Q&A, mirroring how inviteNote/clientResponse work elsewhere.
  @Prop({ type: String })
  vendorInfoRequest?: string;

  @Prop({ type: Date })
  vendorInfoRequestedAt?: Date;

  @Prop({ type: String })
  cmInfoResponse?: string;

  @Prop({ type: Date })
  cmInfoRespondedAt?: Date;

  // "Update bubble" tracking — the last time each party looked at this quote.
  // A role sees an unread indicator whenever `updatedAt` is newer than their
  // own `<role>SeenAt`; set via PATCH /quotes/:id/seen when they open it.
  @Prop({ type: Date })
  cmSeenAt?: Date;

  @Prop({ type: Date })
  vendorSeenAt?: Date;

  @Prop({ type: Date })
  clientSeenAt?: Date;
}

export const QuoteSchema = SchemaFactory.createForClass(Quote);
