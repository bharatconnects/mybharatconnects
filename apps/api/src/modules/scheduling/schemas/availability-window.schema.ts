import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AvailabilityWindowDocument = HydratedDocument<AvailabilityWindow>;

@Schema({ timestamps: true })
export class AvailabilityWindow {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: Number, required: true, min: 0, max: 6 })
  dayOfWeek: number; // 0=Sunday .. 6=Saturday

  @Prop({ type: Number, required: true, min: 0, max: 23 })
  startHour: number;

  @Prop({ type: Number, required: true, min: 0, max: 23 })
  endHour: number; // exclusive

  @Prop({ type: String, required: true })
  timezone: string; // IANA

  @Prop({ type: Number, required: true, default: 30 })
  slotMinutes: number;
}

export const AvailabilityWindowSchema =
  SchemaFactory.createForClass(AvailabilityWindow);
