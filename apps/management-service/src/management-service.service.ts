import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis, { Redis as RedisClient } from 'ioredis';

@Injectable()
export class ManagementServiceService implements OnModuleInit, OnModuleDestroy {
  private redis: RedisClient;

  private readonly LOGIN_COUNT_KEY = 'stats:login:count';

  onModuleInit() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST ?? 'localhost',
      port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    });

    this.redis.on('connect', () => {
      console.log('Connected to Redis');
    });

    this.redis.on('error', (err) => {
      console.error('Redis connection error:', err);
    });
  }

  onModuleDestroy() {
    this.redis?.disconnect();
  }

  async incrementLoginCount(): Promise<number> {
    const count = await this.redis.incr(this.LOGIN_COUNT_KEY);
    console.log(`Login count incremented: ${count}`);
    return count;
  }

  async getLoginCount(): Promise<number> {
    const count = await this.redis.get(this.LOGIN_COUNT_KEY);
    return parseInt(count ?? '0', 10);
  }
}
