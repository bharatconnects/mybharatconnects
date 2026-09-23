import request from 'supertest';
import { Types } from 'mongoose';
import {
  bearer,
  createTestApp,
  getTokens,
  seedCase,
  seedUser,
  TestAppContext,
} from '../setup';
import { Role } from '../../src/common/enums/roles.enum';
import { decodeId } from '../../src/common/utils/id-codec';
import {
  DisputeStatus,
  DisputeType,
} from '../../src/modules/disputes/schemas/dispute.schema';

interface DisputeResponse {
  _id: string;
  caseId: string;
  raisedBy: string;
  type: DisputeType;
  status: DisputeStatus;
  description: string;
  timeline: { action: string; actorUserId: string; note?: string }[];
}

function unwrap<T>(res: { body: { data?: T } & T }): T {
  return (res.body.data ?? res.body) as T;
}

describe('Disputes module (e2e)', () => {
  let ctx: TestAppContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  describe('POST /api/disputes', () => {
    it('CASE_MANAGER creates dispute → 201 with OPEN + CREATED timeline', async () => {
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const client = await seedUser(ctx.app, Role.CLIENT);
      const caseDoc = await seedCase(ctx.app, {
        clientId: client.userId,
        caseManagerId: cm.userId,
      });
      const { accessToken } = getTokens(ctx.app, cm);

      const res = await request(ctx.app.getHttpServer())
        .post('/api/disputes')
        .set('Authorization', bearer(accessToken))
        .send({
          caseId: (caseDoc._id as Types.ObjectId).toString(),
          type: DisputeType.DELIVERABLE,
          description: 'Deliverable missing exhibits',
        })
        .expect(201);

      const body = unwrap<DisputeResponse>(res);
      expect(body.status).toBe(DisputeStatus.OPEN);
      // Response ids are opaque-encoded (see common/utils/id-codec.ts) —
      // decode before comparing against the raw hex userId from seedUser().
      expect(decodeId(body.raisedBy)).toBe(cm.userId);
      expect(body.timeline).toHaveLength(1);
      expect(body.timeline[0].action).toBe('CREATED');
    });
  });

  describe('GET /api/disputes (list)', () => {
    it('OPS_FINANCE lists disputes → 200 array', async () => {
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const client = await seedUser(ctx.app, Role.CLIENT);
      const caseDoc = await seedCase(ctx.app, {
        clientId: client.userId,
        caseManagerId: cm.userId,
      });
      const { accessToken: cmToken } = getTokens(ctx.app, cm);

      // Seed at least one dispute so the list isn't empty.
      await request(ctx.app.getHttpServer())
        .post('/api/disputes')
        .set('Authorization', bearer(cmToken))
        .send({
          caseId: (caseDoc._id as Types.ObjectId).toString(),
          type: DisputeType.VENDOR,
          description: 'Vendor unresponsive',
        })
        .expect(201);

      const lead = await seedUser(ctx.app, Role.OPS_FINANCE);
      const { accessToken } = getTokens(ctx.app, lead);
      const res = await request(ctx.app.getHttpServer())
        .get('/api/disputes')
        .set('Authorization', bearer(accessToken))
        .expect(200);

      const body = unwrap<DisputeResponse[]>(res);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('GET /api/disputes/:id (CLIENT scope)', () => {
    it('CLIENT can view own dispute but is forbidden from another client\'s', async () => {
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const owner = await seedUser(ctx.app, Role.CLIENT);
      const stranger = await seedUser(ctx.app, Role.CLIENT);
      const caseDoc = await seedCase(ctx.app, {
        clientId: owner.userId,
        caseManagerId: cm.userId,
      });

      const { accessToken: ownerToken } = getTokens(ctx.app, owner);
      const createRes = await request(ctx.app.getHttpServer())
        .post('/api/disputes')
        .set('Authorization', bearer(ownerToken))
        .send({
          caseId: (caseDoc._id as Types.ObjectId).toString(),
          type: DisputeType.PAYMENT,
          description: 'Payment held without notice',
        })
        .expect(201);
      const created = unwrap<DisputeResponse>(createRes);

      // owner → 200
      await request(ctx.app.getHttpServer())
        .get(`/api/disputes/${created._id}`)
        .set('Authorization', bearer(ownerToken))
        .expect(200);

      // stranger client → 403
      const { accessToken: strangerToken } = getTokens(ctx.app, stranger);
      await request(ctx.app.getHttpServer())
        .get(`/api/disputes/${created._id}`)
        .set('Authorization', bearer(strangerToken))
        .expect(403);
    });
  });
});
