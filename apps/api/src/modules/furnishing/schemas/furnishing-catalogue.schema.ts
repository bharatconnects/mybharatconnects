import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type FurnishingCatalogueDocument = HydratedDocument<FurnishingCatalogue>;

export type CatalogueCategory =
  | 'FURNITURE'
  | 'LIGHTING'
  | 'DECOR'
  | 'KITCHEN'
  | 'BATHROOM'
  | 'FLOORING'
  | 'WINDOW'
  | 'OTHER';

@Schema({ timestamps: true })
export class FurnishingCatalogue {
  @Prop({ type: String, required: true })
  name: string;

  @Prop({
    type: String,
    enum: [
      'FURNITURE',
      'LIGHTING',
      'DECOR',
      'KITCHEN',
      'BATHROOM',
      'FLOORING',
      'WINDOW',
      'OTHER',
    ],
    required: true,
  })
  category: CatalogueCategory;

  @Prop({ type: String })
  description: string;

  @Prop({
    type: [
      {
        s3Key: { type: String },
        isPrimary: { type: Boolean, default: false },
      },
    ],
    default: [],
  })
  images: { s3Key: string; isPrimary: boolean }[];

  @Prop({
    type: {
      min: { type: Number },
      max: { type: Number },
      currency: { type: String, default: 'INR' },
    },
    _id: false,
  })
  priceRange: { min: number; max: number; currency: string };

  @Prop({ type: Types.ObjectId, ref: 'Vendor' })
  vendorId?: Types.ObjectId;

  @Prop({ type: String })
  brand?: string;

  @Prop({ type: Number, default: 14 })
  estimatedDeliveryDays: number;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  @Prop({ type: [String], default: [] })
  tags: string[];
}

export const FurnishingCatalogueSchema =
  SchemaFactory.createForClass(FurnishingCatalogue);
