import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RecaptchaModule } from '../recaptcha/recaptcha.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        // S5 — Fail fast at boot if either JWT secret is missing or weak
        // (< 32 chars). Refresh secret is validated alongside the access
        // secret so it can't silently fall back to a short string in prod.
        const MIN = 32;
        const access = configService.get<string>('JWT_SECRET');
        const refresh = configService.get<string>('JWT_REFRESH_SECRET');
        if (!access || access.length < MIN) {
          throw new Error(
            `JWT_SECRET must be set and at least ${MIN} characters long`,
          );
        }
        if (!refresh || refresh.length < MIN) {
          throw new Error(
            `JWT_REFRESH_SECRET must be set and at least ${MIN} characters long`,
          );
        }
        return {
          secret: access,
          signOptions: {
            expiresIn: (configService.get<string>('JWT_EXPIRES_IN') ??
              '15m') as any,
          },
        };
      },
    }),
    UsersModule,
    NotificationsModule,
    RecaptchaModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    JwtRefreshStrategy,
    JwtAuthGuard,
    JwtRefreshGuard,
    RolesGuard,
  ],
  exports: [JwtAuthGuard, JwtRefreshGuard, RolesGuard, AuthService],
})
export class AuthModule {}
