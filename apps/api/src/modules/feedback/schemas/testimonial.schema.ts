import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import type { ShareConsent } from './rating.schema';

export type TestimonialDocument = HydratedDocument<Testimonial>;

@Schema({ timestamps: true })
export class Testimonial {
  @Prop({ type: Types.ObjectId, ref: 'Rating', required: true })
  ratingId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  clientId: Types.ObjectId;

  @Prop({ type: String, required: true })
  clientName: string;

  @Prop({ type: String })
  clientCountry?: string;

  @Prop({ type: String, required: true })
  content: string;

  @Prop({ type: String })
  serviceType?: string;

  @Prop({ type: Boolean, default: false })
  isApproved: boolean;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  approvedBy?: Types.ObjectId;

  @Prop({ type: Number })
  featuredOrder?: number;

  // Copied from the rating it came from. When present, only the details the
  // customer agreed to share are ever shown publicly.
  @Prop({
    type: { name: Boolean, location: Boolean, service: Boolean, publish: Boolean },
    _id: false,
  })
  shareConsent?: ShareConsent;
}

export const TestimonialSchema = SchemaFactory.createForClass(Testimonial);
