import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type TenantDocument = HydratedDocument<Tenant>;

@Schema({ timestamps: true })
export class Tenant {
  @Prop({ type: Types.ObjectId, ref: 'Property', required: true })
  propertyId: Types.ObjectId;

  @Prop({ type: String, required: true })
  name: string;

  @Prop({ type: String, required: true })
  email: string;

  @Prop({ type: String, required: true })
  phone: string;

  @Prop({ type: Date, required: true })
  leaseStartDate: Date;

  @Prop({ type: Date, required: true })
  leaseEndDate: Date;

  @Prop({ type: Number, required: true })
  monthlyRent: number;

  @Prop({ type: Number })
  securityDeposit: number;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  @Prop({
    type: [
      {
        name: { type: String },
        s3Key: { type: String },
      },
    ],
    default: [],
  })
  documents: { name: string; s3Key: string }[];
}

export const TenantSchema = SchemaFactory.createForClass(Tenant);
