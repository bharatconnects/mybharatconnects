import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PlatformSettingsDocument = HydratedDocument<PlatformSettings>;

export const PLATFORM_SETTINGS_KEY = 'platform';

// One document for the whole platform, edited by an Admin. Kept in the
// database rather than the environment so a payment rule can be relaxed or
// tightened instantly without a redeploy.
@Schema({ timestamps: true })
export class PlatformSettings {
  @Prop({ type: String, required: true, unique: true, default: PLATFORM_SETTINGS_KEY })
  key: string;

  // Share of the accepted quote that must be paid before a case may reach
  // Case Open. 0 switches the advance rule off (the original behaviour).
  @Prop({ type: Number, min: 0, max: 100, default: 0 })
  advancePercent: number;

  // Closing a case requires the full accepted quote to be paid.
  @Prop({ type: Boolean, default: true })
  finalPaymentGateEnabled: boolean;

  // Closing a case requires every milestone to be marked delivered.
  @Prop({ type: Boolean, default: true })
  deliveryGateEnabled: boolean;

  // How long a client has to raise an issue once closure is requested
  // (7 days unless an Admin changes it).
  @Prop({ type: Number, min: 1, max: 720, default: 168 })
  closeWindowHours: number;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  updatedBy?: Types.ObjectId;

  @Prop({
    type: [
      {
        at: { type: Date, default: Date.now },
        by: { type: Types.ObjectId, ref: 'User' },
        changes: { type: Object },
        note: String,
      },
    ],
    default: [],
    _id: false,
  })
  history: { at: Date; by?: Types.ObjectId; changes: Record<string, unknown>; note?: string }[];
}

export const PlatformSettingsSchema = SchemaFactory.createForClass(PlatformSettings);
