import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET ?? 'changeme',
    });
  }

  validate(payload: { sub: string; tenantId: string; role: string }) {
    return { userId: payload.sub, tenantId: payload.tenantId, role: payload.role };
  }
}
