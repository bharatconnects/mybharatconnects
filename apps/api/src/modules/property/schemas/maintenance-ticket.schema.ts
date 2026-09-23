import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type MaintenanceTicketDocument = HydratedDocument<MaintenanceTicket>;

export type TicketCategory =
  | 'PLUMBING'
  | 'ELECTRICAL'
  | 'STRUCTURAL'
  | 'APPLIANCE'
  | 'OTHER';

export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

@Schema({ timestamps: true })
export class MaintenanceTicket {
  @Prop({ type: Types.ObjectId, ref: 'Property', required: true })
  propertyId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  raisedBy: Types.ObjectId;

  @Prop({ type: String, required: true })
  title: string;

  @Prop({ type: String, required: true })
  description: string;

  @Prop({
    type: String,
    enum: ['PLUMBING', 'ELECTRICAL', 'STRUCTURAL', 'APPLIANCE', 'OTHER'],
  })
  category: TicketCategory;

  @Prop({
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
  })
  priority: TicketPriority;

  @Prop({
    type: String,
    enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
    default: 'OPEN',
  })
  status: TicketStatus;

  @Prop({ type: Types.ObjectId, ref: 'Vendor' })
  assignedVendorId?: Types.ObjectId;

  @Prop({ type: Number })
  estimatedCost?: number;

  @Prop({ type: Number })
  actualCost?: number;

  @Prop({ type: Date })
  resolvedAt?: Date;

  @Prop({
    type: [
      {
        s3Key: { type: String },
        uploadedAt: { type: Date },
      },
    ],
    default: [],
  })
  photos: { s3Key: string; uploadedAt: Date }[];
}

export const MaintenanceTicketSchema =
  SchemaFactory.createForClass(MaintenanceTicket);
