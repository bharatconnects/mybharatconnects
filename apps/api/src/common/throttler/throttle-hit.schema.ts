import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ThrottleHitDocument = HydratedDocument<ThrottleHit>;

// One document per (throttlerName + tracker key), shared across every
// running ECS task — see MongoThrottlerStorage. Without this, each task's
// own in-memory counter means a limit like "100/60s per IP" effectively
// multiplies by however many tasks are running, since a client can be
// routed to a different task on every request.
@Schema({ collection: 'throttle_hits' })
export class ThrottleHit {
  @Prop({ type: String })
  _id: string;

  @Prop({ type: Number, required: true })
  totalHits: number;

  // Epoch ms. Doubles as both the counting-window end and the block-expiry
  // — this app never sets a distinct blockDuration, so @nestjs/throttler's
  // guard defaults it to the same value as ttl, meaning the window and any
  // resulting block always expire at the same instant.
  @Prop({ type: Number, required: true })
  expiresAt: number;
}

export const ThrottleHitSchema = SchemaFactory.createForClass(ThrottleHit);
