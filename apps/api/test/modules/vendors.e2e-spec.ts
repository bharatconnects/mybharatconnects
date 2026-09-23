import request from 'supertest';
import { bearer, createTestApp, getTokens, seedUser, TestAppContext } from '../setup';
import { Role } from '../../src/common/enums/roles.enum';

describe('Vendors role matrix (e2e)', () => {
  let ctx: TestAppContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  describe('GET /api/vendors (CASE_MANAGER, ADMIN)', () => {
    it('no token → 401', async () => {
      await request(ctx.app.getHttpServer()).get('/api/vendors').expect(401);
    });

    it('wrong role (CLIENT) → 403', async () => {
      const client = await seedUser(ctx.app, Role.CLIENT);
      const { accessToken } = getTokens(ctx.app, client);
      await request(ctx.app.getHttpServer())
        .get('/api/vendors')
        .set('Authorization', bearer(accessToken))
        .expect(403);
    });

    it('right role (ADMIN) → 200', async () => {
      const admin = await seedUser(ctx.app, Role.ADMIN);
      const { accessToken } = getTokens(ctx.app, admin);
      await request(ctx.app.getHttpServer())
        .get('/api/vendors')
        .set('Authorization', bearer(accessToken))
        .expect(200);
    });
  });
});
