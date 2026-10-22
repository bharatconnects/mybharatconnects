import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type QaReviewDocument = HydratedDocument<QaReview>;

export type QaReviewStatus = 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED';

// A case is checked in two separate reviews, each with its own checklist,
// decision and consequence:
//  - CLIENT_DOCUMENTS: what the client supplied. A failure sends the case back
//    to Document Collection so the client can fix it.
//  - VENDOR_DELIVERABLES: what the vendor produced. A failure sends the case
//    back to Vendor Working.
// The case only moves to Client Review once both are approved.
export type QaReviewType = 'CLIENT_DOCUMENTS' | 'VENDOR_DELIVERABLES';
export const QA_REVIEW_TYPES: QaReviewType[] = ['CLIENT_DOCUMENTS', 'VENDOR_DELIVERABLES'];

@Schema({ timestamps: true })
export class QaReview {
  @Prop({ type: Types.ObjectId, ref: 'Case', required: true })
  caseId: Types.ObjectId;

  @Prop({
    type: String,
    enum: QA_REVIEW_TYPES,
    required: true,
    default: 'VENDOR_DELIVERABLES',
  })
  reviewType: QaReviewType;

  // The QA user who took the review. Empty until someone starts it, because
  // reviews are now created automatically when a case reaches QA review.
  @Prop({ type: Types.ObjectId, ref: 'User' })
  qaLeadId?: Types.ObjectId;

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

  // Earlier rounds of this review (a rejected review is reset to Pending when
  // the case comes back to QA), kept so the history is not lost.
  @Prop({
    type: [
      {
        status: String,
        reviewedAt: Date,
        qaLeadId: { type: Types.ObjectId, ref: 'User' },
        note: String,
        rejectedItems: [String],
      },
    ],
    default: [],
    _id: false,
  })
  rounds: {
    status: string;
    reviewedAt?: Date;
    qaLeadId?: Types.ObjectId;
    note?: string;
    rejectedItems?: string[];
  }[];
}

export const QaReviewSchema = SchemaFactory.createForClass(QaReview);

// One review of each type per case. Also serves lookups by case.
QaReviewSchema.index({ caseId: 1, reviewType: 1 }, { unique: true });
