import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type RentPaymentDocument = HydratedDocument<RentPayment>;

export type RentPaymentStatus = 'PENDING' | 'PAID' | 'OVERDUE';

@Schema({ timestamps: true })
export class RentPayment {
  @Prop({ type: Types.ObjectId, ref: 'Property', required: true })
  propertyId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true })
  tenantId: Types.ObjectId;

  @Prop({ type: String, required: true })
  month: string;

  @Prop({ type: Number, required: true })
  amount: number;

  @Prop({ type: Date, required: true })
  dueDate: Date;

  @Prop({ type: Date })
  paidDate?: Date;

  @Prop({
    type: String,
    enum: ['PENDING', 'PAID', 'OVERDUE'],
    default: 'PENDING',
  })
  status: RentPaymentStatus;

  @Prop({ type: String })
  paymentMethod?: string;

  @Prop({ type: String })
  receiptNumber?: string;
}

export const RentPaymentSchema = SchemaFactory.createForClass(RentPayment);
