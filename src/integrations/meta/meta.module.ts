import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { MetaClient } from './meta.client';
import { RateLimiter, REDIS_CLIENT } from './rate-limiter';

@Module({
  imports: [ConfigModule],
  providers: [
    MetaClient,
    RateLimiter,
    {
      provide: REDIS_CLIENT,
      useFactory: (config: ConfigService) =>
        new Redis({
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
        }),
      inject: [ConfigService],
    },
  ],
  exports: [MetaClient, RateLimiter],
})
export class MetaModule {}
