import Redis from 'ioredis';

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (typeof window !== 'undefined') {
    return null; // Client-side, no Redis
  }

  if (!redis && process.env.REDIS_URL) {
    try {
      redis = new Redis(process.env.REDIS_URL, {
        enableReadyCheck: false,
        lazyConnect: true,
        maxRetriesPerRequest: 3,
      });

      redis.on('error', (error) => {
        console.error('Redis connection error:', error);
      });
    } catch (error) {
      console.error('Failed to initialize Redis:', error);
      redis = null;
    }
  }

  return redis;
}

export class CacheService {
  private redis: Redis | null;

  constructor() {
    this.redis = getRedis();
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.redis) return null;

    try {
      const value = await this.redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds: number = 300): Promise<boolean> {
    if (!this.redis) return false;

    try {
      await this.redis.setex(key, ttlSeconds, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`Cache set error for key ${key}:`, error);
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    if (!this.redis) return false;

    try {
      await this.redis.del(key);
      return true;
    } catch (error) {
      console.error(`Cache delete error for key ${key}:`, error);
      return false;
    }
  }

  async invalidatePattern(pattern: string): Promise<boolean> {
    if (!this.redis) return false;

    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
      return true;
    } catch (error) {
      console.error(`Cache invalidate pattern error for ${pattern}:`, error);
      return false;
    }
  }

  // Cache wrapper function
  async cached<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttlSeconds: number = 300
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Fetch and cache
    const result = await fetchFn();
    await this.set(key, result, ttlSeconds);
    return result;
  }
}

// Singleton instance
export const cache = new CacheService();

// Cache key generators
export const CacheKeys = {
  customerStatus: (customerId: string) => `customer_status:${customerId}`,
  shopProgram: (shopId: string) => `shop_program:${shopId}`,
  customersByShop: (shopId: string, filters: string) => `customers:${shopId}:${filters}`,
  dashboardAnalytics: (shopId: string) => `dashboard:${shopId}`,
  rewardsByProgram: (programId: string) => `rewards:${programId}`,
  tiersByProgram: (programId: string) => `tiers:${programId}`,
} as const;

// Cache TTL constants (in seconds)
export const CacheTTL = {
  CUSTOMER_STATUS: 300, // 5 minutes
  SHOP_PROGRAM: 3600, // 1 hour
  DASHBOARD_ANALYTICS: 600, // 10 minutes
  REWARDS: 1800, // 30 minutes
  TIERS: 3600, // 1 hour
} as const;