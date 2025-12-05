import { describe, it, expect, jest, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { ExpressServer } from '../../src/adapters/primary/express/server.js';
import { AuthService } from '../../src/core/services/AuthService.js';
import { createMockServer } from '../utils/mockServer.js';
import {
    benchmark,
    compareResults,
    formatResultsTable,
    logComparison,
    type ComparisonResult
} from './benchmark_utils.js';

const SKIP_SANDBOX = process.env.SANDBOX !== 'false';

(SKIP_SANDBOX ? describe.skip : describe)('Performance: GraphQL vs REST', () => {
    let server: ExpressServer;
    let app: any;
    let authService: AuthService;
    let validToken: string;
    const results: ComparisonResult[] = [];

    beforeAll(async () => {
        // Setup mock services
        authService = AuthService.getInstance();
        validToken = await authService.encryptToken({
            id: 'perf-test-user',
            email: 'perf@example.com',
            name: 'Performance Test User'
        });

        const mockStudyService = {
            generateFlashcards: jest.fn<any>(),
            processFile: jest.fn<any>(),
            getBriefAnswer: jest.fn<any>(),
            generateAdvancedQuiz: jest.fn<any>(),
            getQuizHistory: jest.fn<any>(),
            saveQuizResult: jest.fn<any>(),
            getDeckHistory: jest.fn<any>(),
            saveDeck: jest.fn<any>()
        } as any;

        const mockQueueService = {
            addGenerateJob: jest.fn<any>().mockResolvedValue('perf-job-123'),
            getJob: jest.fn<any>().mockResolvedValue({
                id: 'perf-job-123',
                status: 'completed',
                returnvalue: { cards: [], recommendedTopics: [] },
                progress: 100
            })
        } as any;

        const mockFlashcardCache = {} as any;
        const mockWebLLMService = {} as any;
        const mockQuizStorage = {} as any;
        const mockFlashcardStorage = {
            getDecks: jest.fn<any>().mockResolvedValue([
                { id: '1', topic: 'Math', cards: [] },
                { id: '2', topic: 'Science', cards: [] }
            ])
        } as any;

        server = new ExpressServer(
            mockStudyService,
            mockQueueService,
            mockFlashcardCache,
            mockWebLLMService,
            mockQuizStorage,
            mockFlashcardStorage
        );

        await server.setupGraphQL({ skipWebSocket: true });
        server.setupRoutes();
        app = createMockServer(server.getApp());

        console.log('\n🚀 Starting Performance Benchmarks...\n');
    });

    afterAll(() => {
        // Print summary table
        console.log('\n' + '='.repeat(80));
        console.log('📊 PERFORMANCE BENCHMARK SUMMARY');
        console.log('='.repeat(80) + '\n');
        console.log(formatResultsTable(results));
        console.log('\n' + '='.repeat(80) + '\n');
    });

    describe('Single Query Performance', () => {
        it('should benchmark health check', async () => {
            const restResult = await benchmark(
                'Health Check (REST)',
                async () => {
                    await request(app).get('/api/health');
                },
                50, // iterations
                5   // warmup
            );

            const graphqlResult = await benchmark(
                'Health Check (GraphQL)',
                async () => {
                    await request(app)
                        .post('/graphql')
                        .send({ query: '{ health }' });
                },
                50,
                5
            );

            const comparison = compareResults('Health Check', restResult, graphqlResult);
            results.push(comparison);
            logComparison(comparison);

            // Both should be reasonably fast
            expect(restResult.avg).toBeLessThan(100);
            expect(graphqlResult.avg).toBeLessThan(150);
        });

        it('should benchmark decks query', async () => {
            const restResult = await benchmark(
                'Get Decks (REST)',
                async () => {
                    await request(app)
                        .get('/api/decks')
                        .set('Authorization', `Bearer ${validToken}`);
                },
                50,
                5
            );

            const graphqlResult = await benchmark(
                'Get Decks (GraphQL)',
                async () => {
                    await request(app)
                        .post('/graphql')
                        .set('Authorization', `Bearer ${validToken}`)
                        .send({
                            query: '{ decks { id topic } }'
                        });
                },
                50,
                5
            );

            const comparison = compareResults('Get Decks', restResult, graphqlResult);
            results.push(comparison);
            logComparison(comparison);

            expect(restResult.avg).toBeLessThan(200);
            expect(graphqlResult.avg).toBeLessThan(200);
        });

        it('should benchmark job status query', async () => {
            const restResult = await benchmark(
                'Job Status (REST)',
                async () => {
                    await request(app)
                        .get('/api/queue/job/perf-job-123')
                        .set('Authorization', `Bearer ${validToken}`);
                },
                50,
                5
            );

            const graphqlResult = await benchmark(
                'Job Status (GraphQL)',
                async () => {
                    await request(app)
                        .post('/graphql')
                        .set('Authorization', `Bearer ${validToken}`)
                        .send({
                            query: '{ job(id: "perf-job-123") { id status } }'
                        });
                },
                50,
                5
            );

            const comparison = compareResults('Job Status', restResult, graphqlResult);
            results.push(comparison);
            logComparison(comparison);
        });
    });

    describe('Batch Query Performance', () => {
        it('should benchmark batch queries (GraphQL advantage)', async () => {
            // REST: 3 separate requests
            const restResult = await benchmark(
                'Batch - 3 Queries (REST)',
                async () => {
                    await Promise.all([
                        request(app).get('/api/decks').set('Authorization', `Bearer ${validToken}`),
                        request(app).get('/api/queue/job/perf-job-123').set('Authorization', `Bearer ${validToken}`),
                        request(app).get('/api/health')
                    ]);
                },
                30,
                3
            );

            // GraphQL: Single request with multiple queries
            const graphqlResult = await benchmark(
                'Batch - 3 Queries (GraphQL)',
                async () => {
                    await request(app)
                        .post('/graphql')
                        .set('Authorization', `Bearer ${validToken}`)
                        .send({
                            query: `
                {
                  health
                  decks { id topic }
                  job(id: "perf-job-123") { id status }
                }
              `
                        });
                },
                30,
                3
            );

            const comparison = compareResults('Batch Queries (3)', restResult, graphqlResult);
            results.push(comparison);
            logComparison(comparison);

            // GraphQL should be faster for batch operations
            console.log(`\n💡 GraphQL batch advantage: ${comparison.improvement}\n`);
        });
    });

    describe('Mutation Performance', () => {
        it('should benchmark mutation operations', async () => {
            const restResult = await benchmark(
                'Generate Flashcards (REST)',
                async () => {
                    await request(app)
                        .post('/api/generate')
                        .set('Authorization', `Bearer ${validToken}`)
                        .send({ topic: 'Performance Test', count: 5 });
                },
                20,
                2
            );

            const graphqlResult = await benchmark(
                'Generate Flashcards (GraphQL)',
                async () => {
                    await request(app)
                        .post('/graphql')
                        .set('Authorization', `Bearer ${validToken}`)
                        .send({
                            query: `
                mutation {
                  generateFlashcards(input: { topic: "Performance Test", count: 5 }) {
                    jobId
                  }
                }
              `
                        });
                },
                20,
                2
            );

            const comparison = compareResults('Generate Flashcards', restResult, graphqlResult);
            results.push(comparison);
            logComparison(comparison);
        });
    });

    describe('Load Testing', () => {
        it('should handle concurrent requests (10 users)', async () => {
            const concurrentUsers = 10;
            const requestsPerUser = 5;

            console.log(`\n🔥 Load Test: ${concurrentUsers} concurrent users...\n`);

            const startTime = Date.now();
            const promises: Promise<any>[] = [];

            for (let user = 0; user < concurrentUsers; user++) {
                for (let req = 0; req < requestsPerUser; req++) {
                    promises.push(
                        request(app)
                            .post('/graphql')
                            .set('Authorization', `Bearer ${validToken}`)
                            .send({ query: '{ health decks { id } }' })
                    );
                }
            }

            const responses = await Promise.all(promises);
            const duration = (Date.now() - startTime) / 1000;

            const successCount = responses.filter(r => r.status === 200).length;
            const successRate = (successCount / responses.length) * 100;
            const throughput = responses.length / duration;

            console.log(`✅ Total Requests: ${responses.length}`);
            console.log(`✅ Success Rate: ${successRate.toFixed(1)}%`);
            console.log(`✅ Duration: ${duration.toFixed(2)}s`);
            console.log(`✅ Throughput: ${throughput.toFixed(2)} req/s\n`);

            expect(successRate).toBeGreaterThan(95);
        });
    });
});
