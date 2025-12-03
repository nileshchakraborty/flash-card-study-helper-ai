import { describe, it, expect, jest, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { ExpressServer } from '../../src/adapters/primary/express/server.js';
import { StudyService } from '../../src/core/services/StudyService.js';
import { AuthService } from '../../src/core/services/AuthService.js';
import { QueueService } from '../../src/core/services/QueueService.js';
import { createMockServer } from '../utils/mockServer.js';

describe('GraphQL Server Configuration', () => {
    let server: ExpressServer;
    let app: any;
    let authService: AuthService;
    let validToken: string;

    beforeAll(async () => {
        // Initialize services with mocks
        authService = AuthService.getInstance();
        validToken = await authService.encryptToken({
            id: 'test-user',
            email: 'test@example.com',
            name: 'Test User'
        });

        const mockStudyService = {
            generateFlashcards: jest.fn<any>(),
            processFile: jest.fn<any>(),
            getBriefAnswer: jest.fn<any>(),
            generateAdvancedQuiz: jest.fn<any>(),
            getQuizHistory: jest.fn<any>(),
            saveQuizResult: jest.fn<any>(),
            getDeckHistory: jest.fn<any>(),
            saveDeck: jest.fn<any>(),
            aiAdapters: {
                ollama: {
                    generateQuizFromFlashcards: async () => [],
                    generateQuizFromTopic: async () => []
                }
            },
            searchAdapter: {
                search: async () => []
            }
        } as any;

        const mockQueueService = {
            addGenerateJob: jest.fn<any>().mockResolvedValue('test-job-id'),
            getJob: jest.fn<any>().mockResolvedValue({
                id: 'test-job-id',
                status: 'completed',
                returnvalue: { cards: [], recommendedTopics: [] },
                progress: 100
            }),
            getJobStatus: jest.fn<any>().mockResolvedValue({
                status: 'completed',
                result: { cards: [], recommendedTopics: [] }
            })
        } as any;

        const mockFlashcardCache = {} as any;
        const mockWebLLMService = {} as any;
        const mockQuizStorage = {
            createQuiz: jest.fn<any>(),
            getQuiz: jest.fn<any>(),
            listQuizzes: jest.fn<any>()
        } as any;
        const mockFlashcardStorage = {
            saveDeck: jest.fn<any>(),
            getDeck: jest.fn<any>(),
            getDecks: jest.fn<any>().mockResolvedValue([]),
            listDecks: jest.fn<any>()
        } as any;

        // Create server instance
        server = new ExpressServer(
            mockStudyService,
            mockQueueService,
            mockFlashcardCache,
            mockWebLLMService,
            mockQuizStorage,
            mockFlashcardStorage
        );

        // Initialize GraphQL and routes
        await server.setupGraphQL();
        server.setupRoutes();

        app = createMockServer(server.getApp());

    });

    afterAll(async () => {
        // Cleanup
    });

    describe('Apollo Server Setup', () => {
        it('should have GraphQL endpoint accessible', async () => {
            const response = await request(app)
                .post('/graphql')
                .send({
                    query: '{ health }'
                });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('data');
        });

        it('should have Apollo Sandbox landing page plugin configured', async () => {
            const response = await request(app)
                .get('/graphql')
                .set('Accept', 'text/html');

            // Apollo Sandbox or GraphQL endpoint response
            expect(response.status).toBe(200);
        });

        it('should return formatted GraphQL errors', async () => {
            const response = await request(app)
                .post('/graphql')
                .send({
                    query: '{ invalidQuery }'
                });

            expect(response.body).toHaveProperty('errors');
            expect(Array.isArray(response.body.errors)).toBe(true);
            expect(response.body.errors[0]).toHaveProperty('message');
        });
    });

    describe('Schema Validation', () => {
        it('should have health query defined', async () => {
            const response = await request(app)
                .post('/graphql')
                .send({
                    query: '{ health }'
                });

            expect(response.body.data).toHaveProperty('health');
        });

        it('should have decks query defined', async () => {
            const response = await request(app)
                .post('/graphql')
                .send({
                    query: '{ decks { id topic } }'
                });

            expect(response.body.data).toHaveProperty('decks');
            expect(Array.isArray(response.body.data.decks)).toBe(true);
        });

        it('should have job query defined', async () => {
            const response = await request(app)
                .post('/graphql')
                .send({
                    query: 'query { job(id: "test-id") { id status } }'
                });

            expect(response.body.data).toHaveProperty('job');
        });

        it('should have generateFlashcards mutation defined', async () => {
            const response = await request(app)
                .post('/graphql')
                .set('Authorization', `Bearer ${validToken}`)
                .send({
                    query: `
            mutation {
              generateFlashcards(input: { topic: "Test", count: 5 }) {
                cards { front back }
                jobId
              }
            }
          `
                });

            expect(response.body.data).toHaveProperty('generateFlashcards');
        });

        it('should have createDeck mutation defined', async () => {
            const response = await request(app)
                .post('/graphql')
                .send({
                    query: `
            mutation {
              createDeck(input: { topic: "Test", cards: [] }) {
                id
                topic
              }
            }
          `
                });

            expect(response.body.data).toHaveProperty('createDeck');
        });

        it('should have Subscription type defined in schema', async () => {
            const response = await request(app)
                .post('/graphql')
                .send({
                    query: `
            {
              __type(name: "Subscription") {
                name
                fields {
                  name
                }
              }
            }
          `
                });

            expect(response.body.data.__type).not.toBeNull();
            expect(response.body.data.__type.name).toBe('Subscription');
            const fieldNames = response.body.data.__type.fields.map((f: any) => f.name);
            expect(fieldNames).toContain('jobUpdated');
        });
    });

    describe('Error Handling', () => {
        it('should handle syntax errors gracefully', async () => {
            const response = await request(app)
                .post('/graphql')
                .send({
                    query: '{ invalid syntax }'
                });

            expect(response.body.errors).toBeDefined();
            expect(response.body.errors[0].message).toContain('Cannot query field');
        });

        it('should handle invalid variable types', async () => {
            const response = await request(app)
                .post('/graphql')
                .send({
                    query: 'query($id: String!) { job(id: $id) { id } }',
                    variables: { id: 123 } // Should be string
                });

            expect(response.body.errors).toBeDefined();
        });
    });
});
