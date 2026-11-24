import request from 'supertest';
import { bearer, createTestApp, getTokens, seedUser, TestAppContext } from '../setup';
import { Role } from '../../src/common/enums/roles.enum';
import { decodeId } from '../../src/common/utils/id-codec';

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

  describe('Admin vendor management', () => {
    const profile = {
      businessName: 'Sharma Legal Associates',
      serviceTypes: ['Legal'],
      cities: ['Mumbai'],
      languages: ['English', 'Hindi'],
      maxConcurrentJobs: 4,
    };

    async function admin() {
      const user = await seedUser(ctx.app, Role.ADMIN);
      return { user, token: getTokens(ctx.app, user).accessToken };
    }

    it('POST /vendors/register: 401 without a token, 403 for a case manager', async () => {
      const vendorUser = await seedUser(ctx.app, Role.VENDOR);
      await request(ctx.app.getHttpServer())
        .post('/api/vendors/register')
        .send({ userId: vendorUser.userId, ...profile })
        .expect(401);
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      await request(ctx.app.getHttpServer())
        .post('/api/vendors/register')
        .set('Authorization', bearer(getTokens(ctx.app, cm).accessToken))
        .send({ userId: vendorUser.userId, ...profile })
        .expect(403);
    });

    it('registers a vendor login, lists it as unregistered first, and rejects a duplicate', async () => {
      const { token } = await admin();
      const vendorUser = await seedUser(ctx.app, Role.VENDOR);

      const before = await request(ctx.app.getHttpServer())
        .get('/api/vendors/unregistered-users')
        .set('Authorization', bearer(token))
        .expect(200);
      expect(
        before.body.data.some((u: { _id: string }) => decodeId(u._id) === vendorUser.userId),
      ).toBe(true);

      const created = await request(ctx.app.getHttpServer())
        .post('/api/vendors/register')
        .set('Authorization', bearer(token))
        .send({ userId: vendorUser.userId, ...profile })
        .expect(201);
      expect(created.body.data.businessName).toBe(profile.businessName);

      const after = await request(ctx.app.getHttpServer())
        .get('/api/vendors/unregistered-users')
        .set('Authorization', bearer(token))
        .expect(200);
      expect(
        after.body.data.some((u: { _id: string }) => decodeId(u._id) === vendorUser.userId),
      ).toBe(false);

      await request(ctx.app.getHttpServer())
        .post('/api/vendors/register')
        .set('Authorization', bearer(token))
        .send({ userId: vendorUser.userId, ...profile })
        .expect(409);

      // The vendor can now see their own profile.
      const mine = await request(ctx.app.getHttpServer())
        .get('/api/vendors/my')
        .set('Authorization', bearer(getTokens(ctx.app, vendorUser).accessToken))
        .expect(200);
      expect(mine.body.data.businessName).toBe(profile.businessName);
    });

    it('refuses a profile for a user whose role is not VENDOR, and for an unknown user', async () => {
      const { token } = await admin();
      const client = await seedUser(ctx.app, Role.CLIENT);
      await request(ctx.app.getHttpServer())
        .post('/api/vendors/register')
        .set('Authorization', bearer(token))
        .send({ userId: client.userId, ...profile })
        .expect(400);
      await request(ctx.app.getHttpServer())
        .post('/api/vendors/register')
        .set('Authorization', bearer(token))
        .send({ userId: '64b64b64b64b64b64b64b64b', ...profile })
        .expect(404);
    });

    it('GET /vendors/unregistered-users is ADMIN only', async () => {
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      await request(ctx.app.getHttpServer())
        .get('/api/vendors/unregistered-users')
        .set('Authorization', bearer(getTokens(ctx.app, cm).accessToken))
        .expect(403);
    });

    it('PATCH /vendors/:id edits the profile and verification, recording the signed-in admin', async () => {
      const { user, token } = await admin();
      const vendorUser = await seedUser(ctx.app, Role.VENDOR);
      const created = await request(ctx.app.getHttpServer())
        .post('/api/vendors/register')
        .set('Authorization', bearer(token))
        .send({ userId: vendorUser.userId, ...profile })
        .expect(201);
      const id = created.body.data._id;

      const edited = await request(ctx.app.getHttpServer())
        .patch(`/api/vendors/${id}`)
        .set('Authorization', bearer(token))
        .send({ businessName: 'Sharma & Sons', cities: ['Pune'], isVerified: true })
        .expect(200);
      expect(edited.body.data.businessName).toBe('Sharma & Sons');
      expect(edited.body.data.cities).toEqual(['Pune']);
      expect(edited.body.data.isVerified).toBe(true);
      expect(decodeId(String(edited.body.data.verifiedBy))).toBe(user.userId);

      const unverified = await request(ctx.app.getHttpServer())
        .patch(`/api/vendors/${id}`)
        .set('Authorization', bearer(token))
        .send({ isVerified: false })
        .expect(200);
      expect(unverified.body.data.isVerified).toBe(false);
      expect(unverified.body.data.verifiedBy).toBeUndefined();

      const vendorToken = getTokens(ctx.app, vendorUser).accessToken;
      await request(ctx.app.getHttpServer())
        .patch(`/api/vendors/${id}`)
        .set('Authorization', bearer(vendorToken))
        .send({ isVerified: true })
        .expect(403);
    });

    it('PATCH /vendors/:id/verify records the signed-in admin, ignoring any body id', async () => {
      const { user, token } = await admin();
      const vendorUser = await seedUser(ctx.app, Role.VENDOR);
      const created = await request(ctx.app.getHttpServer())
        .post('/api/vendors/register')
        .set('Authorization', bearer(token))
        .send({ userId: vendorUser.userId, ...profile })
        .expect(201);
      const verified = await request(ctx.app.getHttpServer())
        .patch(`/api/vendors/${created.body.data._id}/verify`)
        .set('Authorization', bearer(token))
        .send({ adminId: '64b64b64b64b64b64b64b64b' })
        .expect(200);
      expect(verified.body.data.isVerified).toBe(true);
      expect(decodeId(String(verified.body.data.verifiedBy))).toBe(user.userId);
    });
  });
});
