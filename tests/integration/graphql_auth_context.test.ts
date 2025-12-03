import { describe, it, expect, jest, beforeAll, afterEach } from '@jest/globals';
import request from 'supertest';
import { ExpressServer } from '../../src/adapters/primary/express/server.js';
import { AuthService } from '../../src/core/services/AuthService.js';
import { createMockServer } from '../utils/mockServer.js';

describe('GraphQL Authentication Context', () => {
    let server: ExpressServer;
    let app: any;
    let authService: AuthService;
    let validToken: string;
    let expiredToken: string;

    beforeAll(async () => {
        authService = AuthService.getInstance();

        // Create valid token
        validToken = await authService.encryptToken({
            id: 'test-user-123',
            email: 'test@example.com',
            name: 'Test User'
        });

        // Create mock expired token (this will be an invalid token for testing)
        expiredToken = 'expired.token.here';

        // Setup mock services
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
            addGenerateJob: jest.fn<any>().mockResolvedValue('job-123'),
            getJob: jest.fn<any>().mockResolvedValue({
                id: 'job-123',
                status: 'completed',
                returnvalue: { cards: [], recommendedTopics: [] }
            })
        } as any;

        const mockFlashcardCache = {} as any;
        const mockWebLLMService = {} as any;
        const mockQuizStorage = {} as any;
        const mockFlashcardStorage = {
            getDecks: jest.fn<any>().mockResolvedValue([])
        } as any;

        server = new ExpressServer(
            mockStudyService,
            mockQueueService,
            mockFlashcardCache,
            mockWebLLMService,
            mockQuizStorage,
            mockFlashcardStorage
        );

        await server.setupGraphQL();
        server.setupRoutes();

        app = createMockServer(server.getApp());
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Valid Authentication', () => {
        it('should extract user from valid JWT token in Authorization header', async () => {
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

            // Should not have authentication error
            expect(response.status).toBe(200);
            expect(response.body.data).toBeDefined();
            expect(response.body.data.generateFlashcards).toBeDefined();
        });

        it('should allow authenticated mutation to succeed', async () => {
            const response = await request(app)
                .post('/graphql')
                .set('Authorization', `Bearer ${validToken}`)
                .send({
                    query: `
            mutation {
              generateFlashcards(input: { topic: "Auth Test", count: 3 }) {
                jobId
              }
            }
          `
                });

            expect(response.body.errors).toBeUndefined();
            expect(response.body.data.generateFlashcards.jobId).toBe('job-123');
        });
    });

    describe('Invalid/Missing Authentication', () => {
        it('should return authentication error for expired/invalid token', async () => {
            const response = await request(app)
                .post('/graphql')
                .set('Authorization', `Bearer ${expiredToken}`)
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
            expect(response.body.errors[0].message).toMatch(/authentication/i);
        });

        it('should return authentication error for malformed Authorization header', async () => {
            const response = await request(app)
                .post('/graphql')
                .set('Authorization', 'InvalidFormat')
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
            expect(response.body.errors[0].message).toMatch(/authentication/i);
        });

        it('should return authentication error when Authorization header is missing', async () => {
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
            expect(response.body.errors[0].message).toMatch(/authentication/i);
        });

        it('should handle empty Bearer token gracefully', async () => {
            const response = await request(app)
                .post('/graphql')
                .set('Authorization', 'Bearer ')
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
        });
    });

    describe('Public Queries', () => {
        it('should allow health query without authentication', async () => {
            const response = await request(app)
                .post('/graphql')
                .send({
                    query: '{ health }'
                });

            expect(response.status).toBe(200);
            expect(response.body.data.health).toBeDefined();
            expect(response.body.errors).toBeUndefined();
        });

        it('should allow decks query without authentication', async () => {
            const response = await request(app)
                .post('/graphql')
                .send({
                    query: '{ decks { id topic } }'
                });

            expect(response.status).toBe(200);
            expect(response.body.data.decks).toBeDefined();
            expect(response.body.errors).toBeUndefined();
        });
    });

    describe('Context Builder Behavior', () => {
        it('should include user info in context for authenticated requests', async () => {
            // This test verifies the context builder extracts and includes user info
            const response = await request(app)
                .post('/graphql')
                .set('Authorization', `Bearer ${validToken}`)
                .send({
                    query: `
            mutation {
              generateFlashcards(input: { topic: "Context Test", count: 5 }) {
                jobId
              }
            }
          `
                });

            // If context.user is properly set, the mutation should succeed
            expect(response.body.data).toBeDefined();
            expect(response.body.errors).toBeUndefined();
        });

        it('should set user to null in context for unauthenticated requests', async () => {
            // Public queries should work with null user in context
            const response = await request(app)
                .post('/graphql')
                .send({
                    query: '{ health }'
                });

            expect(response.body.data.health).toBeDefined();
            expect(response.body.errors).toBeUndefined();
        });
    });
});
