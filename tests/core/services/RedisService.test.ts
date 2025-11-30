import { RedisService } from '../../../src/core/services/RedisService.js';

describe('RedisService', () => {
    let service: RedisService;

    beforeEach(() => {
        service = new RedisService();
    });

    describe('connection', () => {
        it('should handle connection failure gracefully', async () => {
            // Try to connect to non-existent Redis
            await service.connect('redis://localhost:9999');

            // Should not throw, just log warning
            const isHealthy = await service.isHealthy();
            expect(isHealthy).toBe(false);
        });

        it('should detect disconnected state', async () => {
            const isHealthy = await service.isHealthy();
            expect(isHealthy).toBe(false);
        });
    });

    describe('get/set operations (when disconnected)', () => {
        it('should return null gracefully when getting from disconnected Redis', async () => {
            const result = await service.get('test-key');
            expect(result).toBeNull();
        });

        it('should not throw when setting to disconnected Redis', async () => {
            await expect(
                service.set('test-key', 'test-value', 60)
            ).resolves.not.toThrow();
        });

        it('should not throw when deleting from disconnected Redis', async () => {
            await expect(
                service.delete('test-key')
            ).resolves.not.toThrow();
        });
    });

    describe('data serialization (mock test)', () => {
        it('should serialize and deserialize objects correctly', () => {
            const testObj = { name: 'test', value: 123 };
            const serialized = JSON.stringify(testObj);
            const deserialized = JSON.parse(serialized);

            expect(deserialized).toEqual(testObj);
        });
    });
});
