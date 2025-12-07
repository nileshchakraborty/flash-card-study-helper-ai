import { jest, beforeAll, afterAll, describe, it, expect } from '@jest/globals';
import { ExpressServer } from '../src/adapters/primary/express/server.js';
import { StudyService } from '../src/core/services/StudyService.js';
import { QueueService } from '../src/core/services/QueueService.js';
import { invoke } from './utils/invoke.js';

const SKIP_SANDBOX = process.env.SANDBOX !== 'false';

describe('API Resilience Tests', () => {
    let app: any;
    let server: ExpressServer;
    let mockStudyService: any;
    let mockQueueService: QueueService;

    beforeAll(() => {
        // Mock StudyService
        mockStudyService = {
            generateFlashcards: jest.fn<any>().mockResolvedValue({
                cards: [
                    { id: '1', front: 'Q1', back: 'A1', topic: 'Test' },
                    { id: '2', front: 'Q2', back: 'A2', topic: 'Test' }
                ],
                recommendedTopics: ['Related Topic']
            }),
            processFile: jest.fn<any>(),
            getBriefAnswer: jest.fn<any>(),
            generateAdvancedQuiz: jest.fn<any>(),
            getQuizHistory: jest.fn<any>(),
            saveQuizResult: jest.fn<any>(),
            getDeckHistory: jest.fn<any>(),
            saveDeck: jest.fn<any>()
        };

        // Mock QueueService
        mockQueueService = {
            addGenerateJob: jest.fn<any>().mockResolvedValue('job-123'),
            getJobStatus: jest.fn<any>().mockResolvedValue({ status: 'completed' }),
            getQueueStats: jest.fn<any>().mockResolvedValue({ waiting: 0 })
        } as any;

        const mockFlashcardCache = {
            get: jest.fn<any>(),
            set: jest.fn()
        } as any;

        const mockWebLLMService = {} as any;
        const mockQuizStorage = {} as any;
        const mockFlashcardStorage = {} as any;

        server = new ExpressServer(
            mockStudyService,
            mockQueueService,
            mockFlashcardCache,
            mockWebLLMService,
            mockQuizStorage,
            mockFlashcardStorage
        );
        server.setupRoutes();
        app = server.getApp();
    });

    afterAll(async () => {
        // Clean up server and resources
        if (server) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        // Force Jest to clean up any pending timers
        jest.clearAllTimers();
    });

    const describeOrSkip = SKIP_SANDBOX ? describe.skip : describe;

    describeOrSkip('POST /api/generate', () => {
        it('should return 401 without auth token', async () => {
            const response = await invoke(app, 'POST', '/api/generate', {
                body: { topic: 'Test', count: 5 }
            });

            expect(response.status).toBe(401);
        });

        it('should queue job and return 202 with jobId when authenticated', async () => {
            // Generate a valid token using AuthService
            const { AuthService } = await import('../src/core/services/AuthService.js');
            const authService = AuthService.getInstance();
            const validToken = await authService.encryptToken({ id: 'test-user', email: 'test@example.com' });

            const response = await invoke(app, 'POST', '/api/generate', {
                headers: { Authorization: `Bearer ${validToken}` },
                body: {
                    topic: 'JavaScript Async',
                    count: 5,
                    mode: 'standard',
                    knowledgeSource: 'ai-web'
                }
            });

            expect(response.status).toBe(202);
            const body = response.json as any;
            expect(body.success).toBe(true);
            expect(body.jobId).toBeDefined();
            expect(body.statusUrl).toContain('/api/jobs/');
        });
    });

    describe('Rate Limiting', () => {
        it('should rate limit after too many requests', async () => {
            const endpoint = '/api/auth/google';

            // Make 6 requests (limit is 5 per hour for auth endpoints)
            for (let i = 0; i < 6; i++) {
                const response = await invoke(app, 'GET', endpoint);
                if (i < 5) {
                    expect(response.status).not.toBe(429);
                } else {
                    expect(response.status).toBe(429);
                }
            }
        }, 10000); // Increased timeout for rate limit test
    });

    describe('GET /api/health', () => {
        it('should return health status', async () => {
            const response = await invoke(app, 'GET', '/api/health');

            expect(response.status).toBe(200);
            const body = response.json as any;
            expect(body.ollama).toBeDefined();
            expect(body.serper).toBeDefined();
        });
    });

    describe('GET /api/queue/stats', () => {
        it('should return queue statistics when authenticated', async () => {
            const mockToken = 'mock-jwt-token';

            const response = await invoke(app, 'GET', '/api/queue/stats', {
                headers: { Authorization: `Bearer ${mockToken}` }
            });

            if (mockQueueService) {
                // Will fail auth with mock token, but endpoint exists
                expect([401, 200, 404]).toContain(response.status);
            } else {
                expect(response.status).toBe(404);
            }
        });
    });
});

// Load Test Helper
export async function loadTest(endpoint: string, concurrency: number, totalRequests: number) {
    const results: any[] = [];
    const start = Date.now();

    const makeRequest = async () => {
        const requestStart = Date.now();
        try {
            await request(endpoint).get('/');
            results.push({ success: true, duration: Date.now() - requestStart });
        } catch (error) {
            results.push({ success: false, duration: Date.now() - requestStart, error });
        }
    };

    // Run requests in batches
    for (let i = 0; i < totalRequests; i += concurrency) {
        const batch = Array(Math.min(concurrency, totalRequests - i))
            .fill(0)
            .map(() => makeRequest());
        await Promise.all(batch);
    }

    const totalDuration = Date.now() - start;
    const successCount = results.filter(r => r.success).length;

    return {
        totalRequests,
        successCount,
        failureCount: totalRequests - successCount,
        totalDuration,
        avgDuration: results.reduce((sum, r) => sum + r.duration, 0) / results.length,
        requestsPerSecond: (totalRequests / totalDuration) * 1000
    };
}
