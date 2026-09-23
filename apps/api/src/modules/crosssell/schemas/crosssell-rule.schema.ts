import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CrosssellRuleDocument = HydratedDocument<CrosssellRule>;

@Schema({ timestamps: true })
export class CrosssellRule {
  @Prop({ type: String, required: false, unique: true, sparse: true })
  name?: string;

  // PDF-aligned fields (Phase 1)
  @Prop({ type: String, required: true, index: true })
  trigger: string;

  @Prop({ type: String, required: true })
  nextService: string;

  @Prop({ type: String })
  alternativeService?: string;

  // -1 sentinel = "first March after onboarding"; 0 = soft prompt; >0 = days
  @Prop({ type: Number, default: 0 })
  delayDays: number;

  @Prop({ type: String })
  description?: string;

  // Legacy fields kept for backward compatibility with evaluateTriggers()
  @Prop({ type: String })
  triggerEvent?: string;

  @Prop({ type: String })
  sourceServiceType?: string;

  @Prop({ type: String })
  suggestedServiceType?: string;

  @Prop({ type: String })
  messageTemplate?: string;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  @Prop({ type: Number, default: 1 })
  priority: number;
}

export const CrosssellRuleSchema = SchemaFactory.createForClass(CrosssellRule);
