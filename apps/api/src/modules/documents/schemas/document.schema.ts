import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type DocumentDocument = HydratedDocument<Document>;

export enum DocumentCategory {
  IDENTITY = 'IDENTITY',
  PROPERTY = 'PROPERTY',
  FINANCIAL = 'FINANCIAL',
  LEGAL = 'LEGAL',
  AGREEMENT = 'AGREEMENT',
  OTHER = 'OTHER',
}

export enum VerificationStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  REJECTED_ILLEGIBLE = 'REJECTED_ILLEGIBLE',
}

export interface DocumentComment {
  author: Types.ObjectId;
  page?: number;
  x?: number;
  y?: number;
  text: string;
  createdAt: Date;
}

@Schema({ timestamps: true })
export class Document {
  @Prop({ type: Types.ObjectId, ref: 'Case', required: true })
  caseId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  uploadedBy: Types.ObjectId;

  @Prop({ type: String, enum: DocumentCategory, required: true })
  category: DocumentCategory;

  @Prop({ type: String, required: true })
  name: string;

  @Prop({ type: String, required: true })
  originalFileName: string;

  @Prop({ type: String, required: true, unique: true })
  s3Key: string;

  @Prop({ type: String, required: true })
  s3Bucket: string;

  @Prop({ type: String, required: true })
  mimeType: string;

  @Prop({ type: Number, required: true })
  sizeBytes: number;

  @Prop({ type: Boolean, default: false })
  isVerified: boolean;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  verifiedBy?: Types.ObjectId;

  @Prop({ type: Date })
  verifiedAt?: Date;

  @Prop({ type: Date })
  uploadedAt?: Date;

  @Prop({ type: Date })
  expiresAt?: Date;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ type: String })
  cmAnnotation?: string;

  @Prop({
    type: String,
    enum: VerificationStatus,
    default: VerificationStatus.PENDING,
  })
  verificationStatus: VerificationStatus;

  @Prop({
    type: [
      {
        author: { type: Types.ObjectId, ref: 'User' },
        page: { type: Number },
        x: { type: Number },
        y: { type: Number },
        text: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    default: [],
    _id: false,
  })
  comments: DocumentComment[];

  @Prop({ type: Boolean, default: false })
  clientVisible: boolean;

  @Prop({ type: Boolean, default: false })
  vendorVisible: boolean;

  @Prop({ type: Date })
  visibilityUpdatedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  visibilityUpdatedBy?: Types.ObjectId;
}

export const DocumentSchema = SchemaFactory.createForClass(Document);
