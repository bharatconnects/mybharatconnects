import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type FurnishingRequestDocument = HydratedDocument<FurnishingRequest>;

export type FurnishingRequestStatus =
  | 'DRAFT'
  | 'QUOTE_REQUESTED'
  | 'QUOTE_RECEIVED'
  | 'APPROVED'
  | 'IN_PROGRESS'
  | 'DELIVERED'
  | 'COMPLETED';

@Schema({ timestamps: true })
export class FurnishingRequest {
  @Prop({ type: Types.ObjectId, ref: 'Case' })
  caseId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  clientId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  caseManagerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Property' })
  propertyId?: Types.ObjectId;

  @Prop({ type: Number, required: true })
  budgetTotal: number;

  @Prop({
    type: [
      {
        name: { type: String },
        budget: { type: Number },
        requirements: { type: String },
      },
    ],
    default: [],
  })
  rooms: { name: string; budget: number; requirements: string }[];

  @Prop({
    type: String,
    enum: [
      'DRAFT',
      'QUOTE_REQUESTED',
      'QUOTE_RECEIVED',
      'APPROVED',
      'IN_PROGRESS',
      'DELIVERED',
      'COMPLETED',
    ],
    default: 'DRAFT',
  })
  status: FurnishingRequestStatus;

  @Prop({
    type: [
      {
        catalogueItemId: { type: Types.ObjectId, ref: 'FurnishingCatalogue' },
        quantity: { type: Number },
        customNote: { type: String },
      },
    ],
    default: [],
  })
  selectedItems: {
    catalogueItemId: Types.ObjectId;
    quantity: number;
    customNote: string;
  }[];

  @Prop({
    type: [
      {
        vendorId: { type: Types.ObjectId, ref: 'Vendor' },
        totalAmount: { type: Number },
        breakdown: { type: String },
        validUntil: { type: Date },
        status: { type: String },
      },
    ],
    default: [],
  })
  vendorQuotes: {
    vendorId: Types.ObjectId;
    totalAmount: number;
    breakdown: string;
    validUntil: Date;
    status: string;
  }[];

  @Prop({ type: Types.ObjectId, ref: 'Vendor' })
  approvedQuoteVendorId?: Types.ObjectId;

  @Prop({ type: String })
  deliveryAddress: string;

  @Prop({ type: Date })
  estimatedDeliveryDate?: Date;

  @Prop({ type: Date })
  actualDeliveryDate?: Date;

  @Prop({
    type: [
      {
        s3Key: { type: String },
        type: { type: String, enum: ['BEFORE', 'AFTER'] },
        uploadedAt: { type: Date },
      },
    ],
    default: [],
  })
  clientPhotos: { s3Key: string; type: 'BEFORE' | 'AFTER'; uploadedAt: Date }[];
}

export const FurnishingRequestSchema =
  SchemaFactory.createForClass(FurnishingRequest);
