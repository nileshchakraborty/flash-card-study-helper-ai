import { describe, it, expect, jest, beforeAll, afterAll } from '@jest/globals';
import { ExpressServer } from '../../src/adapters/primary/express/server.js';
import { AuthService } from '../../src/core/services/AuthService.js';
import { invoke } from '../utils/invoke.js';

const SKIP_SANDBOX = process.env.SANDBOX !== 'false';
const describeOrSkip = SKIP_SANDBOX ? describe.skip : describe;

describeOrSkip('GraphQL Server Configuration', () => {
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
        await server.setupGraphQL({ skipWebSocket: true });
        server.setupRoutes();

        app = server.getApp();
    });

    afterAll(async () => {
        // Cleanup
    });

    describe('Apollo Server Setup', () => {
        it('should have GraphQL endpoint accessible', async () => {
            const response = await invoke(app, 'POST', '/graphql', {
                body: {
                    query: '{ health }'
                }
            });

            expect(response.status).toBe(200);
            expect(response.json).toHaveProperty('data');
        });

        it('should have Apollo Sandbox landing page plugin configured', async () => {
            const response = await invoke(app, 'GET', '/graphql', {
                headers: { Accept: 'text/html' }
            });

            expect(response.status).toBe(200);
        });

        it('should return formatted GraphQL errors', async () => {
            const response = await invoke(app, 'POST', '/graphql', {
                body: {
                    query: '{ invalidQuery }'
                }
            });

            expect(response.status).toBe(400);
            expect((response.json as any).errors).toBeDefined();
        });
    });

    describe('Context Injection', () => {
        it('should include user in context when token is provided', async () => {
            const response = await invoke(app, 'POST', '/graphql', {
                headers: { Authorization: `Bearer ${validToken}` },
                body: {
                    query: '{ health }'
                }
            });

            expect(response.status).toBe(200);
            // No direct context assertion here, but request should succeed
            expect((response.json as any).errors).toBeUndefined();
        });
    });
});
