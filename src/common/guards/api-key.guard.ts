import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

const DEFAULT_PLATFORM_API_KEY = 'd849edf240d20b79808d35d338d7c633457ad10db8a5eefd399042e36f3e7a6f';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const suppliedKey = request.header('x-api-key');
    const expectedKey = this.config.get<string>('platformApiKey') || DEFAULT_PLATFORM_API_KEY;

    if (suppliedKey && suppliedKey === expectedKey) return true;
    throw new UnauthorizedException('Invalid or missing x-api-key');
  }
}
