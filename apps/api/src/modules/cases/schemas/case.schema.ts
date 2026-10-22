import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { CaseStatus } from '../../../common/enums/case-status.enum';

export type CaseDocument = HydratedDocument<Case>;

export class PropertyDetails {
  @Prop({ type: String })
  address: string;

  @Prop({ type: String })
  city: string;

  @Prop({ type: String })
  state: string;

  @Prop({ type: String })
  pincode: string;

  @Prop({ type: String })
  type: string;

  @Prop({ type: Number })
  area: number;

  @Prop({ type: String, enum: ['sqft', 'sqm', 'acre'] })
  areaUnit: string;
}

export class CaseTimeline {
  @Prop({ type: Date })
  leadCapturedAt?: Date;

  @Prop({ type: Date })
  frqScheduledAt?: Date;

  @Prop({ type: Date })
  vendorSelectedAt?: Date;

  @Prop({ type: Date })
  quoteSentAt?: Date;

  @Prop({ type: Date })
  caseOpenedAt?: Date;

  @Prop({ type: Date })
  vendorStartedAt?: Date;

  @Prop({ type: Date })
  documentsCollectedAt?: Date;

  @Prop({ type: Date })
  qaReviewAt?: Date;

  @Prop({ type: Date })
  clientReviewAt?: Date;

  @Prop({ type: Date })
  closedAt?: Date;
}

export class StageHistoryEntry {
  @Prop({ type: String, enum: CaseStatus })
  stage: CaseStatus;

  @Prop({ type: Date, default: Date.now })
  changedAt: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  changedBy: Types.ObjectId;

  @Prop({ type: String })
  note?: string;
}

export class ClosingPack {
  @Prop({ type: Date })
  generatedAt: Date;

  @Prop({ type: String })
  s3Key: string;

  @Prop({ type: [Types.ObjectId], ref: 'Document', default: [] })
  documentIds: Types.ObjectId[];

  @Prop({ type: Number, default: 0 })
  totalDocs: number;

  @Prop({ type: String })
  archiveUrl?: string;

  @Prop({ type: Date })
  expiresAt?: Date;
}

export class CaseNote {
  @Prop({ type: Types.ObjectId, ref: 'User' })
  author: Types.ObjectId;

  @Prop({ type: String })
  text: string;

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;
}

export type CasePaymentPolicySource = 'SETTINGS' | 'ADJUSTED';
export type AdvanceMode = 'PERCENT' | 'FIXED';

export class CasePaymentPolicyChange {
  @Prop({ type: Date })
  at: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  by?: Types.ObjectId;

  @Prop({ type: String })
  byRole?: string;

  @Prop({ type: Object })
  from: { mode: AdvanceMode; advancePercent: number; advanceAmount?: number };

  @Prop({ type: Object })
  to: { mode: AdvanceMode; advancePercent: number; advanceAmount?: number };

  @Prop({ type: String })
  note?: string;

  @Prop({ type: String })
  arrangementNote?: string;
}

// The advance rule that applies to this case. It starts as the platform
// default when the quote is accepted, so a later change to that default does
// not move the goalposts for a client who has already agreed. The case
// manager (or an Admin) can then change it for this case after talking to the
// client, either as a percentage of the quote or as a fixed amount. Every
// change is kept in `history` with who made it and why, and the agreed
// arrangement for the remainder is stored alongside. The checkpoint itself is
// never skipped: only the amount it asks for changes.
export class CasePaymentPolicy {
  @Prop({ type: String, enum: ['PERCENT', 'FIXED'], default: 'PERCENT' })
  mode: AdvanceMode;

  @Prop({ type: Number, min: 0, max: 100 })
  advancePercent: number;

  // Minor units. Used when mode is FIXED.
  @Prop({ type: Number, min: 0 })
  advanceAmount?: number;

  @Prop({ type: String, enum: ['SETTINGS', 'ADJUSTED'] })
  source: CasePaymentPolicySource;

  @Prop({ type: Date })
  setAt: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  setBy?: Types.ObjectId;

  @Prop({ type: String })
  note?: string;

  // What was agreed about paying the rest, if anything.
  @Prop({ type: String })
  arrangementNote?: string;

  @Prop({ type: [Object], default: [] })
  history: CasePaymentPolicyChange[];
}

// Everything that happened around closing the case, kept for audit: who asked
// for closure and when, what had been paid and delivered at that moment, how
// long the client had, and how it ended.
export class CaseClosure {
  @Prop({ type: Types.ObjectId, ref: 'User' })
  requestedBy?: Types.ObjectId;

  @Prop({ type: Date })
  requestedAt?: Date;

  @Prop({ type: Date })
  windowEndsAt?: Date;

  @Prop({ type: Date })
  clientConfirmedAt?: Date;

  @Prop({ type: Date })
  issueRaisedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'Dispute' })
  issueDisputeId?: Types.ObjectId;

  @Prop({ type: Date })
  issueResolvedAt?: Date;

  @Prop({ type: Date })
  closedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  closedBy?: Types.ObjectId;

  @Prop({ type: String, enum: ['CLIENT_CONFIRMED', 'WINDOW_ELAPSED'] })
  closedVia?: 'CLIENT_CONFIRMED' | 'WINDOW_ELAPSED';

  @Prop({ type: Object })
  payment?: { paid: number; total: number; currency: string | null };

  @Prop({ type: Object })
  delivery?: { delivered: number; total: number };
}

@Schema({ timestamps: true })
export class Case {
  @Prop({ type: String, unique: true })
  caseNumber: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  clientId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  caseManagerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Vendor' })
  vendorId?: Types.ObjectId;

  // When the current vendorId was assigned — lets quotes.service.ts tell a
  // stale outstanding invite (from before this vendor was picked) apart from
  // a fresh re-invite the CM sent to a specific vendor after the fact (e.g.
  // negotiating a new price, or swapping vendors mid-case).
  @Prop({ type: Date })
  vendorAssignedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'Lead' })
  leadId?: Types.ObjectId;

  @Prop({ type: String, required: true })
  serviceType: string;

  @Prop({ type: String, enum: CaseStatus, default: CaseStatus.LEAD_CAPTURED })
  status: CaseStatus;

  @Prop({ type: String, enum: ['LOW', 'MEDIUM', 'HIGH'], default: 'MEDIUM' })
  priority: string;

  @Prop({ type: String, required: true })
  title: string;

  @Prop({ type: String, required: true })
  description: string;

  @Prop({ type: Number })
  vendorResponseWindowHours?: number;

  @Prop({
    type: {
      address: String,
      city: String,
      state: String,
      pincode: String,
      type: String,
      area: Number,
      areaUnit: { type: String, enum: ['sqft', 'sqm', 'acre'] },
    },
    _id: false,
  })
  propertyDetails?: PropertyDetails;

  @Prop({
    type: {
      leadCapturedAt: Date,
      frqScheduledAt: Date,
      vendorSelectedAt: Date,
      quoteSentAt: Date,
      caseOpenedAt: Date,
      vendorStartedAt: Date,
      documentsCollectedAt: Date,
      qaReviewAt: Date,
      clientReviewAt: Date,
      closedAt: Date,
    },
    _id: false,
    default: {},
  })
  timeline: CaseTimeline;

  @Prop({
    type: [
      {
        stage: { type: String, enum: CaseStatus },
        changedAt: { type: Date, default: Date.now },
        changedBy: { type: Types.ObjectId, ref: 'User' },
        note: String,
      },
    ],
    default: [],
  })
  stageHistory: StageHistoryEntry[];

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ type: String })
  internalNotes?: string;

  @Prop({
    type: [
      {
        author: { type: Types.ObjectId, ref: 'User' },
        text: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],
    default: [],
    _id: false,
  })
  notes: CaseNote[];

  @Prop({
    type: {
      generatedAt: Date,
      s3Key: String,
      documentIds: [{ type: Types.ObjectId, ref: 'Document' }],
      totalDocs: { type: Number, default: 0 },
      archiveUrl: String,
      expiresAt: Date,
    },
    _id: false,
  })
  closingPack?: ClosingPack;

  @Prop({ type: Boolean, default: false })
  isCrossell: boolean;

  @Prop({ type: Types.ObjectId, ref: 'Case' })
  parentCaseId?: Types.ObjectId;

  @Prop({ type: Date })
  pausedAt?: Date;

  @Prop({ type: String })
  pauseReason?: string;

  @Prop({ type: Date })
  resumedAt?: Date;

  @Prop({ type: Date })
  holdReleaseScheduledAt?: Date;

  @Prop({
    type: {
      mode: { type: String, enum: ['PERCENT', 'FIXED'], default: 'PERCENT' },
      advancePercent: { type: Number, min: 0, max: 100 },
      advanceAmount: { type: Number, min: 0 },
      source: { type: String, enum: ['SETTINGS', 'ADJUSTED'] },
      setAt: Date,
      setBy: { type: Types.ObjectId, ref: 'User' },
      note: String,
      arrangementNote: String,
      history: { type: [Object], default: [] },
    },
    _id: false,
  })
  paymentPolicy?: CasePaymentPolicy;

  @Prop({
    type: {
      requestedBy: { type: Types.ObjectId, ref: 'User' },
      requestedAt: Date,
      windowEndsAt: Date,
      clientConfirmedAt: Date,
      issueRaisedAt: Date,
      issueDisputeId: { type: Types.ObjectId, ref: 'Dispute' },
      issueResolvedAt: Date,
      closedAt: Date,
      closedBy: { type: Types.ObjectId, ref: 'User' },
      closedVia: { type: String, enum: ['CLIENT_CONFIRMED', 'WINDOW_ELAPSED'] },
      payment: { type: Object },
      delivery: { type: Object },
    },
    _id: false,
  })
  closure?: CaseClosure;
}

export const CaseSchema = SchemaFactory.createForClass(Case);
