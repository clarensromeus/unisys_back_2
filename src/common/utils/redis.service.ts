import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis as UpstashRedis } from '@upstash/redis';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client?: Redis;
  private readonly upstash?: UpstashRedis;

  constructor(private readonly config: ConfigService) {
    const upstashUrl = this.config.get<string>('upstashRedisRestUrl');
    const upstashToken = this.config.get<string>('upstashRedisRestToken');
    if (upstashUrl && upstashToken) {
      this.upstash = new UpstashRedis({ url: upstashUrl, token: upstashToken });
      return;
    }

    this.client = new Redis(this.config.get<string>('redisUrl') ?? 'redis://localhost:6379', {
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
    });
  }

  async get<T>(key: string): Promise<T | null> {
    const value = this.upstash ? await this.upstash.get<unknown>(key) : await this.client?.get(key);
    if (!value) return null;
    if (typeof value !== 'string') return value as T;
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as T;
    }
  }

  async set(key: string, value: unknown, ttlSeconds?: number) {
    const payload = JSON.stringify(value);
    if (this.upstash) {
      if (ttlSeconds) await this.upstash.set(key, payload, { ex: ttlSeconds });
      else await this.upstash.set(key, payload);
      return;
    }
    if (ttlSeconds) await this.client?.set(key, payload, 'EX', ttlSeconds);
    else await this.client?.set(key, payload);
  }

  async del(key: string) {
    if (this.upstash) await this.upstash.del(key);
    else await this.client?.del(key);
  }

  async incrementWithTtl(key: string, ttlSeconds: number) {
    const count = this.upstash ? await this.upstash.incr(key) : await this.client?.incr(key);
    if (count === 1) {
      if (this.upstash) await this.upstash.expire(key, ttlSeconds);
      else await this.client?.expire(key, ttlSeconds);
    }
    return Number(count ?? 0);
  }

  async blacklistToken(token: string, ttlSeconds: number) {
    if (this.upstash) await this.upstash.set(`blacklist:${token}`, '1', { ex: ttlSeconds });
    else await this.client?.set(`blacklist:${token}`, '1', 'EX', ttlSeconds);
  }

  async isBlacklisted(token: string) {
    return Boolean(this.upstash ? await this.upstash.exists(`blacklist:${token}`) : await this.client?.exists(`blacklist:${token}`));
  }

  async onModuleDestroy() {
    await this.client?.quit();
  }
}
