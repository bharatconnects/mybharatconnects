import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Case, CaseDocument } from '../cases/schemas/case.schema';
import { Quote, QuoteDocument, QuoteStatus } from '../quotes/schemas/quote.schema';
import { CronLock, CronLockDocument } from './schemas/cron-lock.schema';
import { CaseEvents, QuoteEvents } from '../../common/events/case-events';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    @InjectModel(Case.name) private readonly caseModel: Model<CaseDocument>,
    @InjectModel(Quote.name) private readonly quoteModel: Model<QuoteDocument>,
    @InjectModel(CronLock.name)
    private readonly cronLockModel: Model<CronLockDocument>,
    private readonly events: EventEmitter2,
    private readonly config: ConfigService,
  ) {}

  private get disabled(): boolean {
    return (
      (
        this.config.get<string>('TASKS_DISABLED', 'false') ?? 'false'
      ).toLowerCase() === 'true'
    );
  }

  // Once autoscaling runs more than one task, every task boots its own
  // @nestjs/schedule instance and would otherwise fire every job on every
  // tick — duplicate emails, duplicate event emissions, etc. This is a
  // distributed mutex backed by Mongo (already required, no new infra):
  // the upsert only succeeds if no lock document exists yet, or the
  // existing one has expired. If another task already holds a live lock,
  // the upsert's implicit insert collides on _id and Mongo throws E11000 —
  // that failure IS the "someone else has it" signal, not an error to
  // propagate.
  private async tryAcquireLock(
    jobName: string,
    ttlMs: number,
  ): Promise<boolean> {
    const now = new Date();
    try {
      await this.cronLockModel.findOneAndUpdate(
        {
          _id: jobName,
          $or: [
            { lockedUntil: { $exists: false } },
            { lockedUntil: { $lt: now } },
          ],
        },
        { $set: { lockedUntil: new Date(now.getTime() + ttlMs) } },
        { upsert: true },
      );
      return true;
    } catch (err) {
      const isDuplicateKey =
        typeof err === 'object' &&
        err !== null &&
        (err as { code?: number }).code === 11000;
      if (isDuplicateKey) {
        return false;
      }
      throw err;
    }
  }

  // Called at the end of every job (success or already-caught failure —
  // none of these methods let an error propagate past their own try/catch,
  // so this line always runs). Releasing promptly means the next scheduled
  // tick isn't blocked waiting out the TTL; the TTL itself only matters if
  // a task dies mid-job without reaching this line.
  private async releaseLock(jobName: string): Promise<void> {
    await this.cronLockModel.deleteOne({ _id: jobName }).exec();
  }

  @Cron('0 */1 * * *')
  async releaseExpiredHolds(): Promise<void> {
    if (this.disabled) {
      return;
    }
    if (!(await this.tryAcquireLock('releaseExpiredHolds', 5 * 60 * 1000))) {
      return;
    }
    try {
    try {
      const now = new Date();
      const expired = await this.caseModel
        .find({
          pausedAt: { $exists: true, $ne: null },
          holdReleaseScheduledAt: { $lte: now },
        })
        .select('_id caseNumber holdReleaseScheduledAt')
        .exec();

      if (expired.length === 0) {
        this.logger.debug('releaseExpiredHolds: no holds due');
        return;
      }

      for (const c of expired) {
        try {
          const caseId = (c._id as { toString(): string }).toString();
          // Clear the hold marker so we don't repeatedly fire.
          // Actual payment refund/release is Phase 3 — we just log + emit.
          await this.caseModel
            .updateOne(
              { _id: c._id },
              { $unset: { holdReleaseScheduledAt: '' } },
            )
            .exec();
          this.logger.log(
            `[HOLD_RELEASED] case ${caseId} (${c.caseNumber}) — Phase 3 will wire payment refund`,
          );
          this.events.emit(CaseEvents.HOLD_RELEASED, {
            caseId,
            actorUserId: 'system',
            metadata: { caseNumber: c.caseNumber },
          });
        } catch (innerErr) {
          const msg =
            innerErr instanceof Error ? innerErr.message : 'unknown error';
          this.logger.error(`releaseExpiredHolds inner failure: ${msg}`);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown error';
      this.logger.error(`releaseExpiredHolds failed: ${msg}`);
    }
    } finally {
      await this.releaseLock('releaseExpiredHolds');
    }
  }

  @Cron('0 */1 * * *')
  async expireStaleVendorInvites(): Promise<void> {
    if (this.disabled) {
      return;
    }
    if (!(await this.tryAcquireLock('expireStaleVendorInvites', 5 * 60 * 1000))) {
      return;
    }
    try {
    try {
      const now = new Date();
      const stale = await this.quoteModel
        .find({ status: QuoteStatus.INVITED, respondBy: { $lte: now } })
        .select('_id caseId vendorId')
        .exec();

      if (stale.length === 0) {
        this.logger.debug('expireStaleVendorInvites: no stale invites');
        return;
      }

      for (const quote of stale) {
        try {
          const quoteId = (quote._id as { toString(): string }).toString();
          await this.quoteModel
            .updateOne({ _id: quote._id }, { status: QuoteStatus.EXPIRED })
            .exec();
          this.logger.log(
            `[VENDOR_INVITE_EXPIRED] quote ${quoteId} expired — notifying CM to invite a replacement vendor`,
          );
          this.events.emit(QuoteEvents.VENDOR_INVITE_EXPIRED, {
            caseId: quote.caseId.toString(),
            actorUserId: 'system',
            metadata: { quoteId, vendorId: quote.vendorId.toString() },
          });
        } catch (innerErr) {
          const msg =
            innerErr instanceof Error ? innerErr.message : 'unknown error';
          this.logger.error(`expireStaleVendorInvites inner failure: ${msg}`);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown error';
      this.logger.error(`expireStaleVendorInvites failed: ${msg}`);
    }
    } finally {
      await this.releaseLock('expireStaleVendorInvites');
    }
  }
}
