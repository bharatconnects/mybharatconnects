import request from 'supertest';
import {
  bearer,
  createTestApp,
  getTokens,
  seedCase,
  seedUser,
  TestAppContext,
} from '../setup';
import { Role } from '../../src/common/enums/roles.enum';

function unwrap<T>(res: { body: { data?: T } & T }): T {
  return (res.body.data ?? res.body) as T;
}

interface CaseReportRow {
  caseId: string;
  caseNumber: string;
  status: string;
  caseManagerName?: string;
  clientName?: string;
}

describe('Reports module (e2e)', () => {
  let ctx: TestAppContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  describe('GET /api/reports/cases (role + shape)', () => {
    it('CLIENT → 403', async () => {
      const client = await seedUser(ctx.app, Role.CLIENT);
      const { accessToken } = getTokens(ctx.app, client);
      await request(ctx.app.getHttpServer())
        .get('/api/reports/cases')
        .set('Authorization', bearer(accessToken))
        .expect(403);
    });

    it('OPS_FINANCE → 200 returns array of flat case rows', async () => {
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const client = await seedUser(ctx.app, Role.CLIENT);
      await seedCase(ctx.app, {
        clientId: client.userId,
        caseManagerId: cm.userId,
      });

      const lead = await seedUser(ctx.app, Role.OPS_FINANCE);
      const { accessToken } = getTokens(ctx.app, lead);

      const res = await request(ctx.app.getHttpServer())
        .get('/api/reports/cases')
        .set('Authorization', bearer(accessToken))
        .expect(200);

      const body = unwrap<CaseReportRow[]>(res);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThanOrEqual(1);
      const row = body[0];
      expect(row.caseId).toBeDefined();
      expect(row.caseNumber).toBeDefined();
      expect(row.status).toBeDefined();
    });
  });
});
