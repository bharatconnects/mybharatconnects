import request from 'supertest';
import { bearer, createTestApp, getTokens, seedUser, TestAppContext } from '../setup';
import { Role } from '../../src/common/enums/roles.enum';

describe('QA role matrix (e2e)', () => {
  let ctx: TestAppContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  describe('GET /api/qa/reviews (QA, ADMIN)', () => {
    it('no token → 401', async () => {
      await request(ctx.app.getHttpServer()).get('/api/qa/reviews').expect(401);
    });

    it('wrong role (CASE_MANAGER) → 403', async () => {
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const { accessToken } = getTokens(ctx.app, cm);
      await request(ctx.app.getHttpServer())
        .get('/api/qa/reviews')
        .set('Authorization', bearer(accessToken))
        .expect(403);
    });

    it('right role (QA) → 200', async () => {
      const qa = await seedUser(ctx.app, Role.QA);
      const { accessToken } = getTokens(ctx.app, qa);
      await request(ctx.app.getHttpServer())
        .get('/api/qa/reviews')
        .set('Authorization', bearer(accessToken))
        .expect(200);
    });
  });
});
