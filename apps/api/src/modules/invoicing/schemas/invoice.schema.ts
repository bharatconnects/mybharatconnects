import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type InvoiceDocument = HydratedDocument<Invoice>;

export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  ISSUED = 'ISSUED',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
}

export class InvoiceBillingAddress {
  @Prop({ type: String, required: true })
  name: string;

  @Prop({ type: String, required: true })
  line1: string;

  @Prop({ type: String })
  line2?: string;

  @Prop({ type: String, required: true })
  city: string;

  @Prop({ type: String, required: true })
  state: string;

  @Prop({ type: String, required: true })
  pincode: string;

  @Prop({ type: String, required: true, default: 'India' })
  country: string;

  @Prop({ type: String })
  gstin?: string;
}

export class InvoiceItem {
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
export class Invoice {
  @Prop({ type: String, unique: true, required: true })
  invoiceNumber: string;

  @Prop({ type: Types.ObjectId, ref: 'Case', required: true })
  caseId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  clientId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Quote' })
  quoteId?: Types.ObjectId;

  // Which vendor invoice(s) this client bill was built from — set when a CM
  // uses the "build from vendor invoice" picker rather than a blank form.
  @Prop({ type: [{ type: Types.ObjectId, ref: 'VendorInvoice' }], default: [] })
  sourceVendorInvoiceIds: Types.ObjectId[];

  // Optional attached file/slip (e.g. a scanned receipt) alongside the
  // structured line items above — reuses the shared Documents module.
  @Prop({ type: Types.ObjectId, ref: 'Document' })
  attachmentDocumentId?: Types.ObjectId;

  // Set when this invoice was created from "Use Stripe receipt" — the
  // Stripe-hosted receipt URL for the payment it bills, in place of (or
  // alongside) a manually uploaded attachment.
  @Prop({ type: String })
  externalReceiptUrl?: string;

  // The payment this invoice was generated from, when created via "Use
  // Stripe receipt" — lets the UI avoid offering that shortcut twice for
  // the same payment.
  @Prop({ type: Types.ObjectId, ref: 'Payment' })
  sourcePaymentId?: Types.ObjectId;

  @Prop({
    type: {
      name: { type: String, required: true },
      line1: { type: String, required: true },
      line2: String,
      city: { type: String, required: true },
      state: { type: String, required: true },
      pincode: { type: String, required: true },
      country: { type: String, required: true, default: 'India' },
      gstin: String,
    },
    required: true,
    _id: false,
  })
  billingAddress: InvoiceBillingAddress;

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
  items: InvoiceItem[];

  @Prop({ type: Number, required: true })
  subtotal: number;

  @Prop({ type: Number, default: 0 })
  cgstRate: number;

  @Prop({ type: Number, default: 0 })
  sgstRate: number;

  @Prop({ type: Number, default: 0 })
  igstRate: number;

  @Prop({ type: Number, default: 0 })
  cgstAmount: number;

  @Prop({ type: Number, default: 0 })
  sgstAmount: number;

  @Prop({ type: Number, default: 0 })
  igstAmount: number;

  @Prop({ type: Number, required: true })
  totalAmount: number;

  @Prop({ type: String, default: 'INR' })
  currency: string;

  @Prop({ type: String, enum: InvoiceStatus, default: InvoiceStatus.DRAFT })
  status: InvoiceStatus;

  @Prop({ type: Date })
  issuedAt?: Date;

  @Prop({ type: Date })
  paidAt?: Date;

  @Prop({ type: String })
  pdfS3Key?: string;

  @Prop({ type: Object })
  metadata?: Record<string, unknown>;
}

export const InvoiceSchema = SchemaFactory.createForClass(Invoice);
