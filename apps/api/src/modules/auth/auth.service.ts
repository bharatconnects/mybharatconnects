import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { UsersService } from '../users/users.service';
import { EmailService } from '../notifications/notifications.email.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { UserDocument } from '../users/schemas/user.schema';
import { Role } from '../../common/enums/roles.enum';
import type { Profile } from 'passport-google-oauth20';

export interface SanitizedUser {
  _id: string;
  email: string;
  role: string;
  name: string;
  isActive: boolean;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface VerifyOtpResponse {
  accessToken: string;
  refreshToken: string;
  user: SanitizedUser;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  async register(dto: RegisterDto): Promise<SanitizedUser> {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new BadRequestException('Email already registered');
    }
    // Force role=CLIENT for public sign-ups regardless of any field in the
    // request body. RegisterDto already drops `role`, but this is a
    // belt-and-suspenders guard against future DTO changes accidentally
    // re-opening the privilege-escalation hole.
    const user = await this.usersService.create({ ...dto, role: Role.CLIENT });
    try {
      await this.emailService.sendWelcomeEmail(
        user.email,
        user.name,
        user.role,
      );
    } catch (err) {
      this.logger.error('Failed to send welcome email', err as Error);
    }
    return this.sanitize(user);
  }

  async sendOtp(email: string): Promise<{ message: string; devOtp?: string }> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new BadRequestException('User not found');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Account is inactive');
    }

    const otp = crypto.randomInt(100000, 1000000).toString();
    const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store hashed OTP
    const hashedOtp = await bcrypt.hash(otp, 10);
    await this.usersService.updateOtp(
      (user._id as unknown as { toString(): string }).toString(),
      hashedOtp,
      expiry,
    );

    try {
      await this.emailService.sendOtpEmail(user.email, otp, user.name);
    } catch (err) {
      this.logger.error('Failed to send OTP email', err as Error);
      throw new InternalServerErrorException(
        'Could not send OTP email. Please try again in a few moments.',
      );
    }

    return {
      message: 'OTP sent',
      ...(process.env.NODE_ENV === 'development' ? { devOtp: otp } : {}),
    };
  }

  async login(dto: LoginDto): Promise<{ message: string; devOtp?: string }> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Account is inactive');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.password);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const otpResult = await this.sendOtp(dto.email);
    return {
      message: 'OTP sent to email',
      ...(process.env.NODE_ENV === 'development'
        ? { devOtp: (otpResult as any).devOtp }
        : {}),
    };
  }

  async verifyOtp(dto: VerifyOtpDto): Promise<VerifyOtpResponse> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Account is inactive');
    }

    const userId = (user._id as unknown as { toString(): string }).toString();

    if (!user.otp || !user.otpExpiry) {
      throw new BadRequestException('No OTP requested');
    }

    if (new Date() > user.otpExpiry) {
      await this.usersService.updateOtp(userId, null, null);
      throw new BadRequestException('OTP has expired');
    }

    if (user.otpAttempts >= 5) {
      throw new BadRequestException('Too many OTP attempts');
    }

    const otpValid = await bcrypt.compare(dto.otp, user.otp);
    if (!otpValid) {
      await this.usersService.incrementOtpAttempts(userId);
      throw new UnauthorizedException('Invalid OTP');
    }

    // Clear OTP after successful verification
    await this.usersService.updateOtp(userId, null, null);

    const tokens = await this.generateTokens(user);
    await this.usersService.updateRefreshToken(userId, tokens.refreshToken);

    return {
      ...tokens,
      user: this.sanitize(user),
    };
  }

  async refresh(
    userId: string,
    refreshToken: string,
  ): Promise<{ accessToken: string }> {
    const user = await this.usersService.findByEmail(
      (await this.usersService.findById(userId))?.email ?? '',
    );
    if (!user?.refreshToken) {
      throw new UnauthorizedException('Access denied');
    }

    const isMatch = await bcrypt.compare(refreshToken, user.refreshToken);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const payload = {
      sub: userId,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: (this.configService.get<string>('JWT_EXPIRES_IN') ??
        '15m') as any,
    });

    return { accessToken };
  }

  async logout(userId: string): Promise<{ message: string }> {
    await this.usersService.updateRefreshToken(userId, null);
    return { message: 'Logged out successfully' };
  }

  async getMe(userId: string): Promise<SanitizedUser> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return this.sanitize(user);
  }

  /**
   * Issues a short-lived signed token used as the OAuth `state` parameter.
   * The frontend includes this in its redirect to Google; Google echoes it
   * back to /auth/google/callback; the frontend forwards it to
   * /auth/google/exchange where we verify the signature + expiry. This is
   * the CSRF protection that Passport was providing under the old flow.
   */
  issueGoogleOauthState(): { state: string } {
    const secret = this.configService.get<string>('JWT_SECRET')!;
    const state = this.jwtService.sign(
      { purpose: 'google-oauth-state' },
      { secret, expiresIn: '5m' },
    );
    return { state };
  }

  /**
   * Frontend-mediated Google OAuth: the frontend receives the auth code on
   * its own callback route, then POSTs { code, state, redirectUri } here.
   *
   * - We validate `state` (CSRF + replay window)
   * - Exchange `code` + our `client_secret` with Google's token endpoint
   * - Fetch the user profile from Google
   * - Reuse the existing handleGoogleLogin/issueTokensForSanitizedUser
   *   helpers so the Passport-flow and the manual-flow produce identical
   *   results (same user upsert logic, same JWT issuance, same response shape)
   */
  async exchangeGoogleCode(
    code: string,
    state: string,
    redirectUri: string,
  ): Promise<VerifyOtpResponse> {
    // 1. State validation — short-TTL JWT signed with JWT_SECRET.
    try {
      const secret = this.configService.get<string>('JWT_SECRET')!;
      const payload = this.jwtService.verify<{ purpose?: string }>(state, {
        secret,
      });
      if (payload.purpose !== 'google-oauth-state') {
        throw new BadRequestException('Invalid OAuth state');
      }
    } catch {
      throw new BadRequestException('Invalid or expired OAuth state');
    }

    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');
    if (
      !clientId ||
      clientId.startsWith('replace') ||
      !clientSecret ||
      clientSecret.startsWith('replace')
    ) {
      throw new UnauthorizedException(
        'Google OAuth is not configured on this server',
      );
    }

    // 2. Exchange the auth code for Google access + id tokens.
    const params = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });
    let tokenRes: Response;
    try {
      tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });
    } catch (err) {
      // `TypeError: fetch failed` hides the underlying cause — surface it so
      // we can tell DNS errors from TLS / connection issues.
      const cause = (err as { cause?: { code?: string; message?: string } })
        ?.cause;
      const detail = cause
        ? `${cause.code ?? ''} ${cause.message ?? ''}`.trim()
        : (err as Error)?.message;
      this.logger.error(
        `Google token endpoint unreachable: ${detail}`,
        (err as Error)?.stack,
      );
      throw new UnauthorizedException(
        `Could not reach Google's auth server (${detail}).`,
      );
    }
    if (!tokenRes.ok) {
      const errText = await tokenRes.text().catch(() => '');
      this.logger.warn(
        `Google token exchange failed (${tokenRes.status}): ${errText}`,
      );
      throw new UnauthorizedException('Google OAuth code exchange failed');
    }
    const tokens = (await tokenRes.json()) as { access_token?: string };
    if (!tokens.access_token) {
      throw new UnauthorizedException('Google OAuth returned no access token');
    }

    // 3. Fetch the user profile from Google.
    let profileRes: Response;
    try {
      profileRes = await fetch(
        'https://www.googleapis.com/oauth2/v3/userinfo',
        { headers: { Authorization: `Bearer ${tokens.access_token}` } },
      );
    } catch (err) {
      const cause = (err as { cause?: { code?: string; message?: string } })
        ?.cause;
      const detail = cause
        ? `${cause.code ?? ''} ${cause.message ?? ''}`.trim()
        : (err as Error)?.message;
      this.logger.error(`Google userinfo endpoint unreachable: ${detail}`);
      throw new UnauthorizedException(
        `Could not reach Google's profile endpoint (${detail})`,
      );
    }
    if (!profileRes.ok) {
      throw new UnauthorizedException('Failed to fetch Google profile');
    }
    const userinfo = (await profileRes.json()) as {
      sub: string;
      email: string;
      given_name?: string;
      family_name?: string;
      picture?: string;
      name?: string;
    };

    // 4. Reuse the existing flow — build a Passport-shaped profile and feed
    //    it through handleGoogleLogin so user-upsert logic stays in one place.
    const passportProfile: Profile = {
      id: userinfo.sub,
      displayName: userinfo.name ?? '',
      name: {
        givenName: userinfo.given_name ?? '',
        familyName: userinfo.family_name ?? '',
      },
      emails: [{ value: userinfo.email, verified: true }],
      photos: userinfo.picture ? [{ value: userinfo.picture }] : [],
      provider: 'google',
      _raw: '',
      _json: userinfo as unknown as Profile['_json'],
    } as Profile;

    const sanitized = await this.handleGoogleLogin(passportProfile);
    return this.issueTokensForSanitizedUser(sanitized);
  }

  async handleGoogleLogin(profile: Profile): Promise<SanitizedUser> {
    const email = profile.emails?.[0]?.value?.toLowerCase();
    if (!email) {
      throw new BadRequestException('Google profile is missing email');
    }
    const googleId = profile.id;
    const name = profile.displayName?.trim() || 'User';

    let user = await this.usersService.findByEmail(email);
    if (user) {
      if (!user.googleId) {
        await this.usersService.setGoogleId(
          (user._id as unknown as { toString(): string }).toString(),
          googleId,
        );
        user.googleId = googleId;
      }
    } else {
      user = await this.usersService.createOauthUser({
        email,
        name,
        googleId,
      });
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Account is inactive');
    }
    return this.sanitize(user);
  }

  async issueTokensForSanitizedUser(sanitized: SanitizedUser): Promise<{
    accessToken: string;
    refreshToken: string;
    user: SanitizedUser;
  }> {
    const user = await this.usersService.findByEmail(sanitized.email);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    const tokens = await this.generateTokens(user);
    await this.usersService.updateRefreshToken(
      (user._id as unknown as { toString(): string }).toString(),
      tokens.refreshToken,
    );
    return { ...tokens, user: sanitized };
  }

  async requestPasswordReset(email: string): Promise<{ message: string }> {
    const genericResponse = {
      message: 'If the email exists, a reset link has been sent.',
    };
    const user = await this.usersService.findByEmail(email);
    if (!user || !user.isActive) {
      return genericResponse;
    }
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = await bcrypt.hash(rawToken, 10);
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    const userId = (user._id as unknown as { toString(): string }).toString();
    await this.usersService.setPasswordResetToken(userId, hashedToken, expiry);

    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:4200';
    const resetLink = `${frontendUrl}/auth/reset-password?token=${rawToken}&email=${encodeURIComponent(
      user.email,
    )}`;
    try {
      await this.emailService.sendPasswordResetEmail(
        user.email,
        user.name,
        resetLink,
      );
    } catch (err) {
      this.logger.error('Failed to send password reset email', err as Error);
    }
    return genericResponse;
  }

  async resetPassword(
    email: string,
    token: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(email);
    if (!user || !user.passwordResetToken || !user.passwordResetExpiry) {
      throw new BadRequestException('Invalid or expired reset token');
    }
    if (new Date() > user.passwordResetExpiry) {
      const userId = (user._id as unknown as { toString(): string }).toString();
      await this.usersService.clearPasswordResetToken(userId);
      throw new BadRequestException('Invalid or expired reset token');
    }
    const tokenValid = await bcrypt.compare(token, user.passwordResetToken);
    if (!tokenValid) {
      throw new BadRequestException('Invalid or expired reset token');
    }
    const userId = (user._id as unknown as { toString(): string }).toString();
    await this.usersService.updatePassword(userId, newPassword);
    return { message: 'Password reset successfully' };
  }

  private async generateTokens(user: UserDocument): Promise<TokenPair> {
    const payload = {
      sub: (user._id as unknown as { toString(): string }).toString(),
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: (this.configService.get<string>('JWT_EXPIRES_IN') ??
        '15m') as any,
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: (this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ??
        '7d') as any,
    });

    return { accessToken, refreshToken };
  }

  private sanitize(user: UserDocument): SanitizedUser {
    return {
      _id: (user._id as unknown as { toString(): string }).toString(),
      email: user.email,
      role: user.role as Role,
      name: user.name,
      isActive: user.isActive,
    };
  }
}
