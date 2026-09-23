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
}

export const CaseSchema = SchemaFactory.createForClass(Case);
