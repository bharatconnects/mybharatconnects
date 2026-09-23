import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type QaReviewDocument = HydratedDocument<QaReview>;

export type QaReviewStatus = 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED';

@Schema({ timestamps: true })
export class QaReview {
  @Prop({ type: Types.ObjectId, ref: 'Case', required: true, unique: true })
  caseId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  qaLeadId: Types.ObjectId;

  @Prop({
    type: String,
    enum: ['PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED'],
    default: 'PENDING',
  })
  status: QaReviewStatus;

  @Prop({
    type: [
      {
        item: { type: String },
        isPassed: { type: Boolean, default: false },
        note: { type: String, default: '' },
      },
    ],
    default: [],
  })
  checklist: { item: string; isPassed: boolean; note: string }[];

  @Prop({ type: Number, min: 1, max: 10 })
  overallScore?: number;

  @Prop({ type: String })
  approvalNote?: string;

  @Prop({ type: String })
  rejectionReason?: string;

  @Prop({ type: [String], default: [] })
  rejectedItems: string[];

  @Prop({ type: Date })
  reviewedAt?: Date;
}

export const QaReviewSchema = SchemaFactory.createForClass(QaReview);
