import { FlashcardCacheService } from '../../src/core/services/FlashcardCacheService';

describe('FlashcardCacheService', () => {
    let cacheService: FlashcardCacheService;

    beforeEach(() => {
        cacheService = new FlashcardCacheService(1); // 1 second TTL for tests
    });

    afterEach(() => {
        cacheService.clear();
    });

    describe('set and get', () => {
        it('should store and retrieve flashcard results', () => {
            const mockData = {
                cards: [{ id: '1', front: 'Q1', back: 'A1', topic: 'Test' }],
                recommendedTopics: ['Topic1']
            };

            cacheService.set('React', 5, mockData, 'standard', 'ai-web');
            const result = cacheService.get('React', 5, 'standard', 'ai-web');

            expect(result).toEqual(mockData);
        });

        it('should return null for cache miss', () => {
            const result = cacheService.get('NonExistent', 5);
            expect(result).toBeNull();
        });

        it('should be case-insensitive for topic names', () => {
            const mockData = { cards: [] };
            cacheService.set('React', 5, mockData);

            const result = cacheService.get('react', 5);
            expect(result).toEqual(mockData);
        });
    });

    describe('has', () => {
        it('should return true for cached entries', () => {
            cacheService.set('Vue', 10, { cards: [] });
            expect(cacheService.has('Vue', 10)).toBe(true);
        });

        it('should return false for non-existent entries', () => {
            expect(cacheService.has('Angular', 10)).toBe(false);
        });
    });

    describe('TTL expiration', () => {
        it('should expire entries after TTL', async () => {
            cacheService.set('ExpireTest', 5, { cards: [] });
            expect(cacheService.has('ExpireTest', 5)).toBe(true);

            // Wait for expiration
            await new Promise(resolve => setTimeout(resolve, 1100));

            expect(cacheService.has('ExpireTest', 5)).toBe(false);
            expect(cacheService.get('ExpireTest', 5)).toBeNull();
        });
    });

    describe('clear', () => {
        it('should remove all entries', () => {
            cacheService.set('Topic1', 5, { cards: [] });
            cacheService.set('Topic2', 10, { cards: [] });

            cacheService.clear();

            expect(cacheService.has('Topic1', 5)).toBe(false);
            expect(cacheService.has('Topic2', 10)).toBe(false);
            expect(cacheService.getStats().size).toBe(0);
        });
    });

    describe('getStats', () => {
        it('should return cache statistics', () => {
            cacheService.set('Topic1', 5, { cards: [] });
            cacheService.set('Topic2', 10, { cards: [] });

            const stats = cacheService.getStats();
            expect(stats.size).toBe(2);
            expect(stats.ttlSeconds).toBe(1);
        });
    });
});
