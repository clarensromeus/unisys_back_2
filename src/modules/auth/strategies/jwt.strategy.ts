import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../prisma/prisma.service';
import { RedisService } from '../../../common/utils/redis.service';

type JwtPayload = {
  sub: string;
  email: string;
  role: string;
  organizationId?: string;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    config: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('jwt.accessSecret'),
      passReqToCallback: true,
    });
  }

  async validate(request: { headers: { authorization?: string } }, payload: JwtPayload) {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (token && (await this.redis.isBlacklisted(token))) throw new UnauthorizedException('Token revoked');

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, organizationId: true, email: true, role: true, isActive: true, deletedAt: true },
    });
    if (!user || !user.isActive || user.deletedAt) throw new UnauthorizedException('User no longer exists');
    return user;
  }
}
