import { LoggerService } from './LoggerService.js';

const logger = new LoggerService();

interface CacheEntry {
    data: any;
    timestamp: number;
    expiresAt: number;
}

export class FlashcardCacheService {
    private cache: Map<string, CacheEntry>;
    private ttlMs: number;

    constructor(ttlSeconds: number = 3600) {
        this.cache = new Map();
        this.ttlMs = ttlSeconds * 1000;

        // Periodic cleanup of expired entries
        setInterval(() => this.cleanup(), 60000); // Every minute

        logger.info('FlashcardCacheService initialized', { ttl: `${ttlSeconds}s` });
    }

    /**
     * Generate cache key from request parameters
     */
    private generateKey(topic: string, count: number, mode?: string, knowledgeSource?: string): string {
        return `${topic}|${count}|${mode || 'standard'}|${knowledgeSource || 'ai-web'}`.toLowerCase();
    }

    /**
     * Check if cache has entry and it's not expired
     */
    has(topic: string, count: number, mode?: string, knowledgeSource?: string): boolean {
        const key = this.generateKey(topic, count, mode, knowledgeSource);
        const entry = this.cache.get(key);

        if (!entry) return false;

        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            return false;
        }

        return true;
    }

    /**
     * Get cached result
     */
    get(topic: string, count: number, mode?: string, knowledgeSource?: string): any | null {
        const key = this.generateKey(topic, count, mode, knowledgeSource);
        const entry = this.cache.get(key);

        if (!entry) return null;

        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            logger.debug('Cache expired', { key });
            return null;
        }

        logger.info('Cache hit', { key });
        return entry.data;
    }

    /**
     * Store result in cache
     */
    set(topic: string, count: number, data: any, mode?: string, knowledgeSource?: string): void {
        const key = this.generateKey(topic, count, mode, knowledgeSource);
        const now = Date.now();

        this.cache.set(key, {
            data,
            timestamp: now,
            expiresAt: now + this.ttlMs
        });

        logger.info('Cache set', { key, size: this.cache.size });
    }

    /**
     * Remove expired entries
     */
    private cleanup(): void {
        const now = Date.now();
        let removed = 0;

        for (const [key, entry] of this.cache.entries()) {
            if (now > entry.expiresAt) {
                this.cache.delete(key);
                removed++;
            }
        }

        if (removed > 0) {
            logger.debug('Cache cleanup', { removed, remaining: this.cache.size });
        }
    }

    /**
     * Get cache statistics
     */
    getStats() {
        return {
            size: this.cache.size,
            ttlSeconds: this.ttlMs / 1000
        };
    }

    /**
     * Clear all cache
     */
    clear(): void {
        this.cache.clear();
        logger.info('Cache cleared');
    }
}
