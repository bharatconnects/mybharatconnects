import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import type { SanitizedUser, VerifyOtpResponse } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { GoogleExchangeDto } from './dto/google-exchange.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from './strategies/jwt.strategy';
import type { RefreshAuthenticatedUser } from './strategies/jwt-refresh.strategy';
import { RecaptchaService } from '../recaptcha/recaptcha.service';

@ApiTags('auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly recaptchaService: RecaptchaService,
  ) {}

  @Post('register')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Register a new user' })
  async register(@Body() dto: RegisterDto): Promise<SanitizedUser> {
    await this.recaptchaService.verify(dto.recaptchaToken, 'register');
    return this.authService.register(dto);
  }

  @Post('login')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Login and receive OTP' })
  login(@Body() dto: LoginDto): Promise<{ message: string }> {
    return this.authService.login(dto);
  }

  @Post('verify-otp')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Verify OTP and receive tokens' })
  verifyOtp(@Body() dto: VerifyOtpDto): Promise<VerifyOtpResponse> {
    return this.authService.verifyOtp(dto);
  }

  @Post('refresh')
  @Public()
  @UseGuards(JwtRefreshGuard)
  @ApiOperation({ summary: 'Refresh access token' })
  refresh(
    @CurrentUser() user: RefreshAuthenticatedUser,
    @Body() _dto: RefreshTokenDto,
  ): Promise<{ accessToken: string }> {
    return this.authService.refresh(user.userId, user.refreshToken);
  }

  @Post('logout')
  @ApiOperation({ summary: 'Logout and invalidate refresh token' })
  logout(@CurrentUser() user: AuthenticatedUser): Promise<{ message: string }> {
    return this.authService.logout(user.userId);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  getMe(@CurrentUser() user: AuthenticatedUser): Promise<SanitizedUser> {
    return this.authService.getMe(user.userId);
  }

  // ── Google OAuth (frontend-mediated authorization-code flow) ────────────
  //
  // Pattern:
  //   1. FE → GET /auth/google/state  ─ returns a short-lived signed state token
  //   2. FE redirects browser to Google with that state
  //   3. Google redirects browser to FE's /auth/google/callback?code=…&state=…
  //   4. FE → POST /auth/google/exchange  with { code, state, redirectUri }
  //   5. BE validates state, exchanges code for tokens with Google,
  //      upserts the user, returns OUR JWTs in the JSON response body.
  //
  // The old GET /auth/google + GET /auth/google/callback routes (Passport-
  // driven, redirect-with-JWT-in-URL) were removed in favour of this — JWTs
  // never appear in browser history / referer headers / server access logs.

  @Get('google/state')
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Issue a one-time OAuth state token for CSRF protection' })
  googleState(): { state: string } {
    return this.authService.issueGoogleOauthState();
  }

  @Post('google/exchange')
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Exchange a Google OAuth authorization code for app JWTs' })
  googleExchange(
    @Body() dto: GoogleExchangeDto,
  ): Promise<VerifyOtpResponse> {
    return this.authService.exchangeGoogleCode(
      dto.code,
      dto.state,
      dto.redirectUri,
    );
  }

  @Post('forgot-password')
  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({ summary: 'Request a password reset email' })
  forgotPassword(
    @Body() dto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    return this.authService.requestPasswordReset(dto.email);
  }

  @Post('reset-password')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password using emailed token' })
  resetPassword(
    @Body() dto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    return this.authService.resetPassword(dto.email, dto.token, dto.newPassword);
  }
}
