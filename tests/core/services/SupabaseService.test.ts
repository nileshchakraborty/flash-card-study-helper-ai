import { SupabaseService } from '../../../src/core/services/SupabaseService.js';

describe('SupabaseService', () => {
    let service: SupabaseService;

    beforeEach(() => {
        service = new SupabaseService();
    });

    describe('initialization', () => {
        it('should handle missing credentials gracefully', async () => {
            // Will skip init since env vars not set in test
            await service.initialize();
            expect(service.isAvailable()).toBe(false);
        });

        it('should return null client when not initialized', () => {
            const client = service.getClient();
            expect(client).toBeNull();
        });
    });

    describe('CRUD operations (when not initialized)', () => {
        it('should return error for getFlashcards when not initialized', async () => {
            const result = await service.getFlashcards();
            expect(result.error).toBe('Supabase not initialized');
            expect(result.data).toBeNull();
        });

        it('should return error for createFlashcard when not initialized', async () => {
            const result = await service.createFlashcard({
                front: 'Test',
                back: 'Test'
            });
            expect(result.error).toBe('Supabase not initialized');
        });

        it('should return error for quiz operations when not initialized', async () => {
            const getResult = await service.getQuizzes();
            expect(getResult.error).toBe('Supabase not initialized');

            const createResult = await service.createQuiz({ topic: 'Test' });
            expect(createResult.error).toBe('Supabase not initialized');
        });
    });

    describe('availability check', () => {
        it('should return false when not initialized', () => {
            expect(service.isAvailable()).toBe(false);
        });
    });
});
