import request from 'supertest';
import { createTestApp, getTokens, TestAppContext } from './setup';
import { Role } from '../src/common/enums/roles.enum';

describe('Auth flow (e2e)', () => {
  let ctx: TestAppContext;
  const password = 'Passw0rd!ABC';
  const email = `auth-${Date.now()}@test.local`;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('POST /api/auth/register returns 201 with sanitized user', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email,
        password,
        name: 'Auth Tester',
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe(email);
    expect(res.body.data.role).toBe(Role.CLIENT);
    expect(res.body.data.password).toBeUndefined();
  });

  it('POST /api/auth/login returns 201 with OTP message', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.message).toBe('OTP sent to email');
  });

  it('GET /api/auth/me with bypassed-OTP bearer returns 200', async () => {
    const usersService = ctx.app.get(
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('../src/modules/users/users.service').UsersService,
    );
    const userDoc = await usersService.findByEmail(email);
    const userId = (
      userDoc._id as unknown as { toString(): string }
    ).toString();
    const { accessToken } = getTokens(ctx.app, {
      userId,
      email,
      role: Role.CLIENT,
    });

    const res = await request(ctx.app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe(email);
  });

  it('GET /api/auth/me without bearer returns 401', async () => {
    await request(ctx.app.getHttpServer()).get('/api/auth/me').expect(401);
  });
});
