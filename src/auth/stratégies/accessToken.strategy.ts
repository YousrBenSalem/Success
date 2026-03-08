import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

type JwtPayload = {
  sub: string;
  username: string;
};

@Injectable()
export class AccessTokenStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    const jwtaccessSecret = process.env.JWT_ACCESS_TOKEN;
    if (!jwtaccessSecret) {
      throw new Error('JWT access secret is not foundin envirement');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: jwtaccessSecret,
    });
  }

  validate(payload: JwtPayload) {
    return payload;
  }
}
