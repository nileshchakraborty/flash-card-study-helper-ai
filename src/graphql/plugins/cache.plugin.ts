import type { ApolloServerPlugin } from '@apollo/server';
import type { LRUCache } from 'lru-cache';

/**
 * Simple in-memory response caching for GraphQL queries
 * Caches responses for frequently accessed queries to reduce load
 */
export const createResponseCachePlugin = (): ApolloServerPlugin => {
    // Simple cache with TTL support
    const cache = new Map<string, { data: any; expires: number }>();

    // Cache configuration
    const CACHE_TTL = {
        health: 60 * 1000,      // 60 seconds
        decks: 30 * 1000,       // 30 seconds  
        deck: 30 * 1000,        // 30 seconds
        job: 5 * 1000,          // 5 seconds (jobs change frequently)
        default: 10 * 1000      // 10 seconds default
    };

    return {
        async requestDidStart() {
            let cacheKey: string | null = null;
            let isCacheable = false;

            return {
                async didResolveOperation(requestContext) {
                    const { request, operation } = requestContext;

                    // Only cache queries, not mutations
                    if (operation?.operation === 'query') {
                        const operationName = request.operationName || 'anonymous';
                        cacheKey = `${operationName}:${JSON.stringify(request.variables || {})}`;

                        // Check cache
                        const cached = cache.get(cacheKey);
                        if (cached && cached.expires > Date.now()) {
                            console.log(`[Cache] HIT: ${operationName}`);
                            // Return cached response
                            requestContext.response = { body: { kind: 'single', singleResult: cached.data } };
                            isCacheable = false; // Already served from cache
                            return;
                        }

                        isCacheable = true;
                        console.log(`[Cache] MISS: ${operationName}`);
                    }
                },

                async willSendResponse(requestContext) {
                    if (isCacheable && cacheKey && requestContext.response.body.kind === 'single') {
                        const { singleResult } = requestContext.response.body;

                        // Don't cache errors
                        if (!singleResult.errors) {
                            const operationName = requestContext.request.operationName || 'default';
                            const ttl = CACHE_TTL[operationName as keyof typeof CACHE_TTL] || CACHE_TTL.default;

                            cache.set(cacheKey, {
                                data: singleResult,
                                expires: Date.now() + ttl
                            });

                            console.log(`[Cache] STORED: ${operationName} (TTL: ${ttl}ms)`);
                        }
                    }

                    // Clean expired entries periodically
                    if (Math.random() < 0.1) { // 10% chance
                        const now = Date.now();
                        for (const [key, value] of cache.entries()) {
                            if (value.expires < now) {
                                cache.delete(key);
                            }
                        }
                    }
                }
            };
        }
    };
};

/**
 * Clear the response cache
 * Call this when data changes to prevent serving stale data
 */
export function clearResponseCache() {
    // Cache is internal to plugin, so this is a no-op for now
    // In production, use a shared cache like Redis
    console.log('[Cache] Manual clear requested (not implemented in simple version)');
}
