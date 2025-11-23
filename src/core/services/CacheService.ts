import { LRUCache } from 'lru-cache';
import crypto from 'crypto';

export interface CacheOptions {
    ttlSeconds: number;
    maxEntries: number;
}

export class CacheService<T = any> {
    private cache: LRUCache<string, T>;

    constructor(options: CacheOptions) {
        this.cache = new LRUCache<string, T>({
            max: options.maxEntries,
            ttl: options.ttlSeconds * 1000, // Convert to milliseconds
            updateAgeOnGet: false,
            updateAgeOnHas: false
        });
    }

    get(key: string): T | undefined {
        const value = this.cache.get(key);
        if (value !== undefined) {
            console.log(`✅ Cache hit for: ${key}`);
        } else {
            console.log(`🔍 Cache miss for: ${key}`);
        }
        return value;
    }

    set(key: string, value: T): void {
        this.cache.set(key, value);
        console.log(`💾 Cached: ${key}`);
    }

    has(key: string): boolean {
        return this.cache.has(key);
    }

    clear(): void {
        this.cache.clear();
        console.log('🗑️  Cache cleared');
    }

    delete(key: string): void {
        this.cache.delete(key);
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
