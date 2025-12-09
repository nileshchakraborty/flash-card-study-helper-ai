import { describe, it, beforeAll, expect, jest } from '@jest/globals';
import { ExpressServer } from '../../src/adapters/primary/express/server.js';
import { FlashcardCacheService } from '../../src/core/services/FlashcardCacheService.js';

describe('Generate fallback when queue is unavailable', () => {
    let server: ExpressServer;
    let mockStudyService: any;
    let mockQueue: any;

    beforeAll(() => {
        mockStudyService = {
            generateFlashcards: jest.fn<any>().mockResolvedValue({
                cards: [
                    { id: '1', front: 'Q1', back: 'A1', topic: 'Biology' },
                    { id: '2', front: 'Q2', back: 'A2', topic: 'Biology' }
                ],
                recommendedTopics: ['Genetics']
            })
        };

        mockQueue = {
            addGenerateJob: jest.fn<any>().mockRejectedValue(new Error('redis down')),
            getJobStatus: jest.fn<any>(),
            getQueueStats: jest.fn<any>()
        } as any;

        const flashcardCache = new FlashcardCacheService(3600);
        const mockWebLLMService = {} as any;
        const mockQuizStorage = {} as any;
        const mockFlashcardStorage = {} as any;

        server = new ExpressServer(
            mockStudyService,
            mockQueue,
            flashcardCache,
            mockWebLLMService,
            mockQuizStorage,
            mockFlashcardStorage
        );
    });

    afterAll(async () => {
        // Clean up resources
        if (server) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        // Force Jest to clean up any pending timers
        jest.clearAllTimers();
    });

    it('falls back to synchronous generation if queuing fails', async () => {
        const req: any = {
            body: {
                topic: 'Biology',
                count: 2,
                mode: 'standard',
                knowledgeSource: 'ai-web'
            },
            user: { id: 'user-1' }
        };

        const res: any = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        };

        await (server as any).handleGenerate(req, res);

        expect(mockQueue.addGenerateJob).toHaveBeenCalled();
        expect(mockStudyService.generateFlashcards).toHaveBeenCalledWith(
            'Biology',
            2,
            'standard',
            'ai-web',
            'ollama',
            undefined,
            undefined
        );
        expect(res.status).not.toHaveBeenCalledWith(500);

        const payload = res.json.mock.calls[0][0];
        expect(payload.success).toBe(true);
        expect(payload.cards).toHaveLength(2);
        expect(payload.jobId).toBeUndefined();
    });
});
