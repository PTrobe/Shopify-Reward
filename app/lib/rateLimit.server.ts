import { cache } from "./cache.server";
import { RateLimitError } from "./errors";

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyGenerator: (identifier: string) => string;
}

export class RateLimiter {
  constructor(private config: RateLimitConfig) {}

  async checkLimit(identifier: string): Promise<void> {
    const key = this.config.keyGenerator(identifier);
    const windowStart = Math.floor(Date.now() / this.config.windowMs) * this.config.windowMs;
    const windowKey = `${key}:${windowStart}`;

    const currentCount = await cache.get<number>(windowKey) || 0;

    if (currentCount >= this.config.maxRequests) {
      throw new RateLimitError();
    }

    // Increment counter
    await cache.set(
      windowKey,
      currentCount + 1,
      Math.ceil(this.config.windowMs / 1000)
    );
  }
}

// Predefined rate limiters
export const rateLimiters = {
  // Public API: 100 requests per minute per shop
  publicApi: new RateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
    keyGenerator: (shopDomain) => `rate_limit:public:${shopDomain}`,
  }),

  // Admin API: 1000 requests per minute per shop
  adminApi: new RateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 1000,
    keyGenerator: (shopDomain) => `rate_limit:admin:${shopDomain}`,
  }),

  // Webhook processing: 100 per second burst, 10 per second sustained
  webhooks: new RateLimiter({
    windowMs: 1000, // 1 second
    maxRequests: 100,
    keyGenerator: (shopDomain) => `rate_limit:webhook:${shopDomain}`,
  }),

  // Point redemption: 10 per minute per customer (prevent abuse)
  redemption: new RateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
    keyGenerator: (customerId) => `rate_limit:redemption:${customerId}`,
  }),
};

// Middleware helper for Remix loaders/actions
export async function withRateLimit<T>(
  rateLimiter: RateLimiter,
  identifier: string,
  fn: () => Promise<T>
): Promise<T> {
  await rateLimiter.checkLimit(identifier);
  return fn();
}