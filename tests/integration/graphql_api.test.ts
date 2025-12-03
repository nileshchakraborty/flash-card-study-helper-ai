import { jest, beforeAll, afterAll, afterEach, describe, it, expect } from '@jest/globals';
import request from 'supertest';
import { ExpressServer } from '../../src/adapters/primary/express/server.js';
import { AuthService } from '../../src/core/services/AuthService.js';
import { FlashcardCacheService } from '../../src/core/services/FlashcardCacheService.js';
import { createMockServer } from '../utils/mockServer.js';

describe('GraphQL API Integration', () => {
    let app: any;
    let server: ExpressServer;
    let authService: AuthService;
    let validToken: string;
    let mockQueue: any;
    let mockStudyService: any;

    beforeAll(async () => {
        // Mock Services
        mockStudyService = {
            generateFlashcards: jest.fn<any>(),
            processFile: jest.fn<any>(),
            getBriefAnswer: jest.fn<any>(),
            generateAdvancedQuiz: jest.fn<any>(),
            getQuizHistory: jest.fn<any>(),
            saveQuizResult: jest.fn<any>(),
            getDeckHistory: jest.fn<any>(),
            saveDeck: jest.fn<any>()
        };

        mockQueue = {
            addGenerateJob: jest.fn<any>().mockResolvedValue('job-123'),
            getJob: jest.fn<any>().mockResolvedValue({
                id: 'job-123',
                status: 'completed',
                returnvalue: {
                    cards: [{ id: '1', front: 'Q', back: 'A', topic: 'Test' }],
                    recommendedTopics: []
                },
                failedReason: null,
                progress: 100
            }),
            getJobStatus: jest.fn<any>().mockResolvedValue({
                status: 'completed',
                result: {
                    cards: [{ id: '1', front: 'Q', back: 'A', topic: 'Test' }],
                    recommendedTopics: []
                }
            }),
            getQueueStats: jest.fn<any>().mockResolvedValue({ waiting: 0, active: 0 })
        };

        const mockWebLLMService = {} as any;
        const mockQuizStorage = {
            createQuiz: jest.fn<any>().mockResolvedValue({ id: 'quiz-1', topic: 'Test' }),
            getQuiz: jest.fn<any>().mockResolvedValue({ id: 'quiz-1', topic: 'Test' }),
            listQuizzes: jest.fn<any>().mockResolvedValue([])
        } as any;
        const mockFlashcardStorage = {
            createDeck: jest.fn<any>().mockResolvedValue({ id: 'deck-1', topic: 'Test' }),
            saveDeck: jest.fn<any>().mockResolvedValue(true),
            getDeck: jest.fn<any>().mockResolvedValue({ id: 'deck-1', topic: 'Test', cards: [] }),
            getDecks: jest.fn<any>().mockResolvedValue([]),
            getDeckByTopic: jest.fn<any>().mockResolvedValue({ id: 'deck-1', topic: 'Test', cards: [] }),
            deleteDeck: jest.fn<any>().mockResolvedValue(true),
            listDecks: jest.fn<any>().mockResolvedValue([])
        } as any;
        const mockFlashcardCache = new FlashcardCacheService(3600);

        // Initialize Server
        server = new ExpressServer(
            mockStudyService,
            mockQueue,
            mockFlashcardCache,
            mockWebLLMService,
            mockQuizStorage,
            mockFlashcardStorage
        );

        // Setup routes and GraphQL
        await server.setupGraphQL();
        server.setupRoutes();

        // Initialize Auth and generate token
        authService = AuthService.getInstance();
        validToken = await authService.encryptToken({
            id: 'test-user',
            email: 'test@example.com',
            name: 'Test User'
        });

        app = createMockServer(server.getApp());
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Query: health', () => {
        it('should return health status', async () => {
            const response = await request(app)
                .post('/graphql')
                .send({
                    query: `
                        query {
                            health
                        }
                    `
                });

            expect(response.status).toBe(200);
            expect(response.body.data.health.status).toBe('ok');
            expect(response.body.data.health.service).toBe('graphql');
        });
    });

    describe('Mutation: generateFlashcards', () => {
        it('should require authentication', async () => {
            const response = await request(app)
                .post('/graphql')
                .send({
                    query: `
                        mutation {
                            generateFlashcards(input: { topic: "Test", count: 5 }) {
                                jobId
                            }
                        }
                    `
                });

            expect(response.body.errors).toBeDefined();
            // Expect auth error code or message
        });

        it('should queue a job when authenticated', async () => {
            const response = await request(app)
                .post('/graphql')
                .set('Authorization', `Bearer ${validToken}`)
                .send({
                    query: `
                        mutation {
                            generateFlashcards(input: { topic: "Test", count: 5 }) {
                                jobId
                            }
                        }
                    `
                });

            expect(response.status).toBe(200);
            expect(response.body.data.generateFlashcards.jobId).toBe('job-123');
            expect(mockQueue.addGenerateJob).toHaveBeenCalled();
        });
    });

    describe('Query: job', () => {
        it('should return job status', async () => {
            const response = await request(app)
                .post('/graphql')
                .set('Authorization', `Bearer ${validToken}`)
                .send({
                    query: `
                        query {
                            job(id: "job-123") {
                                id
                                status
                            }
                        }
                    `
                });

            expect(response.status).toBe(200);
            expect(response.body.data.job.id).toBe('job-123');
            expect(response.body.data.job.status).toBe('COMPLETED');
        });
    });

    describe('Mutation: createDeck', () => {
        it('should create a deck', async () => {
            const response = await request(app)
                .post('/graphql')
                .set('Authorization', `Bearer ${validToken}`)
                .send({
                    query: `
                        mutation {
                            createDeck(input: { topic: "Test Deck", cards: [] }) {
                                id
                                topic
                            }
                        }
                    `
                });

            expect(response.status).toBe(200);
            expect(response.body.data.createDeck.id).toBeDefined();
        });
    });
});
