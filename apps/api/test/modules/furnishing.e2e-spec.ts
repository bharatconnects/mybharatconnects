import request from 'supertest';
import { bearer, createTestApp, getTokens, seedUser, TestAppContext } from '../setup';
import { Role } from '../../src/common/enums/roles.enum';

describe('Furnishing role matrix (e2e)', () => {
  let ctx: TestAppContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  describe('GET /api/furnishing/requests (CLIENT, CASE_MANAGER, ADMIN)', () => {
    it('no token → 401', async () => {
      await request(ctx.app.getHttpServer())
        .get('/api/furnishing/requests')
        .expect(401);
    });

    it('wrong role (VENDOR) → 403', async () => {
      const vendor = await seedUser(ctx.app, Role.VENDOR);
      const { accessToken } = getTokens(ctx.app, vendor);
      await request(ctx.app.getHttpServer())
        .get('/api/furnishing/requests')
        .set('Authorization', bearer(accessToken))
        .expect(403);
    });

    it('right role (CASE_MANAGER) → 200', async () => {
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const { accessToken } = getTokens(ctx.app, cm);
      await request(ctx.app.getHttpServer())
        .get('/api/furnishing/requests')
        .set('Authorization', bearer(accessToken))
        .expect(200);
    });
  });

  describe('Cross-tenant IDOR', () => {
    async function seedRequestFor(clientUserId: string, cmUserId: string) {
      const { accessToken } = getTokens(ctx.app, await seedUser(ctx.app, Role.ADMIN));
      const res = await request(ctx.app.getHttpServer())
        .post('/api/furnishing/requests')
        .set('Authorization', bearer(accessToken))
        .send({
          clientId: clientUserId,
          caseManagerId: cmUserId,
          budgetTotal: 100000,
          rooms: [],
          deliveryAddress: '1 Test St, Mumbai',
        })
        .expect(201);
      return (res.body?.data ?? res.body) as { _id: string };
    }

    it("a CLIENT cannot view another client's furnishing request", async () => {
      const owner = await seedUser(ctx.app, Role.CLIENT);
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const req = await seedRequestFor(owner.userId, cm.userId);

      const intruder = await seedUser(ctx.app, Role.CLIENT);
      const { accessToken } = getTokens(ctx.app, intruder);

      await request(ctx.app.getHttpServer())
        .get(`/api/furnishing/requests/${req._id}`)
        .set('Authorization', bearer(accessToken))
        .expect(403);
    });

    it("a CASE_MANAGER cannot approve a quote on a request they don't manage", async () => {
      const owner = await seedUser(ctx.app, Role.CLIENT);
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const req = await seedRequestFor(owner.userId, cm.userId);

      const otherCm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const { accessToken } = getTokens(ctx.app, otherCm);

      await request(ctx.app.getHttpServer())
        .patch(`/api/furnishing/requests/${req._id}/approve`)
        .set('Authorization', bearer(accessToken))
        .send({ vendorId: owner.userId })
        .expect(403);
    });

    it('a CLIENT can view their own furnishing request', async () => {
      const owner = await seedUser(ctx.app, Role.CLIENT);
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const req = await seedRequestFor(owner.userId, cm.userId);
      const { accessToken } = getTokens(ctx.app, owner);

      await request(ctx.app.getHttpServer())
        .get(`/api/furnishing/requests/${req._id}`)
        .set('Authorization', bearer(accessToken))
        .expect(200);
    });
  });
});
