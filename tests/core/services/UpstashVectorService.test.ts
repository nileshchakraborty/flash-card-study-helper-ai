import { UpstashVectorService } from '../../../src/core/services/UpstashVectorService.js';

describe('UpstashVectorService', () => {
    let service: UpstashVectorService;

    beforeEach(() => {
        service = new UpstashVectorService();
    });

    describe('initialization', () => {
        it('should handle initialization failure gracefully', async () => {
            // Will fail since env vars not set
            await service.initialize();
            expect(service.isAvailable()).toBe(false);
        });
    });

    describe('vector operations (when not initialized)', () => {
        it('should not throw when upserting to uninitialized service', async () => {
            await expect(
                service.upsertFlashcard('test-id', 'test text', { topic: 'test' })
            ).resolves.not.toThrow();
        });

        it('should return empty array when searching uninitialized service', async () => {
            const results = await service.searchSimilar('test query', 5);
            expect(results).toEqual([]);
        });

        it('should not throw when deleting from uninitialized service', async () => {
            await expect(
                service.deleteFlashcard('test-id')
            ).resolves.not.toThrow();
        });
    });

    describe('availability check', () => {
        it('should return false when not initialized', () => {
            expect(service.isAvailable()).toBe(false);
        });
    });
});
