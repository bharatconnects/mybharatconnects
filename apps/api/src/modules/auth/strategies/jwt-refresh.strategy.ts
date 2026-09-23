import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../../users/users.service';
import { JwtPayload } from './jwt.strategy';

export interface RefreshAuthenticatedUser {
  userId: string;
  email: string;
  role: string;
  refreshToken: string;
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_REFRESH_SECRET') as string,
      passReqToCallback: true,
    });
  }

  async validate(
    req: Request,
    payload: JwtPayload,
  ): Promise<RefreshAuthenticatedUser> {
    const refreshToken =
      (req.body as { refreshToken?: string }).refreshToken ?? '';

    const user = await this.usersService.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User is not active or does not exist');
    }

    // refreshToken is selected via +refreshToken in findByEmail — but findById doesn't select it
    // We need to reload with the refreshToken field selected
    const userWithToken = await this.usersService.findByEmail(user.email);
    if (!userWithToken?.refreshToken) {
      throw new UnauthorizedException('Refresh token not found');
    }

    const isMatch = await bcrypt.compare(refreshToken, userWithToken.refreshToken);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
      refreshToken,
    };
  }
}
