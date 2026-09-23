import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type FrqDocument = HydratedDocument<Frq>;

export enum FrqStatus {
  SCHEDULED = 'SCHEDULED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export interface PropertyDetails {
  type: string;
  location: string;
  budget: number;
  timeline: string;
  purpose: string;
}

@Schema({ timestamps: true })
export class Frq {
  @Prop({ type: Types.ObjectId, ref: 'Lead', required: true })
  leadId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  clientId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  caseManagerId: Types.ObjectId;

  @Prop({ type: Date, required: true })
  scheduledAt: Date;

  @Prop({ type: Date })
  completedAt: Date;

  @Prop({ type: String, enum: FrqStatus, default: FrqStatus.SCHEDULED })
  status: FrqStatus;

  @Prop({
    type: {
      type: { type: String },
      location: { type: String },
      budget: { type: Number },
      timeline: { type: String },
      purpose: { type: String },
    },
    _id: false,
  })
  propertyDetails: PropertyDetails;

  @Prop({ type: [String], default: [] })
  serviceRequirements: string[];

  @Prop({ type: String })
  notes: string;

  @Prop({ type: [String], default: [] })
  crossSellOpportunities: string[];
}

export const FrqSchema = SchemaFactory.createForClass(Frq);
