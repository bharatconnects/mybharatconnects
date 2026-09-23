import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type VendorInvoiceDocument = HydratedDocument<VendorInvoice>;

export enum VendorInvoiceStatus {
  SUBMITTED = 'SUBMITTED',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
}

export class VendorInvoiceItem {
  @Prop({ type: String, required: true })
  description: string;

  @Prop({ type: Number, required: true })
  quantity: number;

  @Prop({ type: Number, required: true })
  unitPrice: number;

  @Prop({ type: Number, required: true })
  amount: number;
}

@Schema({ timestamps: true })
export class VendorInvoice {
  @Prop({ type: String, unique: true, required: true })
  invoiceNumber: string;

  @Prop({ type: Types.ObjectId, ref: 'Case', required: true })
  caseId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Vendor', required: true })
  vendorId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Quote', required: true })
  quoteId: Types.ObjectId;

  // Present only for MILESTONE quotes — the specific milestone (already
  // marked PAID) this invoice documents. Absent for FIXED quotes, where
  // the invoice is tagged against the case/quote as a whole.
  @Prop({ type: Types.ObjectId })
  milestoneId?: Types.ObjectId;

  // Optional attached file (e.g. a scanned receipt or bill) alongside the
  // structured line items above — reuses the shared Documents module.
  @Prop({ type: Types.ObjectId, ref: 'Document' })
  attachmentDocumentId?: Types.ObjectId;

  @Prop({
    type: [
      {
        description: { type: String, required: true },
        quantity: { type: Number, required: true },
        unitPrice: { type: Number, required: true },
        amount: { type: Number, required: true },
      },
    ],
    default: [],
  })
  items: VendorInvoiceItem[];

  @Prop({ type: Number, required: true })
  subtotal: number;

  @Prop({ type: Number, default: 0 })
  gstRate: number;

  @Prop({ type: Number, default: 0 })
  gstAmount: number;

  @Prop({ type: Number, required: true })
  totalAmount: number;

  @Prop({ type: String, default: 'INR' })
  currency: string;

  @Prop({
    type: String,
    enum: VendorInvoiceStatus,
    default: VendorInvoiceStatus.SUBMITTED,
  })
  status: VendorInvoiceStatus;

  @Prop({ type: Date })
  acknowledgedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  acknowledgedBy?: Types.ObjectId;

  @Prop({ type: Object })
  metadata?: Record<string, unknown>;
}

export const VendorInvoiceSchema = SchemaFactory.createForClass(VendorInvoice);
