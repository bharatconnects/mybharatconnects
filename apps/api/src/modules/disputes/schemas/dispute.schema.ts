import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type DisputeDocument = HydratedDocument<Dispute>;

export enum DisputeType {
  CHARGEBACK = 'CHARGEBACK',
  DELIVERABLE = 'DELIVERABLE',
  PAYMENT = 'PAYMENT',
  VENDOR = 'VENDOR',
  OTHER = 'OTHER',
}

export enum DisputeStatus {
  OPEN = 'OPEN',
  INVESTIGATING = 'INVESTIGATING',
  RESOLVED = 'RESOLVED',
  REJECTED = 'REJECTED',
}

export type DisputeTimelineAction =
  | 'CREATED'
  | 'NOTE_ADDED'
  | 'ESCALATED'
  | 'RESOLVED'
  | 'REJECTED';

export class DisputeTimelineEntry {
  @Prop({ type: Date, default: Date.now })
  at: Date;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  actorUserId: Types.ObjectId;

  @Prop({ type: String, required: true })
  action: DisputeTimelineAction;

  @Prop({ type: String })
  note?: string;
}

@Schema({ timestamps: true })
export class Dispute {
  @Prop({ type: Types.ObjectId, ref: 'Case', required: true, index: true })
  caseId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  raisedBy: Types.ObjectId;

  @Prop({ type: String, enum: DisputeType, required: true })
  type: DisputeType;

  @Prop({
    type: String,
    enum: DisputeStatus,
    default: DisputeStatus.OPEN,
    index: true,
  })
  status: DisputeStatus;

  @Prop({ type: String, required: true })
  description: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Document' }], default: [] })
  evidenceDocumentIds: Types.ObjectId[];

  @Prop({
    type: [
      {
        at: { type: Date, default: Date.now },
        actorUserId: { type: Types.ObjectId, ref: 'User', required: true },
        action: { type: String, required: true },
        note: { type: String },
      },
    ],
    default: [],
    _id: false,
  })
  timeline: DisputeTimelineEntry[];

  @Prop({ type: String })
  resolution?: string;

  @Prop({ type: Date })
  resolvedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  resolvedBy?: Types.ObjectId;
}

export const DisputeSchema = SchemaFactory.createForClass(Dispute);
