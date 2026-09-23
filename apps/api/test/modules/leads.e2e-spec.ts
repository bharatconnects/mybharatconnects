import request from 'supertest';
import { bearer, createTestApp, getTokens, seedUser, TestAppContext } from '../setup';
import { Role } from '../../src/common/enums/roles.enum';
import { Cluster } from '../../src/common/enums/cluster.enum';
import { UsersService } from '../../src/modules/users/users.service';

describe('Leads role matrix (e2e)', () => {
  let ctx: TestAppContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  describe('GET /api/leads (CASE_MANAGER, ADMIN)', () => {
    it('no token → 401', async () => {
      await request(ctx.app.getHttpServer()).get('/api/leads').expect(401);
    });

    it('wrong role (CLIENT) → 403', async () => {
      const client = await seedUser(ctx.app, Role.CLIENT);
      const { accessToken } = getTokens(ctx.app, client);
      await request(ctx.app.getHttpServer())
        .get('/api/leads')
        .set('Authorization', bearer(accessToken))
        .expect(403);
    });

    it('right role (CASE_MANAGER) → 200', async () => {
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const { accessToken } = getTokens(ctx.app, cm);
      await request(ctx.app.getHttpServer())
        .get('/api/leads')
        .set('Authorization', bearer(accessToken))
        .expect(200);
    });
  });

  describe('POST /api/leads → cluster derivation', () => {
    it('derives cluster=PROPERTY when serviceType=PROPERTY_MANAGEMENT and no cluster passed', async () => {
      const createRes = await request(ctx.app.getHttpServer())
        .post('/api/leads')
        .send({
          name: 'Cluster Derive Test',
          email: `lead-derive-${Date.now()}@test.local`,
          phone: '+15551234567',
          country: 'US',
          serviceType: 'PROPERTY_MANAGEMENT',
        })
        .expect(201);

      const lead = createRes.body?.data ?? createRes.body;
      expect(lead.cluster).toBe(Cluster.PROPERTY);
      expect(lead.serviceType).toBe('PROPERTY_MANAGEMENT');
    });
  });

  describe('Lead → case lifecycle', () => {
    async function seedLead(): Promise<{ id: string; email: string }> {
      const email = `lead-lifecycle-${Date.now()}-${Math.random().toString(36).slice(2)}@test.local`;
      const res = await request(ctx.app.getHttpServer())
        .post('/api/leads')
        .send({
          name: 'Lifecycle Lead',
          email,
          country: 'US',
          serviceType: 'PROPERTY_MANAGEMENT',
          preferredCity: 'Mumbai',
        })
        .expect(201);
      const lead = res.body?.data ?? res.body;
      return { id: lead._id, email };
    }

    it('POST /:id/create-case: no token → 401', async () => {
      const { id } = await seedLead();
      await request(ctx.app.getHttpServer())
        .post(`/api/leads/${id}/create-case`)
        .expect(401);
    });

    it('POST /:id/create-case: wrong role (CLIENT) → 403', async () => {
      const { id } = await seedLead();
      const client = await seedUser(ctx.app, Role.CLIENT);
      const { accessToken } = getTokens(ctx.app, client);
      await request(ctx.app.getHttpServer())
        .post(`/api/leads/${id}/create-case`)
        .set('Authorization', bearer(accessToken))
        .expect(403);
    });

    it('CASE_MANAGER: create-case auto-provisions a client, creates a case, then initiate sends the email and delete is blocked', async () => {
      const { id, email } = await seedLead();
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const { accessToken } = getTokens(ctx.app, cm);

      const createRes = await request(ctx.app.getHttpServer())
        .post(`/api/leads/${id}/create-case`)
        .set('Authorization', bearer(accessToken))
        .expect(201);
      const body = createRes.body?.data ?? createRes.body;
      expect(body.case.caseNumber).toBeTruthy();
      expect(body.lead.caseId).toBeTruthy();
      expect(body.case.serviceType).toBe('PROPERTY_MANAGEMENT');

      // A CLIENT account should now exist for the lead's email.
      const provisioned = await ctx.app.get(UsersService).findByEmail(email);
      expect(provisioned).toBeTruthy();
      expect(provisioned?.role).toBe(Role.CLIENT);

      // Creating a case twice for the same lead is rejected.
      await request(ctx.app.getHttpServer())
        .post(`/api/leads/${id}/create-case`)
        .set('Authorization', bearer(accessToken))
        .expect(400);

      // Initiate sends the "take action" email (dev-logged, not asserted
      // here) and stamps caseInitiatedAt.
      const initiateRes = await request(ctx.app.getHttpServer())
        .post(`/api/leads/${id}/initiate`)
        .set('Authorization', bearer(accessToken))
        .expect(201);
      expect(
        (initiateRes.body?.data ?? initiateRes.body).caseInitiatedAt,
      ).toBeTruthy();

      // Delete is blocked once a case exists.
      await request(ctx.app.getHttpServer())
        .delete(`/api/leads/${id}`)
        .set('Authorization', bearer(accessToken))
        .expect(400);
    });

    it('DELETE /:id: succeeds for a lead with no case', async () => {
      const { id } = await seedLead();
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const { accessToken } = getTokens(ctx.app, cm);

      await request(ctx.app.getHttpServer())
        .delete(`/api/leads/${id}`)
        .set('Authorization', bearer(accessToken))
        .expect(200);

      await request(ctx.app.getHttpServer())
        .get(`/api/leads/${id}`)
        .set('Authorization', bearer(accessToken))
        .expect(404);
    });

    it('POST /:id/initiate: 400 when no case exists yet', async () => {
      const { id } = await seedLead();
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const { accessToken } = getTokens(ctx.app, cm);
      await request(ctx.app.getHttpServer())
        .post(`/api/leads/${id}/initiate`)
        .set('Authorization', bearer(accessToken))
        .expect(400);
    });
  });

  describe('Client-scoped lead requests (mine)', () => {
    it('POST /api/leads/mine: no token → 401', async () => {
      await request(ctx.app.getHttpServer())
        .post('/api/leads/mine')
        .send({ name: 'X', email: 'x@test.local', serviceType: 'Other', message: 'help' })
        .expect(401);
    });

    it('POST /api/leads/mine: wrong role (CASE_MANAGER) → 403', async () => {
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const { accessToken } = getTokens(ctx.app, cm);
      await request(ctx.app.getHttpServer())
        .post('/api/leads/mine')
        .set('Authorization', bearer(accessToken))
        .send({ name: 'X', email: 'x@test.local', serviceType: 'Other', message: 'help' })
        .expect(403);
    });

    it('CLIENT: create via mine, appears in GET /mine, can cancel, then delete', async () => {
      const client = await seedUser(ctx.app, Role.CLIENT);
      const { accessToken } = getTokens(ctx.app, client);

      const createRes = await request(ctx.app.getHttpServer())
        .post('/api/leads/mine')
        .set('Authorization', bearer(accessToken))
        .send({
          name: 'Client Self Request',
          email: 'client-self@test.local',
          serviceType: 'Other',
          message: 'Something not in the catalog',
        })
        .expect(201);
      const lead = createRes.body?.data ?? createRes.body;
      expect(lead.serviceType).toBe('Other');

      const listRes = await request(ctx.app.getHttpServer())
        .get('/api/leads/mine')
        .set('Authorization', bearer(accessToken))
        .expect(200);
      const mine = listRes.body?.data ?? listRes.body;
      expect(mine.some((l: { _id: string }) => l._id === lead._id)).toBe(true);

      const cancelRes = await request(ctx.app.getHttpServer())
        .patch(`/api/leads/${lead._id}/cancel`)
        .set('Authorization', bearer(accessToken))
        .expect(200);
      expect((cancelRes.body?.data ?? cancelRes.body).status).toBe('CANCELLED');

      await request(ctx.app.getHttpServer())
        .delete(`/api/leads/${lead._id}`)
        .set('Authorization', bearer(accessToken))
        .expect(200);
    });

    it('CLIENT cannot cancel or delete another client\'s lead', async () => {
      const owner = await seedUser(ctx.app, Role.CLIENT);
      const ownerTokens = getTokens(ctx.app, owner);
      const createRes = await request(ctx.app.getHttpServer())
        .post('/api/leads/mine')
        .set('Authorization', bearer(ownerTokens.accessToken))
        .send({ name: 'Owner', email: 'owner-lead@test.local', serviceType: 'Other', message: 'x' })
        .expect(201);
      const lead = createRes.body?.data ?? createRes.body;

      const intruder = await seedUser(ctx.app, Role.CLIENT);
      const intruderTokens = getTokens(ctx.app, intruder);

      await request(ctx.app.getHttpServer())
        .patch(`/api/leads/${lead._id}/cancel`)
        .set('Authorization', bearer(intruderTokens.accessToken))
        .expect(404);

      await request(ctx.app.getHttpServer())
        .delete(`/api/leads/${lead._id}`)
        .set('Authorization', bearer(intruderTokens.accessToken))
        .expect(404);
    });

    it('CLIENT can edit their own pending request', async () => {
      const client = await seedUser(ctx.app, Role.CLIENT);
      const { accessToken } = getTokens(ctx.app, client);

      const createRes = await request(ctx.app.getHttpServer())
        .post('/api/leads/mine')
        .set('Authorization', bearer(accessToken))
        .send({
          name: 'Client Self Request',
          email: 'client-edit@test.local',
          serviceType: 'Other',
          message: 'Something not in the catalog',
        })
        .expect(201);
      const lead = createRes.body?.data ?? createRes.body;

      const editRes = await request(ctx.app.getHttpServer())
        .patch(`/api/leads/${lead._id}/mine`)
        .set('Authorization', bearer(accessToken))
        .send({ message: 'Updated details about the request', country: 'UAE' })
        .expect(200);
      const updated = editRes.body?.data ?? editRes.body;
      expect(updated.message).toBe('Updated details about the request');
      expect(updated.country).toBe('UAE');
    });

    it('CLIENT cannot edit another client\'s lead → 404', async () => {
      const owner = await seedUser(ctx.app, Role.CLIENT);
      const ownerTokens = getTokens(ctx.app, owner);
      const createRes = await request(ctx.app.getHttpServer())
        .post('/api/leads/mine')
        .set('Authorization', bearer(ownerTokens.accessToken))
        .send({ name: 'Owner', email: 'owner-lead-2@test.local', serviceType: 'Other', message: 'x' })
        .expect(201);
      const lead = createRes.body?.data ?? createRes.body;

      const intruder = await seedUser(ctx.app, Role.CLIENT);
      const intruderTokens = getTokens(ctx.app, intruder);

      await request(ctx.app.getHttpServer())
        .patch(`/api/leads/${lead._id}/mine`)
        .set('Authorization', bearer(intruderTokens.accessToken))
        .send({ message: 'Trying to hijack' })
        .expect(404);
    });

    it('CLIENT cannot edit a cancelled request → 400', async () => {
      const client = await seedUser(ctx.app, Role.CLIENT);
      const { accessToken } = getTokens(ctx.app, client);
      const createRes = await request(ctx.app.getHttpServer())
        .post('/api/leads/mine')
        .set('Authorization', bearer(accessToken))
        .send({ name: 'X', email: 'client-cancelled-edit@test.local', serviceType: 'Other', message: 'x' })
        .expect(201);
      const lead = createRes.body?.data ?? createRes.body;

      await request(ctx.app.getHttpServer())
        .patch(`/api/leads/${lead._id}/cancel`)
        .set('Authorization', bearer(accessToken))
        .expect(200);

      await request(ctx.app.getHttpServer())
        .patch(`/api/leads/${lead._id}/mine`)
        .set('Authorization', bearer(accessToken))
        .send({ message: 'Trying to edit after cancel' })
        .expect(400);
    });
  });
});
