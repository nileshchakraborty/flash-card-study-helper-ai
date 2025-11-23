/**
 * WebLLMCache - Client-side caching for WebLLM responses using IndexedDB
 */
export class WebLLMCache {
    private dbName = 'webllm-cache';
    private storeName = 'responses';
    private db: IDBDatabase | null = null;
    private ttlMs: number;

    constructor(ttlSeconds: number = 86400) { // 24 hours default
        this.ttlMs = ttlSeconds * 1000;
        this.init();
    }

    private async init(): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);

            request.onerror = () => {
                console.error('Failed to open IndexedDB for WebLLM cache');
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('✅ WebLLM cache initialized');
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

    async get(key: string): Promise<any | null> {
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
                    console.log(`🔍 WebLLM cache miss: ${key.substring(0, 32)}...`);
                    resolve(null);
                    return;
                }

                // Check if expired
                if (Date.now() > entry.expiresAt) {
                    console.log(`⏰ WebLLM cache expired: ${key.substring(0, 32)}...`);
                    this.delete(key); // Clean up expired entry
                    resolve(null);
                    return;
                }

                console.log(`✅ WebLLM cache hit: ${key.substring(0, 32)}...`);
                resolve(entry.value);
            };

            request.onerror = () => {
                console.error('Error reading from WebLLM cache');
                resolve(null);
            };
        });
    }

    async set(key: string, value: any): Promise<void> {
        if (!this.db) {
            await this.init();
            if (!this.db) return;
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);

            const entry = {
                key,
                value,
                expiresAt: Date.now() + this.ttlMs
            };

            const request = store.put(entry);

            request.onsuccess = () => {
                console.log(`💾 WebLLM cached: ${key.substring(0, 32)}...`);
                resolve();
            };

            request.onerror = () => {
                console.error('Error writing to WebLLM cache');
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

            request.onsuccess = () => {
                console.log(`🗑️  WebLLM cache deleted: ${key.substring(0, 32)}...`);
                resolve();
            };

            request.onerror = () => {
                console.error('Error deleting from WebLLM cache');
                resolve();
            };
        });
    }

    async clear(): Promise<void> {
        if (!this.db) return;

        return new Promise((resolve) => {
            const transaction = this.db!.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.clear();

            request.onsuccess = () => {
                console.log('🗑️  WebLLM cache cleared');
                resolve();
            };

            request.onerror = () => {
                console.error('Error clearing WebLLM cache');
                resolve();
            };
        });
    }

    /**
     * Generate a hash-based cache key for prompts
     */
    static async hashKey(prompt: string): Promise<string> {
        // Use SubtleCrypto for browser-compatible hashing
        const encoder = new TextEncoder();
        const data = encoder.encode(prompt);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex.substring(0, 16);
    }

    /**
     * Delete expired entries
     */
    async deleteExpired(): Promise<void> {
        if (!this.db) return;

        return new Promise((resolve) => {
            const transaction = this.db!.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.openCursor();
            let deletedCount = 0;

            request.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest).result;
                if (cursor) {
                    const entry = cursor.value;
                    if (Date.now() > entry.expiresAt) {
                        cursor.delete();
                        deletedCount++;
                    }
                    cursor.continue();
                } else {
                    if (deletedCount > 0) {
                        console.log(`🗑️  Cleaned up ${deletedCount} expired WebLLM cache entries`);
                    }
                    resolve();
                }
            };

            request.onerror = () => {
                console.error('Error cleaning up WebLLM cache');
                resolve();
            };
        });
    }
}
