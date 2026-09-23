import request from 'supertest';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { createTestApp, seedUser, TestAppContext } from '../setup';
import { Role } from '../../src/common/enums/roles.enum';
import { User, UserDocument } from '../../src/modules/users/schemas/user.schema';
import { AuthService } from '../../src/modules/auth/auth.service';

describe('Auth extras — Google OAuth + Password reset (e2e)', () => {
  let ctx: TestAppContext;
  let userModel: Model<UserDocument>;
  let authService: AuthService;

  beforeAll(async () => {
    ctx = await createTestApp();
    userModel = ctx.app.get<Model<UserDocument>>(getModelToken(User.name));
    authService = ctx.app.get(AuthService);
  });

  afterAll(async () => {
    await ctx.close();
  });

  describe('POST /api/auth/forgot-password', () => {
    it('existing email → 201 with generic message', async () => {
      const user = await seedUser(ctx.app, Role.CLIENT);
      const res = await request(ctx.app.getHttpServer())
        .post('/api/auth/forgot-password')
        .send({ email: user.email })
        .expect(201);
      expect(res.body.data.message).toBe(
        'If the email exists, a reset link has been sent.',
      );
    });

    it('unknown email → 201 with SAME generic message (no enumeration)', async () => {
      const res = await request(ctx.app.getHttpServer())
        .post('/api/auth/forgot-password')
        .send({ email: 'nobody-here@nope.test' })
        .expect(201);
      expect(res.body.data.message).toBe(
        'If the email exists, a reset link has been sent.',
      );
    });

    it('invalid email shape → 400', async () => {
      await request(ctx.app.getHttpServer())
        .post('/api/auth/forgot-password')
        .send({ email: 'not-an-email' })
        .expect(400);
    });

    it('stores hashed reset token (raw token NOT persisted)', async () => {
      const seeded = await seedUser(ctx.app, Role.CLIENT);
      await request(ctx.app.getHttpServer())
        .post('/api/auth/forgot-password')
        .send({ email: seeded.email })
        .expect(201);
      const user = await userModel
        .findOne({ email: seeded.email })
        .select('+passwordResetToken')
        .exec();
      expect(user?.passwordResetToken).toBeTruthy();
      // bcrypt hashes start with $2
      expect(user?.passwordResetToken?.startsWith('$2')).toBe(true);
      expect(user?.passwordResetExpiry).toBeTruthy();
    });
  });

  describe('POST /api/auth/reset-password', () => {
    async function issueRawTokenForUser(email: string): Promise<string> {
      // Mirror the service logic locally so the test holds the raw token; the
      // service stores only the bcrypt hash.
      const raw = crypto.randomBytes(32).toString('hex');
      const hashed = await bcrypt.hash(raw, 10);
      await userModel
        .findOneAndUpdate(
          { email: email.toLowerCase() },
          {
            passwordResetToken: hashed,
            passwordResetExpiry: new Date(Date.now() + 60 * 60 * 1000),
          },
        )
        .exec();
      return raw;
    }

    it('valid token → 200 and password is actually updated', async () => {
      const seeded = await seedUser(ctx.app, Role.CLIENT);
      const rawToken = await issueRawTokenForUser(seeded.email);
      const newPassword = 'BrandNewPass1!';

      const res = await request(ctx.app.getHttpServer())
        .post('/api/auth/reset-password')
        .send({ email: seeded.email, token: rawToken, newPassword })
        .expect(200);
      expect(res.body.data.message).toBe('Password reset successfully');

      // Verify password actually updated by triggering login (which compares password).
      await request(ctx.app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: seeded.email, password: newPassword })
        .expect(201);
    });

    it('expired token → 400', async () => {
      const seeded = await seedUser(ctx.app, Role.CLIENT);
      const raw = crypto.randomBytes(32).toString('hex');
      const hashed = await bcrypt.hash(raw, 10);
      await userModel
        .findOneAndUpdate(
          { email: seeded.email.toLowerCase() },
          {
            passwordResetToken: hashed,
            passwordResetExpiry: new Date(Date.now() - 60 * 1000),
          },
        )
        .exec();

      await request(ctx.app.getHttpServer())
        .post('/api/auth/reset-password')
        .send({
          email: seeded.email,
          token: raw,
          newPassword: 'AnotherPass1!',
        })
        .expect(400);
    });

    it('wrong token → 400', async () => {
      const seeded = await seedUser(ctx.app, Role.CLIENT);
      await issueRawTokenForUser(seeded.email);
      await request(ctx.app.getHttpServer())
        .post('/api/auth/reset-password')
        .send({
          email: seeded.email,
          token: 'definitely-not-the-real-token',
          newPassword: 'AnotherPass1!',
        })
        .expect(400);
    });

    it('weak newPassword → 400 from DTO validator', async () => {
      const seeded = await seedUser(ctx.app, Role.CLIENT);
      const rawToken = await issueRawTokenForUser(seeded.email);
      await request(ctx.app.getHttpServer())
        .post('/api/auth/reset-password')
        .send({ email: seeded.email, token: rawToken, newPassword: 'weak' })
        .expect(400);
    });
  });

  describe('GET /api/auth/google', () => {
    it('404 — Google OAuth is frontend-mediated, no backend redirect route exists', async () => {
      // The redirect URI lives on the frontend SPA, which posts the auth code
      // to /auth/google/exchange (see AuthController) — there is no backend
      // GET /auth/google passport-redirect endpoint by design.
      const res = await request(ctx.app.getHttpServer()).get('/api/auth/google');
      expect(res.status).toBe(404);
    });
  });

  describe('AuthService.handleGoogleLogin (unit-ish via service)', () => {
    it('creates a new user when the email is not registered', async () => {
      const profile = {
        id: 'google-new-123',
        emails: [{ value: 'newgoogle@example.com', verified: true }],
        displayName: 'New Google',
      };
      const sanitized = await authService.handleGoogleLogin(
        profile as unknown as import('passport-google-oauth20').Profile,
      );
      expect(sanitized.email).toBe('newgoogle@example.com');
      expect(sanitized.name).toBe('New Google');
      const persisted = await userModel
        .findOne({ email: 'newgoogle@example.com' })
        .exec();
      expect(persisted?.googleId).toBe('google-new-123');
    });

    it('links googleId to an existing user with the same email', async () => {
      const seeded = await seedUser(ctx.app, Role.CLIENT);
      const profile = {
        id: 'google-existing-456',
        emails: [{ value: seeded.email, verified: true }],
        displayName: seeded.name,
      };
      const sanitized = await authService.handleGoogleLogin(
        profile as unknown as import('passport-google-oauth20').Profile,
      );
      expect(sanitized.email).toBe(seeded.email);
      const persisted = await userModel
        .findOne({ email: seeded.email.toLowerCase() })
        .exec();
      expect(persisted?.googleId).toBe('google-existing-456');
    });
  });
});
