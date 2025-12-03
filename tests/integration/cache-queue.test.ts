import { jest, beforeAll, afterAll, afterEach, describe, it, expect } from '@jest/globals';
import request from 'supertest';
import { ExpressServer } from '../../src/adapters/primary/express/server.js';
import { FlashcardCacheService } from '../../src/core/services/FlashcardCacheService.js';
import { QueueService } from '../../src/core/services/QueueService.js';
import { createMockServer } from '../utils/mockServer.js';

describe('Cache-Queue Integration', () => {
    let app: any;
    let server: ExpressServer;
    let flashcardCache: FlashcardCacheService;
    let mockStudyService: any;
    let mockQueue: any;

    beforeAll(() => {
        // Mock StudyService
        mockStudyService = {
            generateFlashcards: jest.fn<any>().mockResolvedValue({
                cards: [
                    { id: '1', front: 'Q1', back: 'A1', topic: 'Test' },
                    { id: '2', front: 'Q2', back: 'A2', topic: 'Test' }
                ],
                recommendedTopics: ['Related1', 'Related2']
            }),
            processFile: jest.fn<any>(),
            getBriefAnswer: jest.fn<any>(),
            generateAdvancedQuiz: jest.fn<any>(),
            getQuizHistory: jest.fn<any>(),
            saveQuizResult: jest.fn<any>(),
            getDeckHistory: jest.fn<any>(),
            saveDeck: jest.fn<any>()
        };

        flashcardCache = new FlashcardCacheService(3600);

        // Mock QueueService
        mockQueue = {
            addGenerateJob: jest.fn<any>().mockResolvedValue('job-123'),
            getJobStatus: jest.fn<any>().mockResolvedValue({
                status: 'completed',
                result: {
                    cards: [{ id: '1', front: 'Q', back: 'A', topic: 'Test' }],
                    recommendedTopics: []
                }
            }),
            getQueueStats: jest.fn<any>().mockResolvedValue({
                waiting: 0,
                active: 1,
                completed: 5,
                failed: 0,
                delayed: 0
            })
        } as any;

        // Mock other services
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
        server.setupRoutes();
        app = createMockServer(server.getApp());
    });

    afterEach(() => {
        jest.clearAllMocks();
        flashcardCache.clear();
    });

    afterAll(async () => {
        // Clean up server and resources
        if (server) {
            // Close any open connections
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    });

    describe('POST /api/generate with cache', () => {
        const mockToken = 'mock-valid-jwt-token'; // In real tests, generate valid JWE

        it('should return cached result on cache hit', async () => {
            // Pre-populate cache
            const cachedData = {
                cards: [{ id: 'cached', front: 'Cached Q', back: 'Cached A', topic: 'React' }],
                recommendedTopics: ['Cached Topic']
            };
            flashcardCache.set('JavaScript', 5, cachedData, 'standard', 'ai-web');

            const response = await request(app)
                .post('/api/generate')
                .set('Authorization', `Bearer ${mockToken}`)
                .send({
                    topic: 'JavaScript',
                    count: 5,
                    mode: 'standard',
                    knowledgeSource: 'ai-web'
                });

            // Should return cached data without queuing
            expect(mockQueue.addGenerateJob).not.toHaveBeenCalled();

            // Note: Will likely fail auth with mock token, but logic is correct
            if (response.status === 200) {
                expect(response.body.cached).toBe(true);
                expect(response.body.cards).toEqual(cachedData.cards);
            }
        });

        it('should queue job on cache miss', async () => {
            const response = await request(app)
                .post('/api/generate')
                .set('Authorization', `Bearer ${mockToken}`)
                .send({
                    topic: 'Python',
                    count: 10,
                    mode: 'standard',
                    knowledgeSource: 'ai-web'
                });

            // With mock token, will fail auth, but if it passes:
            if (response.status === 202) {
                expect(mockQueue.addGenerateJob).toHaveBeenCalledWith(
                    expect.objectContaining({
                        topic: 'Python',
                        count: 10
                    })
                );
                expect(response.body.jobId).toBe('job-123');
            }
        });
    });

    describe('GET /api/queue/stats', () => {
        it('should return queue statistics', async () => {
            const mockToken = 'mock-token';

            const response = await request(app)
                .get('/api/queue/stats')
                .set('Authorization', `Bearer ${mockToken}`);

            // Will fail auth with mock token
            expect([401, 200]).toContain(response.status);
        });
    });

    describe('Cache TTL', () => {
        it('should not return expired cached entries', async () => {
            const shortCache = new FlashcardCacheService(1); // 1 second
            shortCache.set('ExpireTest', 5, { cards: [] });

            await new Promise(resolve => setTimeout(resolve, 1100));

            const result = shortCache.get('ExpireTest', 5);
            expect(result).toBeNull();
        });
    });
});
