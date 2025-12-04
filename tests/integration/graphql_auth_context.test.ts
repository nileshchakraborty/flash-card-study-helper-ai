import { describe, it, expect, jest, beforeAll, afterEach } from '@jest/globals';
import { ExpressServer } from '../../src/adapters/primary/express/server.js';
import { AuthService } from '../../src/core/services/AuthService.js';
import { invoke } from '../utils/invoke.js';

const SKIP_SANDBOX = process.env.SANDBOX !== 'false';
const describeOrSkip = SKIP_SANDBOX ? describe.skip : describe;

describeOrSkip('GraphQL Authentication Context', () => {
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

    await server.setupGraphQL({ skipWebSocket: true });
    server.setupRoutes();

    app = server.getApp();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Valid Authentication', () => {
    it('should extract user from valid JWT token in Authorization header', async () => {
      const response = await invoke(app, 'POST', '/graphql', {
        headers: { Authorization: `Bearer ${validToken}` },
        body: {
          query: `
            mutation {
              generateFlashcards(input: { topic: "Test", count: 5 }) {
                jobId
              }
            }
          `
        }
      });

      expect(response.status).toBe(200);
      const data = (response.json as any).data;
      expect(data).toBeDefined();
      expect(data.generateFlashcards).toBeDefined();
    });

    it('should allow authenticated mutation to succeed', async () => {
      const response = await invoke(app, 'POST', '/graphql', {
        headers: { Authorization: `Bearer ${validToken}` },
        body: {
          query: `
            mutation {
              generateFlashcards(input: { topic: "Auth Test", count: 3 }) {
                jobId
              }
            }
          `
        }
      });

      expect((response.json as any).errors).toBeUndefined();
      expect((response.json as any).data.generateFlashcards.jobId).toBe('job-123');
    });
  });

  describe('Invalid/Missing Authentication', () => {
    it('should return authentication error for expired/invalid token', async () => {
      const response = await invoke(app, 'POST', '/graphql', {
        headers: { Authorization: `Bearer ${expiredToken}` },
        body: {
          query: `
            mutation {
              generateFlashcards(input: { topic: "Test", count: 5 }) {
                jobId
              }
            }
          `
        }
      });

      expect((response.json as any).errors).toBeDefined();
      expect((response.json as any).errors[0].message).toMatch(/authentication/i);
    });

    it('should return authentication error for malformed Authorization header', async () => {
      const response = await invoke(app, 'POST', '/graphql', {
        headers: { Authorization: 'InvalidFormat' },
        body: {
          query: `
            mutation {
              generateFlashcards(input: { topic: "Test", count: 5 }) {
                jobId
              }
            }
          `
        }
      });

      expect((response.json as any).errors).toBeDefined();
      expect((response.json as any).errors[0].message).toMatch(/authentication/i);
    });

    it('should return authentication error when Authorization header is missing', async () => {
      const response = await invoke(app, 'POST', '/graphql', {
        body: {
          query: `
            mutation {
              generateFlashcards(input: { topic: "Test", count: 5 }) {
                jobId
              }
            }
          `
        }
      });

      expect((response.json as any).errors).toBeDefined();
      expect((response.json as any).errors[0].message).toMatch(/authentication/i);
    });

    it('should handle empty Bearer token gracefully', async () => {
      const response = await invoke(app, 'POST', '/graphql', {
        headers: { Authorization: 'Bearer ' },
        body: {
          query: `
            mutation {
              generateFlashcards(input: { topic: "Test", count: 5 }) {
                jobId
              }
            }
          `
        }
      });

      expect((response.json as any).errors).toBeDefined();
    });
  });

  describe('Public Queries', () => {
    it('should allow health query without authentication', async () => {
      const response = await invoke(app, 'POST', '/graphql', {
        body: { query: '{ health }' }
      });

      expect(response.status).toBe(200);
      const data = (response.json as any).data;
      expect(data.health).toBeDefined();
      expect((response.json as any).errors).toBeUndefined();
    });
  });
});
