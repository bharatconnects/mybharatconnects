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

describe('Payments role matrix (e2e)', () => {
  let ctx: TestAppContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  describe('POST /api/payments/auth-hold (OPS_FINANCE, ADMIN)', () => {
    const body = {
      caseId: '507f1f77bcf86cd799439011',
      clientId: '507f1f77bcf86cd799439012',
      amountInPaise: 10000,
      description: 'test',
    };

    it('no token → 401', async () => {
      await request(ctx.app.getHttpServer())
        .post('/api/payments/auth-hold')
        .send(body)
        .expect(401);
    });

    it('wrong role (CLIENT) → 403', async () => {
      const client = await seedUser(ctx.app, Role.CLIENT);
      const { accessToken } = getTokens(ctx.app, client);
      await request(ctx.app.getHttpServer())
        .post('/api/payments/auth-hold')
        .set('Authorization', bearer(accessToken))
        .send(body)
        .expect(403);
    });

    it('right role (OPS_FINANCE) → passes guard (201, 503, or 400)', async () => {
      const fin = await seedUser(ctx.app, Role.OPS_FINANCE);
      const { accessToken } = getTokens(ctx.app, fin);
      const res = await request(ctx.app.getHttpServer())
        .post('/api/payments/auth-hold')
        .set('Authorization', bearer(accessToken))
        .send(body);
      expect([200, 201, 400, 503]).toContain(res.status);
    });
  });

  describe('POST /api/payments/request and /:id/mark-paid (CASE_MANAGER)', () => {
    async function seedOwnedCase() {
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const client = await seedUser(ctx.app, Role.CLIENT);
      const caseDoc = await seedCase(ctx.app, {
        clientId: client.userId,
        caseManagerId: cm.userId,
      });
      return { cm, client, caseDoc };
    }

    it('no token → 401', async () => {
      await request(ctx.app.getHttpServer())
        .post('/api/payments/request')
        .send({})
        .expect(401);
    });

    it('wrong role (VENDOR) → 403', async () => {
      const vendor = await seedUser(ctx.app, Role.VENDOR);
      const { accessToken } = getTokens(ctx.app, vendor);
      await request(ctx.app.getHttpServer())
        .post('/api/payments/request')
        .set('Authorization', bearer(accessToken))
        .send({
          caseId: '507f1f77bcf86cd799439011',
          clientId: '507f1f77bcf86cd799439012',
          amountInPaise: 500000,
          purpose: 'TOKEN',
          description: 'Advance token payment',
        })
        .expect(403);
    });

    it('a CM who does not own the case → 403', async () => {
      const { client, caseDoc } = await seedOwnedCase();
      const otherCm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const { accessToken } = getTokens(ctx.app, otherCm);
      await request(ctx.app.getHttpServer())
        .post('/api/payments/request')
        .set('Authorization', bearer(accessToken))
        .send({
          caseId: (caseDoc._id as Types.ObjectId).toString(),
          clientId: client.userId,
          amountInPaise: 500000,
          purpose: 'TOKEN',
          description: 'Advance token payment',
        })
        .expect(403);
    });

    it('owning CM requests a token payment, then CM/OPS_FINANCE marks it paid with a receipt', async () => {
      const { cm, client, caseDoc } = await seedOwnedCase();
      const { accessToken: cmToken } = getTokens(ctx.app, cm);

      const reqRes = await request(ctx.app.getHttpServer())
        .post('/api/payments/request')
        .set('Authorization', bearer(cmToken))
        .send({
          caseId: (caseDoc._id as Types.ObjectId).toString(),
          clientId: client.userId,
          amountInPaise: 500000,
          purpose: 'TOKEN',
          description: 'Advance token payment',
        })
        .expect(201);

      const reqBody = (reqRes.body.data ?? reqRes.body) as {
        _id: string;
        status: string;
        purpose: string;
      };
      expect(reqBody.status).toBe('PENDING');
      expect(reqBody.purpose).toBe('TOKEN');

      const payRes = await request(ctx.app.getHttpServer())
        .post(`/api/payments/${reqBody._id}/mark-paid`)
        .set('Authorization', bearer(cmToken))
        .send({ receiptDocumentId: new Types.ObjectId().toString() })
        .expect(201);

      const payBody = (payRes.body.data ?? payRes.body) as {
        status: string;
        receiptDocumentId?: string;
      };
      expect(payBody.status).toBe('CAPTURED');
      expect(payBody.receiptDocumentId).toBeDefined();

      // Already captured — a second mark-paid call must be rejected.
      await request(ctx.app.getHttpServer())
        .post(`/api/payments/${reqBody._id}/mark-paid`)
        .set('Authorization', bearer(cmToken))
        .send({})
        .expect(400);
    });
  });
});
