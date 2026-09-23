import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type VendorDocument = HydratedDocument<Vendor>;

export interface BankDetails {
  accountNumber: string;
  ifsc: string;
  accountName: string;
}

export interface VendorDocument_ {
  name: string;
  s3Key: string;
  uploadedAt: Date;
}

@Schema({ timestamps: true })
export class Vendor {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  userId: Types.ObjectId;

  @Prop({ type: String, required: true })
  businessName: string;

  @Prop({ type: [String], required: true })
  serviceTypes: string[];

  @Prop({ type: [String], required: true })
  cities: string[];

  @Prop({ type: [String], default: ['English', 'Hindi'] })
  languages: string[];

  @Prop({ type: Number, default: 5, min: 1, max: 5 })
  rating: number;

  @Prop({ type: Number, default: 0 })
  totalJobs: number;

  @Prop({ type: Number, default: 0 })
  completedJobs: number;

  @Prop({ type: Boolean, default: true })
  isAvailable: boolean;

  @Prop({ type: Number, default: 5 })
  maxConcurrentJobs: number;

  @Prop({ type: Number, default: 0 })
  currentJobs: number;

  @Prop({
    type: {
      accountNumber: { type: String },
      ifsc: { type: String },
      accountName: { type: String },
    },
    _id: false,
  })
  bankDetails: BankDetails;

  @Prop({
    type: [
      {
        name: { type: String },
        s3Key: { type: String },
        uploadedAt: { type: Date },
      },
    ],
    default: [],
  })
  documents: { name: string; s3Key: string; uploadedAt: Date }[];

  @Prop({ type: Boolean, default: false })
  isVerified: boolean;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  verifiedBy: Types.ObjectId;
}

export const VendorSchema = SchemaFactory.createForClass(Vendor);
