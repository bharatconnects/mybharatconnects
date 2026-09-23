import request from 'supertest';
import { Types } from 'mongoose';
import { bearer, createTestApp, getTokens, seedUser, TestAppContext } from '../setup';
import { Role } from '../../src/common/enums/roles.enum';

describe('FRQ role matrix (e2e)', () => {
  let ctx: TestAppContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  describe('GET /api/frq/:id (CASE_MANAGER, CLIENT, ADMIN)', () => {
    const id = new Types.ObjectId().toString();

    it('no token → 401', async () => {
      await request(ctx.app.getHttpServer()).get(`/api/frq/${id}`).expect(401);
    });

    it('wrong role (VENDOR) → 403', async () => {
      const vendor = await seedUser(ctx.app, Role.VENDOR);
      const { accessToken } = getTokens(ctx.app, vendor);
      await request(ctx.app.getHttpServer())
        .get(`/api/frq/${id}`)
        .set('Authorization', bearer(accessToken))
        .expect(403);
    });

    it('right role (CASE_MANAGER) → passes guard (200 or 404)', async () => {
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const { accessToken } = getTokens(ctx.app, cm);
      const res = await request(ctx.app.getHttpServer())
        .get(`/api/frq/${id}`)
        .set('Authorization', bearer(accessToken));
      expect([200, 404]).toContain(res.status);
    });
  });
});
