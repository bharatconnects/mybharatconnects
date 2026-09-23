import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PropertyDocument = HydratedDocument<Property>;

export type PropertyType = 'APARTMENT' | 'VILLA' | 'PLOT' | 'COMMERCIAL';
export type PropertyStatus = 'VACANT' | 'OCCUPIED' | 'UNDER_MAINTENANCE';

@Schema({ timestamps: true })
export class Property {
  @Prop({ type: Types.ObjectId, ref: 'Case' })
  caseId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  ownerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  caseManagerId: Types.ObjectId;

  @Prop({
    type: {
      street: { type: String },
      city: { type: String },
      state: { type: String },
      pincode: { type: String },
      country: { type: String },
    },
    _id: false,
  })
  address: {
    street: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };

  @Prop({
    type: String,
    enum: ['APARTMENT', 'VILLA', 'PLOT', 'COMMERCIAL'],
    required: true,
  })
  type: PropertyType;

  @Prop({ type: Number })
  areaSqft: number;

  @Prop({
    type: String,
    enum: ['VACANT', 'OCCUPIED', 'UNDER_MAINTENANCE'],
    default: 'VACANT',
  })
  currentStatus: PropertyStatus;

  @Prop({ type: Number })
  monthlyRent?: number;

  @Prop({ type: Number })
  securityDeposit?: number;

  @Prop({ type: Number, default: 5 })
  managementFeePercent: number;
}

export const PropertySchema = SchemaFactory.createForClass(Property);
