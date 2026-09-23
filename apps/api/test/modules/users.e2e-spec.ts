import request from 'supertest';
import { bearer, createTestApp, getTokens, seedUser, TestAppContext } from '../setup';
import { Role } from '../../src/common/enums/roles.enum';
import { Cluster } from '../../src/common/enums/cluster.enum';
import { UsersService } from '../../src/modules/users/users.service';

describe('Users role matrix (e2e)', () => {
  let ctx: TestAppContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  describe('GET /api/users (ADMIN, CASE_MANAGER)', () => {
    it('no token → 401', async () => {
      await request(ctx.app.getHttpServer()).get('/api/users').expect(401);
    });

    it('wrong role (VENDOR) → 403', async () => {
      const vendor = await seedUser(ctx.app, Role.VENDOR);
      const { accessToken } = getTokens(ctx.app, vendor);
      await request(ctx.app.getHttpServer())
        .get('/api/users')
        .set('Authorization', bearer(accessToken))
        .expect(403);
    });

    it('right role (ADMIN) → 200', async () => {
      const admin = await seedUser(ctx.app, Role.ADMIN);
      const { accessToken } = getTokens(ctx.app, admin);
      await request(ctx.app.getHttpServer())
        .get('/api/users')
        .set('Authorization', bearer(accessToken))
        .expect(200);
    });

    it('filters CASE_MANAGER by cluster=PROPERTY', async () => {
      const users = ctx.app.get(UsersService);
      const propertyCm = await users.create({
        email: `cm-prop-${Date.now()}@test.local`,
        password: 'Passw0rd!ABC',
        name: 'Prop CM',
        role: Role.CASE_MANAGER,
        cluster: Cluster.PROPERTY,
      });
      const taxCm = await users.create({
        email: `cm-tax-${Date.now()}@test.local`,
        password: 'Passw0rd!ABC',
        name: 'Tax CM',
        role: Role.CASE_MANAGER,
        cluster: Cluster.TAX,
      });

      // Service helper
      const propertyCms = await users.findCaseManagersByCluster(Cluster.PROPERTY);
      expect(propertyCms.some((u) => u.email === propertyCm.email)).toBe(true);
      expect(propertyCms.every((u) => u.cluster === Cluster.PROPERTY)).toBe(true);
      expect(propertyCms.some((u) => u.email === taxCm.email)).toBe(false);

      // Controller endpoint
      const admin = await seedUser(ctx.app, Role.ADMIN);
      const { accessToken } = getTokens(ctx.app, admin);
      const res = await request(ctx.app.getHttpServer())
        .get('/api/users?role=CASE_MANAGER&cluster=PROPERTY')
        .set('Authorization', bearer(accessToken))
        .expect(200);

      const body = res.body as { data: Array<{ email: string; cluster?: string; role: string }> };
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.some((u) => u.email === propertyCm.email)).toBe(true);
      expect(body.data.every((u) => u.cluster === Cluster.PROPERTY)).toBe(true);
      expect(body.data.every((u) => u.role === Role.CASE_MANAGER)).toBe(true);
    });
  });
});
