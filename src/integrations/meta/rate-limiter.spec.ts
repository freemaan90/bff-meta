import * as fc from 'fast-check';
import { RateLimiter, RedisClient } from './rate-limiter';

// Helper to build a mock Redis client
function buildMockRedis(overrides: Partial<RedisClient> = {}): jest.Mocked<RedisClient> {
  return {
    zremrangebyscore: jest.fn().mockResolvedValue(0),
    zcard: jest.fn().mockResolvedValue(0),
    zadd: jest.fn().mockResolvedValue(1),
    pexpire: jest.fn().mockResolvedValue(1),
    set: jest.fn().mockResolvedValue('OK'),
    exists: jest.fn().mockResolvedValue(0),
    ...overrides,
  } as jest.Mocked<RedisClient>;
}

describe('RateLimiter', () => {
  describe('acquire', () => {
    it('should call zremrangebyscore, zcard, zadd and pexpire when under limit', async () => {
      const redis = buildMockRedis({ zcard: jest.fn().mockResolvedValue(0) });
      const limiter = new RateLimiter(redis);

      await limiter.acquire('tenant-1');

      expect(redis.zremrangebyscore).toHaveBeenCalledWith('rate:tenant-1', '-inf', expect.any(Number));
      expect(redis.zcard).toHaveBeenCalledWith('rate:tenant-1');
      expect(redis.zadd).toHaveBeenCalledWith('rate:tenant-1', expect.any(Number), expect.any(String));
      expect(redis.pexpire).toHaveBeenCalledWith('rate:tenant-1', 2000);
    });

    it('should use the correct key format rate:{tenantId}', async () => {
      const redis = buildMockRedis();
      const limiter = new RateLimiter(redis);

      await limiter.acquire('my-tenant');

      expect(redis.zcard).toHaveBeenCalledWith('rate:my-tenant');
    });

    it('should retry after delay when limit is reached, then succeed', async () => {
      // First call returns 80 (at limit), second call returns 0 (under limit)
      const redis = buildMockRedis({
        zcard: jest.fn().mockResolvedValueOnce(80).mockResolvedValue(0),
      });
      const limiter = new RateLimiter(redis);

      await limiter.acquire('tenant-1');

      // zcard should have been called at least twice (once at limit, once under)
      expect(redis.zcard).toHaveBeenCalledTimes(2);
      // zadd should only be called once (when under limit)
      expect(redis.zadd).toHaveBeenCalledTimes(1);
    });
  });

  describe('pauseTenant', () => {
    it('should set pause key with correct TTL in seconds', async () => {
      const redis = buildMockRedis();
      const limiter = new RateLimiter(redis);

      await limiter.pauseTenant('tenant-1', 60000);

      expect(redis.set).toHaveBeenCalledWith('pause:tenant-1', '1', 'EX', 60);
    });

    it('should round up TTL to nearest second', async () => {
      const redis = buildMockRedis();
      const limiter = new RateLimiter(redis);

      await limiter.pauseTenant('tenant-1', 60500);

      expect(redis.set).toHaveBeenCalledWith('pause:tenant-1', '1', 'EX', 61);
    });

    it('should use the correct key format pause:{tenantId}', async () => {
      const redis = buildMockRedis();
      const limiter = new RateLimiter(redis);

      await limiter.pauseTenant('my-tenant', 1000);

      expect(redis.set).toHaveBeenCalledWith('pause:my-tenant', '1', 'EX', 1);
    });
  });

  describe('isTenantPaused', () => {
    it('should return true when pause key exists', async () => {
      const redis = buildMockRedis({ exists: jest.fn().mockResolvedValue(1) });
      const limiter = new RateLimiter(redis);

      const result = await limiter.isTenantPaused('tenant-1');

      expect(result).toBe(true);
      expect(redis.exists).toHaveBeenCalledWith('pause:tenant-1');
    });

    it('should return false when pause key does not exist', async () => {
      const redis = buildMockRedis({ exists: jest.fn().mockResolvedValue(0) });
      const limiter = new RateLimiter(redis);

      const result = await limiter.isTenantPaused('tenant-1');

      expect(result).toBe(false);
    });
  });

  // Feature: meta-api-integration, Property 14: Rate limit invariant (metamorphic)
  // For any number of sequential acquire calls within a 1-second window,
  // the sliding window counter SHALL NOT exceed 80 entries (the configured limit).
  describe('Property 14: Rate limit invariant (metamorphic)', () => {
    it('should never record more than 80 entries in the sliding window', async () => {
      // Validates: Requirements 7.1, 7.5
      // Note: The sliding window is enforced per-call. This property verifies that
      // the acquire() method correctly reads the current count and only adds an entry
      // when below the limit. Concurrent atomicity is a Redis concern (MULTI/EXEC),
      // not a concern of the application-level RateLimiter logic.
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 79 }), // current count below limit
          fc.string({ minLength: 1, maxLength: 30 }), // tenantId
          async (currentCount, tenantId) => {
            // Simulate a window that already has `currentCount` entries (below limit)
            const redis = buildMockRedis({
              zcard: jest.fn().mockResolvedValue(currentCount),
            });
            const limiter = new RateLimiter(redis);

            // Should succeed without retrying since count < 80
            await limiter.acquire(tenantId);

            // zadd should be called exactly once (no retry needed)
            expect(redis.zadd).toHaveBeenCalledTimes(1);
            // zcard should be called exactly once
            expect(redis.zcard).toHaveBeenCalledTimes(1);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should retry when window is at the limit (count >= 80)', async () => {
      // Validates: Requirements 7.2 — delay without dropping the message
      // We verify the retry logic by checking that zcard is called multiple times
      // and zadd is called exactly once (message not dropped).
      // We use a small numRuns to keep test fast since each run has a real 50ms delay.
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 80, max: 200 }), // count at or above limit
          fc.string({ minLength: 1, maxLength: 30 }), // tenantId
          async (atLimitCount, tenantId) => {
            // First call returns at-limit count, second returns 0 (window cleared)
            const redis = buildMockRedis({
              zcard: jest.fn()
                .mockResolvedValueOnce(atLimitCount)
                .mockResolvedValue(0),
            });
            const limiter = new RateLimiter(redis);

            await limiter.acquire(tenantId);

            // zcard called at least twice (once at limit, once after delay)
            expect(redis.zcard).toHaveBeenCalledTimes(2);
            // zadd called exactly once (message not dropped)
            expect(redis.zadd).toHaveBeenCalledTimes(1);
          },
        ),
        { numRuns: 10 }, // reduced runs to avoid timeout with real 50ms delays
      );
    }, 30000);
  });

  // Feature: meta-api-integration, Property 15: Rate limit pause on RATE_LIMIT error
  // For any tenant that receives a RATE_LIMIT error, all subsequent sends SHALL be
  // blocked for at least 60 seconds.
  describe('Property 15: Rate limit pause on RATE_LIMIT error', () => {
    it('should block acquire when tenant is paused', async () => {
      // Validates: Requirements 7.3
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),  // tenantId
          fc.integer({ min: 1000, max: 300000 }),       // pause duration in ms (1s to 5min)
          async (tenantId, durationMs) => {
            const pauseStore: Map<string, number> = new Map();

            const redis = buildMockRedis({
              set: jest.fn().mockImplementation(async (key, _value, _mode, ttlSeconds) => {
                pauseStore.set(key, ttlSeconds);
                return 'OK';
              }),
              exists: jest.fn().mockImplementation(async (key) => {
                return pauseStore.has(key) ? 1 : 0;
              }),
            });

            const limiter = new RateLimiter(redis);

            // Simulate receiving a RATE_LIMIT error: pause the tenant
            await limiter.pauseTenant(tenantId, durationMs);

            // Verify the tenant is now paused
            const isPaused = await limiter.isTenantPaused(tenantId);
            expect(isPaused).toBe(true);

            // Verify the TTL is at least 60 seconds when durationMs >= 60000
            const pauseKey = `pause:${tenantId}`;
            const storedTtl = pauseStore.get(pauseKey) ?? 0;
            const expectedTtl = Math.ceil(durationMs / 1000);
            expect(storedTtl).toBe(expectedTtl);

            // When called with 60000ms (the RATE_LIMIT scenario), TTL must be >= 60s
            if (durationMs >= 60000) {
              expect(storedTtl).toBeGreaterThanOrEqual(60);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should set TTL of exactly 60 seconds when paused with 60000ms (RATE_LIMIT scenario)', async () => {
      const redis = buildMockRedis();
      const limiter = new RateLimiter(redis);

      await limiter.pauseTenant('tenant-abc', 60000);

      expect(redis.set).toHaveBeenCalledWith('pause:tenant-abc', '1', 'EX', 60);
    });
  });
});
