import request from 'supertest';
import { bearer, createTestApp, getTokens, seedUser, TestAppContext } from '../setup';
import { Role } from '../../src/common/enums/roles.enum';

describe('Dashboard role matrix (e2e)', () => {
  let ctx: TestAppContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  describe('GET /api/dashboard/admin (ADMIN, CASE_MANAGER, OPS_FINANCE)', () => {
    it('no token → 401', async () => {
      await request(ctx.app.getHttpServer())
        .get('/api/dashboard/admin')
        .expect(401);
    });

    it('wrong role (CLIENT) → 403', async () => {
      const client = await seedUser(ctx.app, Role.CLIENT);
      const { accessToken } = getTokens(ctx.app, client);
      await request(ctx.app.getHttpServer())
        .get('/api/dashboard/admin')
        .set('Authorization', bearer(accessToken))
        .expect(403);
    });

    it('right role (ADMIN) → 200', async () => {
      const admin = await seedUser(ctx.app, Role.ADMIN);
      const { accessToken } = getTokens(ctx.app, admin);
      await request(ctx.app.getHttpServer())
        .get('/api/dashboard/admin')
        .set('Authorization', bearer(accessToken))
        .expect(200);
    });
  });

  describe('GET /api/dashboard/vendor-performance', () => {
    it('CLIENT → 403', async () => {
      const client = await seedUser(ctx.app, Role.CLIENT);
      const { accessToken } = getTokens(ctx.app, client);
      await request(ctx.app.getHttpServer())
        .get('/api/dashboard/vendor-performance')
        .set('Authorization', bearer(accessToken))
        .expect(403);
    });

    it('OPS_FINANCE → 200 returns an array', async () => {
      const ops = await seedUser(ctx.app, Role.OPS_FINANCE);
      const { accessToken } = getTokens(ctx.app, ops);
      const res = await request(ctx.app.getHttpServer())
        .get('/api/dashboard/vendor-performance')
        .set('Authorization', bearer(accessToken))
        .expect(200);

      const body = res.body?.data ?? res.body;
      expect(Array.isArray(body)).toBe(true);
    });
  });
});
