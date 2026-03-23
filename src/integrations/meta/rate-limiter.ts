import { Inject, Injectable } from '@nestjs/common';

export const REDIS_CLIENT = 'REDIS_CLIENT';

const MAX_RATE = 80; // messages per second
const WINDOW_MS = 1000; // 1 second sliding window
const EXPIRE_MS = 2000; // key TTL

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Injectable()
export class RateLimiter {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: RedisClient) {}

  async acquire(tenantId: string): Promise<void> {
    const key = `rate:${tenantId}`;
    const now = Date.now();
    const windowStart = now - WINDOW_MS;

    await this.redis.zremrangebyscore(key, '-inf', windowStart);
    const count = await this.redis.zcard(key);

    if (count >= MAX_RATE) {
      await sleep(50);
      return this.acquire(tenantId);
    }

    await this.redis.zadd(key, now, `${now}-${Math.random()}`);
    await this.redis.pexpire(key, EXPIRE_MS);
  }

  async pauseTenant(tenantId: string, durationMs: number): Promise<void> {
    const key = `pause:${tenantId}`;
    const ttlSeconds = Math.ceil(durationMs / 1000);
    await this.redis.set(key, '1', 'EX', ttlSeconds);
  }

  async isTenantPaused(tenantId: string): Promise<boolean> {
    const key = `pause:${tenantId}`;
    const result = await this.redis.exists(key);
    return result === 1;
  }
}

// Minimal interface for the Redis operations we need
export interface RedisClient {
  zremrangebyscore(key: string, min: string | number, max: string | number): Promise<number>;
  zcard(key: string): Promise<number>;
  zadd(key: string, score: number, member: string): Promise<number>;
  pexpire(key: string, milliseconds: number): Promise<number>;
  set(key: string, value: string, mode: string, duration: number): Promise<string | null>;
  exists(key: string): Promise<number>;
}
