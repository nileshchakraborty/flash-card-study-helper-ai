import { LoggerService } from './LoggerService.js';
import type { RedisService } from './RedisService.js';

const logger = new LoggerService();

interface CacheEntry {
    data: any;
    timestamp: number;
    expiresAt: number;
}

export class FlashcardCacheService {
    private localCache: Map<string, CacheEntry>;
    private redis?: RedisService;
    private ttlMs: number;
    private ttlSeconds: number;
    private cleanupInterval: ReturnType<typeof setInterval>;

    constructor(ttlSeconds: number = 3600, redis?: RedisService) {
        this.localCache = new Map();
        this.redis = redis;
        this.ttlSeconds = ttlSeconds;
        this.ttlMs = ttlSeconds * 1000;

        // Periodic cleanup of expired entries (local only). `unref` so tests/app exit cleanly
        this.cleanupInterval = setInterval(() => this.cleanup(), 60000); // Every minute
        if (typeof (this.cleanupInterval as any).unref === 'function') {
            (this.cleanupInterval as any).unref();
        }

        logger.info('FlashcardCacheService initialized', { ttl: `${ttlSeconds}s`, redis: !!redis });
    }

    /**
     * Generate cache key from request parameters
     */
    private generateKey(topic: string, count: number, mode?: string, knowledgeSource?: string): string {
        return `flashcard:${topic}|${count}|${mode || 'standard'}|${knowledgeSource || 'ai-web'}`.toLowerCase();
    }

    /**
     * Check if cache has entry and it's not expired
     */
    async has(topic: string, count: number, mode?: string, knowledgeSource?: string): Promise<boolean> {
        const key = this.generateKey(topic, count, mode, knowledgeSource);

        // Check local
        if (this.localCache.has(key)) {
            const entry = this.localCache.get(key)!;
            if (Date.now() <= entry.expiresAt) return true;
            this.localCache.delete(key);
        }

        // Check Redis
        if (this.redis && await this.redis.isHealthy()) {
            try {
                const val = await this.redis.get(key);
                return val !== null;
            } catch (error) {
                logger.warn('Redis check failed', { key, error });
            }
        }

        return false;
    }

    /**
     * Get cached result
     */
    async get(topic: string, count: number, mode?: string, knowledgeSource?: string): Promise<any | null> {
        const key = this.generateKey(topic, count, mode, knowledgeSource);

        // 1. Try Local
        const entry = this.localCache.get(key);
        if (entry) {
            if (Date.now() > entry.expiresAt) {
                this.localCache.delete(key);
                logger.debug('Local cache expired', { key });
            } else {
                logger.info('Local cache hit', { key });
                return entry.data;
            }
        }

        // 2. Try Redis
        if (this.redis && await this.redis.isHealthy()) {
            try {
                const redisData = await this.redis.get(key);
                if (redisData) {
                    logger.info('Redis cache hit', { key });

                    // Repopulate local cache
                    this.localCache.set(key, {
                        data: redisData,
                        timestamp: Date.now(),
                        expiresAt: Date.now() + this.ttlMs
                    });

                    return redisData;
                }
            } catch (error) {
                logger.warn('Redis read failed', { key, error });
            }
        }

        return null;
    }

    /**
     * Store result in cache
     */
    async set(topic: string, count: number, data: any, mode?: string, knowledgeSource?: string): Promise<void> {
        const key = this.generateKey(topic, count, mode, knowledgeSource);
        const now = Date.now();

        // 1. Set Local
        this.localCache.set(key, {
            data,
            timestamp: now,
            expiresAt: now + this.ttlMs
        });

        // 2. Set Redis
        if (this.redis && await this.redis.isHealthy()) {
            try {
                await this.redis.set(key, data, this.ttlSeconds);
                logger.info('Redis cache set', { key });
            } catch (error) {
                logger.warn('Redis write failed', { key, error });
            }
        }

        logger.info('Cache set', { key });
    }

    /**
     * Remove expired entries (Local only)
     * Redis handles its own expiration
     */
    private cleanup(): void {
        const now = Date.now();
        let expiredCount = 0;

        for (const [key, entry] of this.localCache.entries()) {
            if (now - entry.timestamp > this.ttlMs) {
                this.localCache.delete(key);
                expiredCount++;
            }
        }

        if (expiredCount > 0) {
            logger.info('Local cache cleanup', { expiredCount, currentSize: this.localCache.size });
        }
    }

    dispose(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
    }

    /**
     * Get cache statistics
     */
    getStats() {
        return {
            size: this.localCache.size,
            ttlSeconds: this.ttlSeconds,
            redisConnected: this.redis?.isHealthy()
        };
    }

    /**
     * Clear all cache
     */
    async clear(): Promise<void> {
        this.localCache.clear();
        logger.info('Local cache cleared');

        // We generally don't clear generic Redis via this method to avoid blowing away unrelated data,
        // unless we used key prefixes (which we added: 'flashcard:')
    }
}
