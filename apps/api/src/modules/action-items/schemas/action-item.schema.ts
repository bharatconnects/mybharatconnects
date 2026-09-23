import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ActionItemDocument = HydratedDocument<ActionItem>;

export type ActionItemStatus = 'OPEN' | 'DONE' | 'CANCELLED';

@Schema({ timestamps: true })
export class ActionItem {
  @Prop({ type: Types.ObjectId, ref: 'Case', required: true, index: true })
  caseId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  owner: Types.ObjectId;

  @Prop({ type: String, required: true })
  text: string;

  @Prop({ type: Date })
  dueDate?: Date;

  @Prop({
    type: String,
    enum: ['OPEN', 'DONE', 'CANCELLED'],
    default: 'OPEN',
  })
  status: ActionItemStatus;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop({ type: Date })
  completedAt?: Date;
}

export const ActionItemSchema = SchemaFactory.createForClass(ActionItem);
