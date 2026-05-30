import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { RedisService } from '../utils/redis.service';

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  constructor(private readonly redis: RedisService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{ ip: string }>();
    const key = `auth_rate_limit:${request.ip}`;
    const attempts = await this.redis.incrementWithTtl(key, 60);
    if (attempts > 8) {
      throw new HttpException('Too many authentication attempts', HttpStatus.TOO_MANY_REQUESTS);
    }
    return true;
  }
}
