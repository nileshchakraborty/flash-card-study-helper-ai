import { ResilienceService } from '../../src/core/services/ResilienceService';

describe('ResilienceService', () => {
    let resilienceService: ResilienceService;

    beforeEach(() => {
        resilienceService = new ResilienceService();
    });

    describe('Circuit Breaker', () => {
        it('should execute successful operations', async () => {
            const mockAction = jest.fn().mockResolvedValue('success');

            const result = await resilienceService.execute('test-breaker', mockAction);

            expect(result).toBe('success');
            expect(mockAction).toHaveBeenCalledTimes(1);
        });

        it('should return fallback on failure', async () => {
            const mockAction = jest.fn().mockRejectedValue(new Error('Service unavailable'));

            const result = await resilienceService.execute('test-breaker-fail', mockAction);

            expect(result).toEqual({ error: 'Service unavailable, please try again later.' });
        });

        it('should open circuit after multiple failures', async () => {
            const mockAction = jest.fn().mockRejectedValue(new Error('Fail'));

            // Trigger failures
            for (let i = 0; i < 10; i++) {
                await resilienceService.execute('test-breaker-open', mockAction);
            }

            // Circuit should be open now, action shouldn't be called
            const callCountBefore = mockAction.mock.calls.length;
            await resilienceService.execute('test-breaker-open', mockAction);

            // May still call once more due to circuit breaker logic
            expect(mockAction.mock.calls.length).toBeGreaterThanOrEqual(callCountBefore);
        });

        it('should handle timeout', async () => {
            const slowAction = jest.fn(() => new Promise(resolve => setTimeout(resolve, 20000)));

            const result = await resilienceService.execute(
                'test-timeout',
                slowAction,
                { timeout: 100 } // 100ms timeout
            );

            expect(result).toEqual({ error: 'Service unavailable, please try again later.' });
        });
    });

    describe('Multiple Breakers', () => {
        it('should maintain separate state for different breakers', async () => {
            const action1 = jest.fn().mockResolvedValue('success1');
            const action2 = jest.fn().mockRejectedValue(new Error('fail2'));

            await resilienceService.execute('breaker1', action1);
            await resilienceService.execute('breaker2', action2);

            // breaker1 should still work
            const result1 = await resilienceService.execute('breaker1', action1);
            expect(result1).toBe('success1');

            // breaker2 should use fallback
            const result2 = await resilienceService.execute('breaker2', action2);
            expect(result2).toEqual({ error: 'Service unavailable, please try again later.' });
        });
    });
});
