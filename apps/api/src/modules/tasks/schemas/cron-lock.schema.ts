import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CronLockDocument = HydratedDocument<CronLock>;

// One document per job name, acting as a distributed mutex across every
// running task — see TasksService.tryAcquireLock() for how it's used.
@Schema({ collection: 'cron_locks' })
export class CronLock {
  @Prop({ type: String })
  _id: string;

  @Prop({ type: Date, required: true })
  lockedUntil: Date;
}

export const CronLockSchema = SchemaFactory.createForClass(CronLock);
