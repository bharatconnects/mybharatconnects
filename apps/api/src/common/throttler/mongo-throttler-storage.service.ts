import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { ThrottlerStorage } from '@nestjs/throttler';
import type { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import { ThrottleHit, ThrottleHitDocument } from './throttle-hit.schema';

// A ThrottlerStorage backed by the app's existing MongoDB — no new infra —
// so rate-limit counts are shared across every ECS task instead of each
// task keeping its own in-memory count (the default ThrottlerStorageService
// behavior, which silently multiplies every limit by the task count once
// autoscaling runs more than one).
//
// The whole "did this request exceed the limit" decision is one atomic
// aggregation-pipeline update: reset the counter if the window has expired,
// otherwise increment it, in a single findOneAndUpdate — so two requests
// hitting different tasks at the same instant can't both read a stale
// count and both slip through.
@Injectable()
export class MongoThrottlerStorage implements ThrottlerStorage {
  constructor(
    @InjectModel(ThrottleHit.name)
    private readonly hitModel: Model<ThrottleHitDocument>,
  ) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    _blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const now = Date.now();
    const id = `${throttlerName}:${key}`;

    const doc = await this.hitModel
      .findOneAndUpdate(
        { _id: id },
        [
          {
            $set: {
              totalHits: {
                $cond: [
                  {
                    $or: [
                      { $eq: ['$expiresAt', null] },
                      { $lte: ['$expiresAt', now] },
                    ],
                  },
                  1,
                  { $add: ['$totalHits', 1] },
                ],
              },
              expiresAt: {
                $cond: [
                  {
                    $or: [
                      { $eq: ['$expiresAt', null] },
                      { $lte: ['$expiresAt', now] },
                    ],
                  },
                  now + ttl,
                  '$expiresAt',
                ],
              },
            },
          },
        ],
        { upsert: true, returnDocument: 'after', updatePipeline: true },
      )
      .lean()
      .exec();

    const timeToExpire = Math.max(0, Math.ceil((doc!.expiresAt - now) / 1000));
    const isBlocked = doc!.totalHits > limit;

    return {
      totalHits: doc!.totalHits,
      timeToExpire,
      isBlocked,
      timeToBlockExpire: isBlocked ? timeToExpire : 0,
    };
  }
}
