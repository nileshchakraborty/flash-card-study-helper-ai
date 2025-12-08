/** @jest-environment node */
import { FlashcardCacheService } from '../../src/core/services/FlashcardCacheService.js';

describe('FlashcardCacheService', () => {
    let cacheService: FlashcardCacheService;

    beforeEach(() => {
        cacheService = new FlashcardCacheService(1); // 1 second TTL for tests
    });

    afterEach(() => {
        cacheService.clear();
    });

    describe('set and get', () => {
        it('should store and retrieve flashcard results', async () => {
            const mockData = {
                cards: [{ id: '1', front: 'Q1', back: 'A1', topic: 'Test' }],
                recommendedTopics: ['Topic1']
            };

            await cacheService.set('React', 5, mockData, 'standard', 'ai-web');
            const result = await cacheService.get('React', 5, 'standard', 'ai-web');

            expect(result).toEqual(mockData);
        });

        it('should return null for cache miss', async () => {
            const result = await cacheService.get('NonExistent', 5);
            expect(result).toBeNull();
        });

        it('should be case-insensitive for topic names', async () => {
            const mockData = { cards: [] };
            await cacheService.set('React', 5, mockData);

            const result = await cacheService.get('react', 5);
            expect(result).toEqual(mockData);
        });
    });

    describe('has', () => {
        it('should return true for cached entries', async () => {
            await cacheService.set('Vue', 10, { cards: [] });
            expect(await cacheService.has('Vue', 10)).toBe(true);
        });

        it('should return false for non-existent entries', async () => {
            expect(await cacheService.has('Angular', 10)).toBe(false);
        });
    });

    describe('TTL expiration', () => {
        it('should expire entries after TTL', async () => {
            await cacheService.set('ExpireTest', 5, { cards: [] });
            expect(await cacheService.has('ExpireTest', 5)).toBe(true);

            // Wait for expiration
            await new Promise(resolve => setTimeout(resolve, 1100));

            expect(await cacheService.has('ExpireTest', 5)).toBe(false);
            expect(await cacheService.get('ExpireTest', 5)).toBeNull();
        });
    });

    describe('clear', () => {
        it('should remove all entries', async () => {
            await cacheService.set('Topic1', 5, { cards: [] });
            await cacheService.set('Topic2', 10, { cards: [] });

            await cacheService.clear();

            expect(await cacheService.has('Topic1', 5)).toBe(false);
            expect(await cacheService.has('Topic2', 10)).toBe(false);
            expect(cacheService.getStats().size).toBe(0);
        });
    });

    describe('getStats', () => {
        it('should return cache statistics', async () => {
            await cacheService.set('Topic1', 5, { cards: [] });
            await cacheService.set('Topic2', 10, { cards: [] });

            const stats = cacheService.getStats();
            expect(stats.size).toBe(2);
            expect(stats.ttlSeconds).toBe(1);
        });
    });
});
