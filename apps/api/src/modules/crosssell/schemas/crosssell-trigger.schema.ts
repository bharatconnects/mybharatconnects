import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CrosssellTriggerDocument = HydratedDocument<CrosssellTrigger>;

export type CrosssellTriggerStatus =
  | 'PENDING'
  | 'SENT'
  | 'CONVERTED'
  | 'DISMISSED';

@Schema({ timestamps: true })
export class CrosssellTrigger {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  clientId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Case', required: true })
  caseId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'CrosssellRule', required: true })
  ruleId: Types.ObjectId;

  @Prop({
    type: String,
    enum: ['PENDING', 'SENT', 'CONVERTED', 'DISMISSED'],
    default: 'PENDING',
  })
  status: CrosssellTriggerStatus;

  @Prop({ type: Date, required: true })
  scheduledAt: Date;

  @Prop({ type: Date })
  sentAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'Case' })
  convertedCaseId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  caseManagerId: Types.ObjectId;
}

export const CrosssellTriggerSchema =
  SchemaFactory.createForClass(CrosssellTrigger);
