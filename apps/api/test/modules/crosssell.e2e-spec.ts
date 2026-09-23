import request from 'supertest';
import { bearer, createTestApp, getTokens, seedUser, TestAppContext } from '../setup';
import { Role } from '../../src/common/enums/roles.enum';

describe('Crosssell role matrix (e2e)', () => {
  let ctx: TestAppContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  describe('GET /api/crosssell/rules (ADMIN)', () => {
    it('no token → 401', async () => {
      await request(ctx.app.getHttpServer())
        .get('/api/crosssell/rules')
        .expect(401);
    });

    it('wrong role (CASE_MANAGER) → 403', async () => {
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const { accessToken } = getTokens(ctx.app, cm);
      await request(ctx.app.getHttpServer())
        .get('/api/crosssell/rules')
        .set('Authorization', bearer(accessToken))
        .expect(403);
    });

    it('right role (ADMIN) → 200', async () => {
      const admin = await seedUser(ctx.app, Role.ADMIN);
      const { accessToken } = getTokens(ctx.app, admin);
      await request(ctx.app.getHttpServer())
        .get('/api/crosssell/rules')
        .set('Authorization', bearer(accessToken))
        .expect(200);
    });
  });

  describe('POST /api/crosssell/rules/seed → GET /api/crosssell/rules', () => {
    const EXPECTED_TRIGGERS = [
      'POA_REGISTERED',
      'PROPERTY_MGMT_ONBOARDED',
      'ITR_FILED',
      'FORM_13_ISSUED',
      'PROPERTY_SALE_COMPLETED',
      'BUYING_COMPLETE',
      'TAX_CLIENT_PARENTS_IN_INDIA',
    ];

    it('seeds 7 PDF rules and re-running is idempotent', async () => {
      const admin = await seedUser(ctx.app, Role.ADMIN);
      const { accessToken } = getTokens(ctx.app, admin);

      const seedRes = await request(ctx.app.getHttpServer())
        .post('/api/crosssell/rules/seed')
        .set('Authorization', bearer(accessToken))
        .expect(201);

      const seedBody = seedRes.body.data ?? seedRes.body;
      expect(seedBody.seeded).toBe(7);
      expect(seedBody.rules).toEqual(expect.arrayContaining(EXPECTED_TRIGGERS));

      // Re-run is idempotent (still 7, no duplicates)
      await request(ctx.app.getHttpServer())
        .post('/api/crosssell/rules/seed')
        .set('Authorization', bearer(accessToken))
        .expect(201);

      const listRes = await request(ctx.app.getHttpServer())
        .get('/api/crosssell/rules')
        .set('Authorization', bearer(accessToken))
        .expect(200);

      const rules = listRes.body.data ?? listRes.body;
      const triggers = rules.map((r: { trigger: string }) => r.trigger);
      for (const t of EXPECTED_TRIGGERS) {
        expect(triggers).toContain(t);
      }
      // Spot-check a rule with alternativeService and sentinel delay
      const onboarded = rules.find(
        (r: { trigger: string }) => r.trigger === 'PROPERTY_MGMT_ONBOARDED',
      );
      expect(onboarded.nextService).toBe('INDIAN_ITR_FILING');
      expect(onboarded.delayDays).toBe(-1);

      const poa = rules.find(
        (r: { trigger: string }) => r.trigger === 'POA_REGISTERED',
      );
      expect(poa.alternativeService).toBe('FORM_13');
      expect(poa.delayDays).toBe(7);
    });
  });
});
