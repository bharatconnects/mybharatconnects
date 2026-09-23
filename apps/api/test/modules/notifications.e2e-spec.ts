import request from 'supertest';
import { ConfigService } from '@nestjs/config';
import { bearer, createTestApp, getTokens, seedUser, TestAppContext } from '../setup';
import { Role } from '../../src/common/enums/roles.enum';
import { UsersService } from '../../src/modules/users/users.service';
import { generateUnsubscribeToken } from '../../src/common/utils/unsubscribe-token.util';

describe('Notifications auth matrix (e2e)', () => {
  let ctx: TestAppContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  // NotificationsController has no @Roles — only JWT auth gate applies.
  describe('GET /api/notifications (any authenticated user)', () => {
    it('no token → 401', async () => {
      await request(ctx.app.getHttpServer())
        .get('/api/notifications')
        .expect(401);
    });

    it('CLIENT bearer → 200', async () => {
      const client = await seedUser(ctx.app, Role.CLIENT);
      const { accessToken } = getTokens(ctx.app, client);
      await request(ctx.app.getHttpServer())
        .get('/api/notifications')
        .set('Authorization', bearer(accessToken))
        .expect(200);
    });

    it('CASE_MANAGER bearer → 200', async () => {
      const cm = await seedUser(ctx.app, Role.CASE_MANAGER);
      const { accessToken } = getTokens(ctx.app, cm);
      await request(ctx.app.getHttpServer())
        .get('/api/notifications')
        .set('Authorization', bearer(accessToken))
        .expect(200);
    });
  });

  describe('GET /api/notifications/unsubscribe (public, no auth)', () => {
    it('missing params → 400', async () => {
      await request(ctx.app.getHttpServer())
        .get('/api/notifications/unsubscribe')
        .expect(400);
    });

    it('invalid token → 400', async () => {
      const client = await seedUser(ctx.app, Role.CLIENT);
      await request(ctx.app.getHttpServer())
        .get('/api/notifications/unsubscribe')
        .query({ u: client.userId, t: 'not-a-real-token' })
        .expect(400);
    });

    it('valid token → 200 and sets marketingEmailsOptOut', async () => {
      const client = await seedUser(ctx.app, Role.CLIENT);
      const secret = ctx.app.get(ConfigService).get<string>('JWT_SECRET')!;
      const token = generateUnsubscribeToken(client.userId, secret);

      await request(ctx.app.getHttpServer())
        .get('/api/notifications/unsubscribe')
        .query({ u: client.userId, t: token })
        .expect(200);

      const updated = await ctx.app.get(UsersService).findById(client.userId);
      expect(updated?.marketingEmailsOptOut).toBe(true);
    });
  });
});
