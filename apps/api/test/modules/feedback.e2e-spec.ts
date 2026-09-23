import request from 'supertest';
import { bearer, createTestApp, getTokens, seedUser, TestAppContext } from '../setup';
import { Role } from '../../src/common/enums/roles.enum';

describe('Feedback role matrix (e2e)', () => {
  let ctx: TestAppContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  describe('GET /api/feedback/complaints (OPS_FINANCE, ADMIN)', () => {
    it('no token → 401', async () => {
      await request(ctx.app.getHttpServer())
        .get('/api/feedback/complaints')
        .expect(401);
    });

    it('wrong role (CLIENT) → 403', async () => {
      const client = await seedUser(ctx.app, Role.CLIENT);
      const { accessToken } = getTokens(ctx.app, client);
      await request(ctx.app.getHttpServer())
        .get('/api/feedback/complaints')
        .set('Authorization', bearer(accessToken))
        .expect(403);
    });

    it('right role (OPS_FINANCE) → 200', async () => {
      const ops = await seedUser(ctx.app, Role.OPS_FINANCE);
      const { accessToken } = getTokens(ctx.app, ops);
      await request(ctx.app.getHttpServer())
        .get('/api/feedback/complaints')
        .set('Authorization', bearer(accessToken))
        .expect(200);
    });
  });
});
