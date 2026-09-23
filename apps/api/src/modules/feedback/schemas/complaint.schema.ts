import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ComplaintDocument = HydratedDocument<Complaint>;

export type ComplaintCategory =
  | 'SERVICE_QUALITY'
  | 'DELAY'
  | 'COMMUNICATION'
  | 'BILLING'
  | 'OTHER';

export type ComplaintStatus = 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'CLOSED';

@Schema({ timestamps: true })
export class Complaint {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  raisedBy: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Case' })
  caseId?: Types.ObjectId;

  @Prop({
    type: String,
    enum: ['SERVICE_QUALITY', 'DELAY', 'COMMUNICATION', 'BILLING', 'OTHER'],
    required: true,
  })
  category: ComplaintCategory;

  @Prop({ type: String, required: true })
  subject: string;

  @Prop({ type: String, required: true })
  description: string;

  @Prop({
    type: String,
    enum: ['OPEN', 'IN_REVIEW', 'RESOLVED', 'CLOSED'],
    default: 'OPEN',
  })
  status: ComplaintStatus;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  assignedTo?: Types.ObjectId;

  @Prop({ type: String })
  resolution?: string;

  @Prop({ type: Date })
  resolvedAt?: Date;
}

export const ComplaintSchema = SchemaFactory.createForClass(Complaint);
