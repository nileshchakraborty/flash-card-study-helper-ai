import { createClient, type RedisClientType } from 'redis';
import { logger } from './LoggerService.js';

/**
 * Redis service for distributed caching
 * Gracefully falls back if Redis is unavailable
 */
export class RedisService {
    private client: RedisClientType | null = null;
    private isConnected = false;

    /**
     * Connect to Redis using REDIS_URL from environment
     */
    async connect(url: string): Promise<void> {
        try {
            this.client = createClient({ url });

            this.client.on('error', (err) => {
                logger.error('Redis Client Error:', err);
                this.isConnected = false;
            });

            this.client.on('connect', () => {
                logger.info('✅ Redis connected successfully');
                this.isConnected = true;
            });

            await this.client.connect();
        } catch (error: any) {
            logger.warn('⚠️  Redis connection failed, will use in-memory fallback:', error.message);
            this.client = null;
            this.isConnected = false;
        }
    }

    /**
     * Get value from Redis cache
     */
    async get<T = any>(key: string): Promise<T | null> {
        if (!this.isConnected || !this.client) return null;

        try {
            const value = await this.client.get(key);
            return value ? JSON.parse(value as string) : null;
        } catch (error: any) {
            logger.warn(`Redis GET failed for key ${key}:`, error.message);
            return null;
        }
    }

    /**
     * Set value in Redis cache with optional TTL
     */
    async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
        if (!this.isConnected || !this.client) return;

        try {
            const serialized = JSON.stringify(value);

            if (ttlSeconds) {
                await this.client.setEx(key, ttlSeconds, serialized);
            } else {
                await this.client.set(key, serialized);
            }
        } catch (error: any) {
            logger.warn(`Redis SET failed for key ${key}:`, error.message);
        }
    }

    /**
     * Delete key from Redis cache
     */
    async delete(key: string): Promise<void> {
        if (!this.isConnected || !this.client) return;

        try {
            await this.client.del(key);
        } catch (error: any) {
            logger.warn(`Redis DELETE failed for key ${key}:`, error.message);
        }
    }

    /**
     * Check if Redis is healthy and connected
     */
    async isHealthy(): Promise<boolean> {
        if (!this.client) return false;

        try {
            await this.client.ping();
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Close Redis connection
     */
    async disconnect(): Promise<void> {
        if (this.client) {
            await this.client.quit();
            this.isConnected = false;
            logger.info('Redis disconnected');
        }
    }
}
