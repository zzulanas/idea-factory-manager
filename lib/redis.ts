import Redis from 'ioredis';

if (!process.env.REDIS_URL) {
  throw new Error('REDIS_URL environment variable is not set');
}

// Create Redis client
const redis = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

redis.on('error', (err) => {
  console.error('Redis connection error:', err);
});

redis.on('connect', () => {
  console.log('✓ Redis connected');
});

export { redis };

// Helper functions for common Redis operations
export const cache = {
  // Get a value from cache
  async get<T>(key: string): Promise<T | null> {
    const value = await redis.get(key);
    if (!value) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as T;
    }
  },

  // Set a value in cache with optional TTL (in seconds)
  async set(key: string, value: any, ttl?: number): Promise<void> {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    if (ttl) {
      await redis.setex(key, ttl, serialized);
    } else {
      await redis.set(key, serialized);
    }
  },

  // Delete a key from cache
  async del(key: string): Promise<void> {
    await redis.del(key);
  },

  // Check if a key exists
  async exists(key: string): Promise<boolean> {
    const result = await redis.exists(key);
    return result === 1;
  },

  // Increment a counter
  async incr(key: string): Promise<number> {
    return await redis.incr(key);
  },

  // Set expiration on a key (in seconds)
  async expire(key: string, ttl: number): Promise<void> {
    await redis.expire(key, ttl);
  },

  // Get all keys matching a pattern
  async keys(pattern: string): Promise<string[]> {
    return await redis.keys(pattern);
  },
};
