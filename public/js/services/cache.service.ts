/**
 * CacheService - Generic client-side caching using IndexedDB
 * Dedicated to API responses to avoid conflicts with WebLLM cache
 */
export class CacheService {
    private dbName = 'mindflip-api-cache';
    private storeName = 'responses';
    private db: IDBDatabase | null = null;
    private defaultTtlMs: number;

    constructor(defaultTtlSeconds: number = 300) { // 5 minutes default
        this.defaultTtlMs = defaultTtlSeconds * 1000;
        this.init();
    }

    private async init(): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);

            request.onerror = () => {
                console.error('Failed to open IndexedDB for API cache');
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                // console.log('✅ API cache initialized');
                resolve();
            };

            request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: 'key' });
                }
            };
        });
    }

    async get<T>(key: string): Promise<T | null> {
        if (!this.db) {
            await this.init();
            if (!this.db) return null;
        }

        return new Promise((resolve) => {
            const transaction = this.db!.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.get(key);

            request.onsuccess = () => {
                const entry = request.result;

                if (!entry) {
                    // console.log(`🔍 Cache miss: ${key}`);
                    resolve(null);
                    return;
                }

                // Check if expired
                if (Date.now() > entry.expiresAt) {
                    console.log(`⏰ Cache expired: ${key}`);
                    this.delete(key); // Clean up expired entry
                    resolve(null);
                    return;
                }

                // console.log(`✅ Cache hit: ${key}`);
                resolve(entry.value as T);
            };

            request.onerror = () => {
                // console.error('Error reading from API cache');
                resolve(null);
            };
        });
    }

    async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
        if (!this.db) {
            await this.init();
            if (!this.db) return;
        }

        const ttl = ttlSeconds ? ttlSeconds * 1000 : this.defaultTtlMs;

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);

            const entry = {
                key,
                value,
                expiresAt: Date.now() + ttl,
                timestamp: Date.now()
            };

            const request = store.put(entry);

            request.onsuccess = () => {
                // console.log(`💾 Cached: ${key}`);
                resolve();
            };

            request.onerror = () => {
                console.error('Error writing to API cache');
                reject(request.error);
            };
        });
    }

    async delete(key: string): Promise<void> {
        if (!this.db) return;

        return new Promise((resolve) => {
            const transaction = this.db!.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.delete(key);

            request.onsuccess = () => resolve();
            request.onerror = () => resolve();
        });
    }

    async clear(): Promise<void> {
        if (!this.db) return;

        return new Promise((resolve) => {
            const transaction = this.db!.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.clear();

            request.onsuccess = () => {
                console.log('🗑️  API cache cleared');
                resolve();
            };
            request.onerror = () => resolve();
        });
    }

    /**
     * Invalidate keys matching a pattern (e.g., 'decks*')
     * Useful for clearing lists when an item is added
     */
    async invalidatePattern(pattern: string): Promise<void> {
        if (!this.db) return;

        return new Promise((resolve) => {
            const transaction = this.db!.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.openCursor();
            const keysToDelete: string[] = [];

            // Convert glob-like pattern to regex (simple implementation)
            // e.g. "decks*" -> /^decks.*$/
            const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');

            request.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest).result;
                if (cursor) {
                    const key = cursor.key as string;
                    if (regex.test(key)) {
                        keysToDelete.push(key);
                        cursor.delete();
                    }
                    cursor.continue();
                } else {
                    if (keysToDelete.length > 0) {
                        console.log(`🗑️  Invalidated ${keysToDelete.length} keys for pattern: ${pattern}`);
                    }
                    resolve();
                }
            };

            request.onerror = () => resolve();
        });
    }
}

// Singleton instance
export const cacheService = new CacheService();
