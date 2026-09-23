import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type BookingDocument = HydratedDocument<Booking>;

export type BookingPurpose =
  | 'DISCOVERY'
  | 'KICKOFF'
  | 'REVIEW'
  | 'THREE_WAY';

export type BookingStatus = 'SCHEDULED' | 'CANCELLED' | 'COMPLETED';

@Schema({ timestamps: true })
export class Booking {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  hostUserId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  guestUserId?: Types.ObjectId;

  @Prop({ type: String, required: true })
  guestName: string;

  @Prop({ type: String, required: true })
  guestEmail: string;

  @Prop({ type: String })
  guestTimezone?: string;

  @Prop({ type: Types.ObjectId, ref: 'Case', index: true })
  caseId?: Types.ObjectId;

  @Prop({
    type: String,
    enum: ['DISCOVERY', 'KICKOFF', 'REVIEW', 'THREE_WAY'],
    required: true,
  })
  purpose: BookingPurpose;

  @Prop({ type: Date, required: true, index: true })
  startAt: Date;

  @Prop({ type: Date, required: true })
  endAt: Date;

  @Prop({ type: Number, required: true })
  durationMinutes: number;

  @Prop({
    type: String,
    enum: ['SCHEDULED', 'CANCELLED', 'COMPLETED'],
    default: 'SCHEDULED',
    index: true,
  })
  status: BookingStatus;

  @Prop({ type: String })
  notes?: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;
}

export const BookingSchema = SchemaFactory.createForClass(Booking);
