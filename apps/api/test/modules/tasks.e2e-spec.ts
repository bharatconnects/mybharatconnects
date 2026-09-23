import { Types } from 'mongoose';
import type { Model } from 'mongoose';
import { getModelToken } from '@nestjs/mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { createTestApp, seedCase, seedUser, TestAppContext } from '../setup';
import { Role } from '../../src/common/enums/roles.enum';
import { CaseEvents } from '../../src/common/events/case-events';
import {
  Case,
  CaseDocument,
} from '../../src/modules/cases/schemas/case.schema';
import { TasksService } from '../../src/modules/tasks/tasks.service';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('Tasks scheduler (e2e)', () => {
  let ctx: TestAppContext;
  let tasks: TasksService;

  beforeAll(async () => {
    ctx = await createTestApp();
    tasks = ctx.app.get(TasksService);
  });

  afterAll(async () => {
    await ctx.close();
  });

  describe('releaseExpiredHolds', () => {
    it('clears holdReleaseScheduledAt when due (paused case past release)', async () => {
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const client = await seedUser(ctx.app, Role.CLIENT);
      const caseDoc = await seedCase(ctx.app, {
        clientId: client.userId,
        caseManagerId: cm.userId,
      });
      const caseId = (caseDoc._id as Types.ObjectId).toString();

      const caseModel = ctx.app.get<Model<CaseDocument>>(
        getModelToken(Case.name),
      );
      const pastDate = new Date(Date.now() - 60 * 60 * 1000); // 1h ago
      await caseModel
        .updateOne(
          { _id: caseDoc._id },
          {
            $set: {
              pausedAt: new Date(Date.now() - 22 * DAY_MS),
              holdReleaseScheduledAt: pastDate,
              pauseReason: 'unreachable',
            },
          },
        )
        .exec();

      await tasks.releaseExpiredHolds();

      const reloaded = await caseModel.findById(caseId).exec();
      expect(reloaded?.holdReleaseScheduledAt).toBeUndefined();
      // pausedAt is intentionally retained — Phase 3 will manage the
      // full unpause flow; we only clear the schedule marker.
      expect(reloaded?.pausedAt).toBeInstanceOf(Date);
    });

    it('does NOT touch cases whose hold is still in the future', async () => {
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const client = await seedUser(ctx.app, Role.CLIENT);
      const caseDoc = await seedCase(ctx.app, {
        clientId: client.userId,
        caseManagerId: cm.userId,
      });
      const futureDate = new Date(Date.now() + 10 * DAY_MS);
      const caseModel = ctx.app.get<Model<CaseDocument>>(
        getModelToken(Case.name),
      );
      await caseModel
        .updateOne(
          { _id: caseDoc._id },
          {
            $set: {
              pausedAt: new Date(),
              holdReleaseScheduledAt: futureDate,
              pauseReason: 'unreachable',
            },
          },
        )
        .exec();

      await tasks.releaseExpiredHolds();

      const reloaded = await caseModel
        .findById((caseDoc._id as Types.ObjectId).toString())
        .exec();
      expect(reloaded?.holdReleaseScheduledAt).toBeInstanceOf(Date);
    });

    it('running two overlapping instances of the same job only does the work once (distributed lock)', async () => {
      // Simulates what happens once autoscaling runs >1 task: every task's
      // own @nestjs/schedule fires the same job on the same tick. Without
      // TasksService.tryAcquireLock()/releaseLock(), both concurrent calls
      // would race past the read-then-write and both process the case,
      // emitting HOLD_RELEASED twice for one release.
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const client = await seedUser(ctx.app, Role.CLIENT);
      const caseDoc = await seedCase(ctx.app, {
        clientId: client.userId,
        caseManagerId: cm.userId,
      });
      const caseModel = ctx.app.get<Model<CaseDocument>>(
        getModelToken(Case.name),
      );
      await caseModel
        .updateOne(
          { _id: caseDoc._id },
          {
            $set: {
              pausedAt: new Date(Date.now() - 22 * DAY_MS),
              holdReleaseScheduledAt: new Date(Date.now() - 60 * 1000),
              pauseReason: 'unreachable',
            },
          },
        )
        .exec();

      const events = ctx.app.get(EventEmitter2);
      let holdReleasedCount = 0;
      const listener = () => {
        holdReleasedCount++;
      };
      events.on(CaseEvents.HOLD_RELEASED, listener);

      await Promise.all([
        tasks.releaseExpiredHolds(),
        tasks.releaseExpiredHolds(),
      ]);

      events.off(CaseEvents.HOLD_RELEASED, listener);
      expect(holdReleasedCount).toBe(1);
    });
  });

});
