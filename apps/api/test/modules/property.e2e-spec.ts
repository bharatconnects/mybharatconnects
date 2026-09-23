import request from 'supertest';
import { bearer, createTestApp, getTokens, seedUser, TestAppContext } from '../setup';
import { Role } from '../../src/common/enums/roles.enum';

describe('Property role matrix (e2e)', () => {
  let ctx: TestAppContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  describe('GET /api/property (CLIENT, ADMIN)', () => {
    it('no token → 401', async () => {
      await request(ctx.app.getHttpServer()).get('/api/property').expect(401);
    });

    it('wrong role (VENDOR) → 403', async () => {
      const vendor = await seedUser(ctx.app, Role.VENDOR);
      const { accessToken } = getTokens(ctx.app, vendor);
      await request(ctx.app.getHttpServer())
        .get('/api/property')
        .set('Authorization', bearer(accessToken))
        .expect(403);
    });

    it('right role (CLIENT) → 200', async () => {
      const client = await seedUser(ctx.app, Role.CLIENT);
      const { accessToken } = getTokens(ctx.app, client);
      await request(ctx.app.getHttpServer())
        .get('/api/property')
        .set('Authorization', bearer(accessToken))
        .expect(200);
    });
  });

  describe('Cross-tenant IDOR', () => {
    async function seedPropertyForClient(clientUserId: string) {
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const { accessToken } = getTokens(ctx.app, await seedUser(ctx.app, Role.ADMIN));
      const res = await request(ctx.app.getHttpServer())
        .post('/api/property')
        .set('Authorization', bearer(accessToken))
        .send({
          ownerId: clientUserId,
          caseManagerId: cm.userId,
          address: {
            street: '1 Test St',
            city: 'Mumbai',
            state: 'MH',
            pincode: '400001',
            country: 'India',
          },
          type: 'APARTMENT',
        })
        .expect(201);
      return (res.body?.data ?? res.body) as { _id: string };
    }

    it("a CLIENT cannot view another client's property", async () => {
      const owner = await seedUser(ctx.app, Role.CLIENT);
      const property = await seedPropertyForClient(owner.userId);

      const intruder = await seedUser(ctx.app, Role.CLIENT);
      const { accessToken } = getTokens(ctx.app, intruder);

      await request(ctx.app.getHttpServer())
        .get(`/api/property/${property._id}`)
        .set('Authorization', bearer(accessToken))
        .expect(403);
    });

    it("a CLIENT cannot record rent on another client's property", async () => {
      const owner = await seedUser(ctx.app, Role.CLIENT);
      const property = await seedPropertyForClient(owner.userId);

      const intruder = await seedUser(ctx.app, Role.CLIENT);
      const { accessToken } = getTokens(ctx.app, intruder);

      await request(ctx.app.getHttpServer())
        .post(`/api/property/${property._id}/rent`)
        .set('Authorization', bearer(accessToken))
        .send({
          tenantId: intruder.userId,
          amount: 50000,
          month: '2026-08',
          dueDate: new Date().toISOString(),
        })
        .expect(403);
    });

    it('GET /api/property?ownerId=<other> does not leak another client\'s properties', async () => {
      const owner = await seedUser(ctx.app, Role.CLIENT);
      await seedPropertyForClient(owner.userId);

      const intruder = await seedUser(ctx.app, Role.CLIENT);
      const { accessToken } = getTokens(ctx.app, intruder);

      const res = await request(ctx.app.getHttpServer())
        .get(`/api/property?ownerId=${owner.userId}`)
        .set('Authorization', bearer(accessToken))
        .expect(200);
      const body = (res.body?.data ?? res.body) as unknown[];
      expect(body).toEqual([]);
    });

    it('a CLIENT can view and act on their own property', async () => {
      const owner = await seedUser(ctx.app, Role.CLIENT);
      const property = await seedPropertyForClient(owner.userId);
      const { accessToken } = getTokens(ctx.app, owner);

      await request(ctx.app.getHttpServer())
        .get(`/api/property/${property._id}`)
        .set('Authorization', bearer(accessToken))
        .expect(200);
    });
  });
});
