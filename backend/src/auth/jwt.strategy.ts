import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { jwtConstants } from './constants';

const extractTokenFromCookie = (req: { headers?: { cookie?: string } }) => {
  const rawCookie = req?.headers?.cookie;
  if (!rawCookie) {
    return null;
  }

  const tokenCookie = rawCookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('access_token='));

  if (!tokenCookie) {
    return null;
  }

  const value = tokenCookie.substring('access_token='.length);
  return decodeURIComponent(value || '');
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        extractTokenFromCookie,
      ]),
      ignoreExpiration: false,
      secretOrKey: jwtConstants.secret,
    });
  }

  async validate(payload: any) {
    return { userId: payload.sub, username: payload.username };
  }
}
