import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis, { Redis as RedisClient } from 'ioredis';
import { randomUUID } from 'crypto';

@Injectable()
export class ManagementServiceService implements OnModuleInit, OnModuleDestroy {
  private redis: RedisClient;

  private readonly LOGIN_COUNT_KEY = 'stats:login:count';
  private readonly ADMIN_ID_KEY = 'admin_id';
  private readonly ADMIN_PW_KEY = 'admin_pw';
  private readonly SESSION_PREFIX = 'mng:session:';
  private readonly SESSION_TTL = 60 * 60 * 24; // 24시간
  private readonly SHTM_KEY = 'shtm';
  private readonly YYYY_KEY = 'yyyy';

  async onModuleInit() {
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

    await this.initializeAdminCredentials();
  }

  private async initializeAdminCredentials() {
    const adminIdExists = await this.redis.exists(this.ADMIN_ID_KEY);
    const adminPwExists = await this.redis.exists(this.ADMIN_PW_KEY);

    if (!adminIdExists) {
      await this.redis.set(this.ADMIN_ID_KEY, 'admin');
      console.log('Initialized admin_id with default value');
    }

    if (!adminPwExists) {
      await this.redis.set(this.ADMIN_PW_KEY, 'admin');
      console.log('Initialized admin_pw with default value');
    }
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

  async login(
    id: string,
    password: string,
  ): Promise<{ success: boolean; sessionId?: string; message?: string }> {
    const adminId = await this.redis.get(this.ADMIN_ID_KEY);
    const adminPw = await this.redis.get(this.ADMIN_PW_KEY);

    if (id !== adminId || password !== adminPw) {
      return { success: false, message: 'Invalid credentials' };
    }

    const sessionId = randomUUID();
    const sessionKey = `${this.SESSION_PREFIX}${sessionId}`;

    await this.redis.setex(sessionKey, this.SESSION_TTL, id);
    console.log(`Admin login successful, session created: ${sessionId}`);

    return { success: true, sessionId };
  }

  async logout(sessionId: string): Promise<{ success: boolean }> {
    const sessionKey = `${this.SESSION_PREFIX}${sessionId}`;
    const deleted = await this.redis.del(sessionKey);

    if (deleted > 0) {
      console.log(`Session deleted: ${sessionId}`);
    }

    return { success: true };
  }

  async validateSession(sessionId: string): Promise<boolean> {
    const sessionKey = `${this.SESSION_PREFIX}${sessionId}`;
    const exists = await this.redis.exists(sessionKey);
    return exists === 1;
  }

  async getShtmYyyy(): Promise<{ shtm: string | null; yyyy: string | null }> {
    const shtm = await this.redis.get(this.SHTM_KEY);
    const yyyy = await this.redis.get(this.YYYY_KEY);
    return { shtm, yyyy };
  }

  async setShtmYyyy(shtm: string, yyyy: string): Promise<{ success: boolean }> {
    await this.redis.set(this.SHTM_KEY, shtm);
    await this.redis.set(this.YYYY_KEY, yyyy);
    console.log(`Set shtm: ${shtm}, yyyy: ${yyyy}`);
    return { success: true };
  }
}
