import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type RatingDocument = HydratedDocument<Rating>;

export type RatingType = 'PLATFORM' | 'CONSULTANT' | 'VENDOR';

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

  @Prop({ type: Boolean, default: false })
  isPublic: boolean;

  @Prop({ type: Boolean, default: false })
  isApproved: boolean;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  approvedBy?: Types.ObjectId;
}

export const RatingSchema = SchemaFactory.createForClass(Rating);
