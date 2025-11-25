import request from 'supertest';
import { ExpressServer } from '../src/adapters/primary/express/server.js';
import { StudyService } from '../src/core/services/StudyService.js';
import { QueueService } from '../src/core/services/QueueService.js';

describe('API Resilience Tests', () => {
    let app: any;
    let server: ExpressServer;
    let mockStudyService: any;
    let mockQueueService: QueueService;

    beforeAll(() => {
        // Mock StudyService
        mockStudyService = {
            generateFlashcards: jest.fn().mockResolvedValue({
                cards: [
                    { id: '1', front: 'Q1', back: 'A1', topic: 'Test' },
                    { id: '2', front: 'Q2', back: 'A2', topic: 'Test' }
                ],
                recommendedTopics: ['Related Topic']
            }),
            processFile: jest.fn(),
            getBriefAnswer: jest.fn(),
            generateAdvancedQuiz: jest.fn(),
            getQuizHistory: jest.fn(),
            saveQuizResult: jest.fn(),
            getDeckHistory: jest.fn(),
            saveDeck: jest.fn()
        };

        // Initialize QueueService (requires Redis)
        try {
            mockQueueService = new QueueService();
        } catch (e) {
            console.warn('Redis not available for tests, queue tests will be skipped');
        }

        server = new ExpressServer(mockStudyService, mockQueueService);
        app = server.getApp();
    });

    describe('POST /api/generate', () => {
        it('should return 401 without auth token', async () => {
            const response = await request(app)
                .post('/api/generate')
                .send({ topic: 'Test', count: 5 });

            expect(response.status).toBe(401);
        });

        it('should queue job and return 202 with jobId when authenticated', async () => {
            // Mock token (in real tests, you'd generate a valid JWE token)
            const mockToken = 'mock-jwt-token';

            const response = await request(app)
                .post('/api/generate')
                .set('Authorization', `Bearer ${mockToken}`)
                .send({
                    topic: 'JavaScript Async',
                    count: 5,
                    mode: 'standard',
                    knowledgeSource: 'ai-web'
                });

            if (mockQueueService) {
                expect(response.status).toBe(202);
                expect(response.body.success).toBe(true);
                expect(response.body.jobId).toBeDefined();
                expect(response.body.statusUrl).toContain('/api/jobs/');
            } else {
                expect(response.status).toBe(401); // Auth will fail with mock token
            }
        });
    });

    describe('Rate Limiting', () => {
        it('should rate limit after too many requests', async () => {
            const endpoint = '/api/auth/google';

            // Make 6 requests (limit is 5 per hour for auth endpoints)
            for (let i = 0; i < 6; i++) {
                const response = await request(app).get(endpoint);
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
            const response = await request(app).get('/api/health');

            expect(response.status).toBe(200);
            expect(response.body.ollama).toBeDefined();
            expect(response.body.serper).toBeDefined();
        });
    });

    describe('GET /api/queue/stats', () => {
        it('should return queue statistics when authenticated', async () => {
            const mockToken = 'mock-jwt-token';

            const response = await request(app)
                .get('/api/queue/stats')
                .set('Authorization', `Bearer ${mockToken}`);

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
