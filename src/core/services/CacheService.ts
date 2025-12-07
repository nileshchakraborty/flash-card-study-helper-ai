import { LRUCache } from 'lru-cache';
import crypto from 'crypto';
import type { RedisService } from './RedisService.js';

export interface CacheOptions {
    ttlSeconds: number;
    maxEntries: number;
    redis?: RedisService;
}

export class CacheService<T extends {} = any> {
    private localCache: LRUCache<string, T>;
    private redis?: RedisService;
    private ttlSeconds: number;

    constructor(options: CacheOptions) {
        this.redis = options.redis;
        this.ttlSeconds = options.ttlSeconds;

        this.localCache = new LRUCache<string, T>({
            max: options.maxEntries,
            ttl: options.ttlSeconds * 1000,
            updateAgeOnGet: false,
            updateAgeOnHas: false
        });
    }

    async get(key: string): Promise<T | undefined> {
        // 1. Try Memory Cache first (fastest)
        const localValue = this.localCache.get(key);
        if (localValue !== undefined) {
            console.log(`✅ Memory Cache hit for: ${key}`);
            return localValue;
        }

        // 2. Try Redis Cache
        if (this.redis && await this.redis.isHealthy()) {
            try {
                const redisValue = await this.redis.get<T>(key);
                if (redisValue) {
                    console.log(`✅ Redis Cache hit for: ${key}`);
                    // Populate local cache from Redis for next time
                    this.localCache.set(key, redisValue);
                    return redisValue;
                }
            } catch (error) {
                console.warn(`⚠️ Redis get failed for ${key}`, error);
            }
        }

        console.log(`🔍 Cache miss for: ${key}`);
        return undefined;
    }

    async set(key: string, value: T): Promise<void> {
        // 1. Update Memory Cache
        this.localCache.set(key, value);
        console.log(`💾 Cached (Memory): ${key}`);

        // 2. Update Redis Cache
        if (this.redis && await this.redis.isHealthy()) {
            try {
                await this.redis.set(key, value, this.ttlSeconds);
                console.log(`💾 Cached (Redis): ${key}`);
            } catch (error) {
                console.warn(`⚠️ Redis set failed for ${key}`, error);
            }
        }
    }

    async has(key: string): Promise<boolean> {
        if (this.localCache.has(key)) return true;

        if (this.redis && await this.redis.isHealthy()) {
            const val = await this.redis.get(key);
            return val !== null;
        }

        return false;
    }

    async clear(): Promise<void> {
        this.localCache.clear();
        console.log('🗑️  Memory Cache cleared');

        // Note: We don't clear Redis here as it might be shared
        // or we'd need a pattern matching delete which is expensive/dangerous
    }

    async delete(key: string): Promise<void> {
        this.localCache.delete(key);

        if (this.redis && await this.redis.isHealthy()) {
            await this.redis.delete(key);
        }

        console.log(`🗑️  Deleted from cache: ${key}`);
    }

    /**
     * Generate a hash-based cache key for complex objects
     */
    static hashKey(...parts: any[]): string {
        const content = parts.map(p =>
            typeof p === 'object' ? JSON.stringify(p) : String(p)
        ).join(':');

        return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
    }
}
