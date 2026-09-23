import request from 'supertest';
import { Model, Types } from 'mongoose';
import { getModelToken } from '@nestjs/mongoose';
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
  ActionItem,
  ActionItemDocument,
} from '../../src/modules/action-items/schemas/action-item.schema';

describe('ActionItems role matrix (e2e)', () => {
  let ctx: TestAppContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  describe('POST /api/cases/:caseId/actions', () => {
    it('CASE_MANAGER creates an action item (201)', async () => {
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const client = await seedUser(ctx.app, Role.CLIENT);
      const owner = await seedUser(ctx.app, Role.CASE_MANAGER);
      const caseDoc = await seedCase(ctx.app, {
        clientId: client.userId,
        caseManagerId: cm.userId,
      });
      const caseId = (caseDoc._id as Types.ObjectId).toString();

      const { accessToken } = getTokens(ctx.app, cm);
      const res = await request(ctx.app.getHttpServer())
        .post(`/api/cases/${caseId}/actions`)
        .set('Authorization', bearer(accessToken))
        .send({
          owner: owner.userId,
          text: 'Collect PAN copy',
          dueDate: '2026-07-01T00:00:00.000Z',
        })
        .expect(201);

      const body = res.body?.data ?? res.body;
      expect(body.text).toBe('Collect PAN copy');
      expect(body.status).toBe('OPEN');
      // Response ids are opaque-encoded (see common/utils/id-codec.ts) —
      // decode before comparing against the raw hex userId from seedUser().
      expect(decodeId(body.owner._id)).toBe(owner.userId);
      expect(decodeId(body.createdBy)).toBe(cm.userId);
    });
  });

  describe('GET /api/cases/:caseId/actions', () => {
    it('CLIENT (any authenticated) lists action items', async () => {
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const client = await seedUser(ctx.app, Role.CLIENT);
      const caseDoc = await seedCase(ctx.app, {
        clientId: client.userId,
        caseManagerId: cm.userId,
      });
      const caseId = (caseDoc._id as Types.ObjectId).toString();

      const itemModel = ctx.app.get<Model<ActionItemDocument>>(
        getModelToken(ActionItem.name),
      );
      await itemModel.create({
        caseId: new Types.ObjectId(caseId),
        owner: new Types.ObjectId(cm.userId),
        text: 'Visible to client list',
        status: 'OPEN',
        createdBy: new Types.ObjectId(cm.userId),
      });

      const { accessToken } = getTokens(ctx.app, client);
      const res = await request(ctx.app.getHttpServer())
        .get(`/api/cases/${caseId}/actions`)
        .set('Authorization', bearer(accessToken))
        .expect(200);

      const body = (res.body?.data ?? res.body) as Array<{ text: string }>;
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThanOrEqual(1);
      expect(body[0].text).toBe('Visible to client list');
    });
  });

  describe('PATCH /api/actions/:id', () => {
    it('non-owner non-creator → 403', async () => {
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const ownerUser = await seedUser(ctx.app, Role.CASE_MANAGER);
      const stranger = await seedUser(ctx.app, Role.CASE_MANAGER);
      const client = await seedUser(ctx.app, Role.CLIENT);
      const caseDoc = await seedCase(ctx.app, {
        clientId: client.userId,
        caseManagerId: cm.userId,
      });
      const caseId = (caseDoc._id as Types.ObjectId).toString();

      const itemModel = ctx.app.get<Model<ActionItemDocument>>(
        getModelToken(ActionItem.name),
      );
      const item = await itemModel.create({
        caseId: new Types.ObjectId(caseId),
        owner: new Types.ObjectId(ownerUser.userId),
        text: 'Reserved for owner',
        status: 'OPEN',
        createdBy: new Types.ObjectId(cm.userId),
      });
      const itemId = (item._id as Types.ObjectId).toString();

      const { accessToken } = getTokens(ctx.app, stranger);
      await request(ctx.app.getHttpServer())
        .patch(`/api/actions/${itemId}`)
        .set('Authorization', bearer(accessToken))
        .send({ status: 'DONE' })
        .expect(403);
    });
  });
});
