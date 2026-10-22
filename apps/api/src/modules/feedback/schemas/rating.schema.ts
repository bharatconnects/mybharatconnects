import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type RatingDocument = HydratedDocument<Rating>;

export type RatingType = 'PLATFORM' | 'CONSULTANT' | 'VENDOR';

// What the customer allows to be shown publicly. Nothing is shared unless
// they switch it on. `publish` is the master switch: without it the comment
// cannot be featured on the website at all.
export interface ShareConsent {
  name: boolean;
  location: boolean;
  service: boolean;
  publish: boolean;
}

// The details shown next to a review, as the customer confirmed or edited
// them. Pre-filled from their account, but theirs to change.
export interface ReviewerDetails {
  displayName?: string;
  location?: string;
  serviceLabel?: string;
}

@Schema({ timestamps: true })
export class Rating {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  clientId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Case' })
  caseId?: Types.ObjectId;

  @Prop({
    type: String,
    enum: ['PLATFORM', 'CONSULTANT', 'VENDOR'],
    required: true,
  })
  type: RatingType;

  @Prop({ type: Types.ObjectId })
  targetId?: Types.ObjectId;

  @Prop({ type: Number, min: 0, max: 10 })
  npsScore?: number;

  @Prop({ type: Number, min: 1, max: 5 })
  starRating?: number;

  @Prop({
    type: [
      {
        criterion: { type: String },
        score: { type: Number },
      },
    ],
    default: [],
  })
  criteriaRatings: { criterion: string; score: number }[];

  @Prop({ type: String })
  comment?: string;

  @Prop({
    type: { displayName: String, location: String, serviceLabel: String },
    _id: false,
  })
  reviewer?: ReviewerDetails;

  // Absent on feedback given before sharing choices existed.
  @Prop({
    type: { name: Boolean, location: Boolean, service: Boolean, publish: Boolean },
    _id: false,
  })
  shareConsent?: ShareConsent;

  @Prop({ type: Boolean, default: false })
  isPublic: boolean;

  @Prop({ type: Boolean, default: false })
  isApproved: boolean;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  approvedBy?: Types.ObjectId;
}

export const RatingSchema = SchemaFactory.createForClass(Rating);
