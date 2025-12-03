import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { ApolloServer } from '@apollo/server';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { expressMiddleware as apolloExpressMiddleware } from '@apollo/server/express4';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { AuthService } from '../../../core/services/AuthService.js';
import { apiRateLimiter, authRateLimiter } from './middleware/rateLimit.middleware.js';
import { authMiddleware } from './middleware/auth.middleware.js';
import { typeDefs } from '../../../graphql/schema.js';
import { resolvers } from '../../../graphql/resolvers/index.js';
import { createContext } from '../../../graphql/context.js';
import type { StudyUseCase } from '../../../core/ports/interfaces.js';
import type { QueueService } from '../../../core/services/QueueService.js';
import type { FlashcardCacheService } from '../../../core/services/FlashcardCacheService.js';
import type { WebLLMService } from '../../../core/services/WebLLMService.js';
import type { QuizStorageService } from '../../../core/services/QuizStorageService.js';
import type { FlashcardStorageService } from '../../../core/services/FlashcardStorageService.js';
import type { RedisService } from '../../../core/services/RedisService.js';
import type { SupabaseService } from '../../../core/services/SupabaseService.js';
import type { UpstashVectorService } from '../../../core/services/UpstashVectorService.js';
import type { BlobStorageService } from '../../../core/services/BlobStorageService.js';

export class ExpressServer {
  private app: express.Application;
  private httpServer: any;
  private wss: WebSocketServer | null = null;
  private upload: multer.Multer;
  private authService: AuthService;
  private quizStorage: QuizStorageService;
  private flashcardStorage: FlashcardStorageService;
  private apolloServer?: ApolloServer;
  // External services (optional)
  private redisService: RedisService | null;
  private supabaseService: SupabaseService | null;
  private vectorService: UpstashVectorService | null;
  private blobService: BlobStorageService | null;

  constructor(
    private studyService: StudyUseCase,
    private queueService: QueueService,
    private flashcardCache: FlashcardCacheService,
    private webllmService: WebLLMService,
    quizStorage: QuizStorageService,
    flashcardStorage: FlashcardStorageService,
    redisService: RedisService | null = null,
    supabaseService: SupabaseService | null = null,
    vectorService: UpstashVectorService | null = null,
    blobService: BlobStorageService | null = null
  ) {
    this.app = express();
    this.httpServer = createServer(this.app);
    this.upload = multer({ storage: multer.memoryStorage() });
    this.authService = AuthService.getInstance();
    this.quizStorage = quizStorage;
    this.flashcardStorage = flashcardStorage;
    this.redisService = redisService;
    this.supabaseService = supabaseService;
    this.vectorService = vectorService;
    this.blobService = blobService;
    this.setupPassport();
    this.setupMiddleware();
    this.setupWebSocket();
    // Routes are now set up in start() to ensure correct order with GraphQL
  }



  private setupPassport() {
    passport.use(new GoogleStrategy({
      clientID: process.env.GOOGLE_CLIENT_ID || 'mock_client_id',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'mock_client_secret',
      callbackURL: '/api/auth/google/callback'
    }, (accessToken, refreshToken, profile, done) => {
      return done(null, profile);
    }));
  }

  private setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(passport.initialize());
    this.app.use(express.static('public'));

    // Swagger UI - handle gracefully if swagger.yaml doesn't exist
    try {
      const swaggerDocument = YAML.load(path.join(process.cwd(), 'swagger.yaml'));
      this.app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
    } catch (error) {
      console.warn('Swagger documentation not available');
    }
  }

  public async setupGraphQL() {
    // Create executable schema
    const schema = makeExecutableSchema({ typeDefs, resolvers });

    // Create Apollo Server instance
    this.apolloServer = new ApolloServer({
      schema,
      formatError: (error) => {
        console.error('GraphQL Error:', error);
        return error;
      },
      plugins: [
        // Enable Apollo Sandbox in development (modern alternative to GraphQL Playground)
        // This properly handles both GET (landing page) and POST (queries) requests
        process.env.NODE_ENV !== 'production'
          ? ApolloServerPluginLandingPageLocalDefault({
            embed: true,
            includeCookies: false
          })
          : ApolloServerPluginLandingPageLocalDefault({ embed: false }),
        // Response caching for optimization (placeholder - can be enhanced with Redis in production)
        {
          async requestDidStart() {
            return {
              async willSendResponse({ response }) {
                // Simple logging for now - full caching impl deferred
                if (response.body.kind === 'single' && !response.body.singleResult.errors) {
                  // Cache headers could be set here
                }
              }
            };
          }
        },
        {
          async serverWillStart() {
            return {
              async drainServer() {
                // cleanup
              },
            };
          },
        },
      ],
    });

    // Start Apollo Server
    await this.apolloServer.start();

    // Mount GraphQL endpoint for queries and mutations
    this.app.use(
      '/graphql',
      cors<cors.CorsRequest>(),
      express.json(),
      // Cast is needed because @apollo/server bundles its own express types
      // which differ from the app's @types/express version. The middleware
      // is runtime-compatible, so a narrow cast avoids the TS overload clash.
      apolloExpressMiddleware(this.apolloServer, {
        context: async ({ req }) => {
          const baseContext = await createContext(req, {
            authService: this.authService,
            studyService: this.studyService,
            quizStorage: this.quizStorage,
            flashcardStorage: this.flashcardStorage,
            queueService: this.queueService,
            webllmService: this.webllmService
          });

          // Add DataLoaders for query batching (basic implementation)
          const loaders = {
            deckLoader: null, // Placeholder - DataLoader impl ready in src/graphql/dataloaders
            jobLoader: null
          };

          return {
            ...baseContext,
            loaders
          };
        },
      }) as unknown as express.RequestHandler,
    );

    // Setup WebSocket server for GraphQL subscriptions
    // Using separate path /subscriptions to avoid conflict with HTTP /graphql endpoint
    const { WebSocketServer } = await import('ws');
    const { makeServer } = await import('graphql-ws');

    // Create WebSocket server directly attached to HTTP server (like WebLLM)
    const graphqlWsServer = new WebSocketServer({
      server: this.httpServer,
      path: '/subscriptions',
    });

    // Create graphql-ws server
    const subscriptionServer = makeServer({
      schema,
      context: async (ctx) => {
        // Extract token from connection params if provided
        const connectionParams: any = ctx.connectionParams || {};
        const token = connectionParams.authorization?.replace('Bearer ', '');

        // Create context similar to HTTP context
        let user;
        if (token) {
          try {
            const payload = await this.authService.decryptToken(token);
            user = {
              id: payload.id || payload.sub || '',
              email: payload.email || '',
              name: payload.name || ''
            };
          } catch (error: any) {
            console.warn('[GraphQL WS] Token decryption failed:', error.message);
          }
        }

        return {
          authService: this.authService,
          studyService: this.studyService,
          quizStorage: this.quizStorage,
          flashcardStorage: this.flashcardStorage,
          queueService: this.queueService,
          webllmService: this.webllmService,
          user,
          token
        };
      },
      onConnect: (ctx) => {
        console.log('[GraphQL WS] Client connected');
        return true; // Allow connection
      },
      onDisconnect: (ctx) => {
        console.log('[GraphQL WS] Client disconnected');
      },
    });

    // Handle WebSocket connections
    graphqlWsServer.on('connection', (socket, request) => {
      console.log('[GraphQL WS] WebSocket connection established for /subscriptions');

      const closed = subscriptionServer.opened(
        {
          protocol: socket.protocol,
          send: (data) =>
            new Promise((resolve, reject) => {
              socket.send(data, (err) => (err ? reject(err) : resolve()));
            }),
          close: (code, reason) => socket.close(code, reason),
          onMessage: (cb) => socket.on('message', async (event) => {
            try {
              await cb(event.toString());
            } catch (err) {
              socket.close(1011, (err as Error).message);
            }
          }),
        },
        { socket, request }
      );

      socket.once('close', (code, reason) => {
        closed(code, reason.toString());
      });
    });

    console.log('🚀 GraphQL endpoint available at /graphql');
    console.log('📡 GraphQL subscriptions available via WebSocket at /subscriptions');
  }

  private setupWebSocket() {
    if (!this.webllmService) return;

    this.wss = new WebSocketServer({
      server: this.httpServer,
      path: '/api/webllm/ws'
    });

    this.wss.on('connection', (ws, req) => {
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const sessionId = url.searchParams.get('sessionId');

      if (!sessionId) {
        ws.close(1008, 'Missing sessionId');
        return;
      }

      // Verify session exists
      const session = this.webllmService!.getSession(sessionId);
      if (!session) {
        ws.close(1008, 'Invalid sessionId');
        return;
      }

      // Attach WebSocket to session
      this.webllmService!.attachWebSocket(sessionId, ws);

      // Handle messages from client
      ws.on('message', async (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());

          if (message.type === 'generate') {
            await this.webllmService!.handleGenerationRequest(sessionId, message);
          } else if (message.type === 'response') {
            // Client sending back results
            this.webllmService!.handleClientResponse(sessionId, message);
          }
        } catch (error: any) {
          ws.send(JSON.stringify({
            type: 'error',
            error: error.message
          }));
        }
      });

      ws.on('close', () => {
        this.webllmService!.closeSession(sessionId);
      });
    });
  }

  public setupRoutes() {
    // Auth Routes
    this.app.get('/api/auth/google', authRateLimiter, passport.authenticate('google', { scope: ['profile', 'email'] }));

    this.app.get('/api/auth/google/callback',
      passport.authenticate('google', { session: false, failureRedirect: '/' }),
      async (req, res) => {
        const user = req.user as any;
        const token = await this.authService.encryptToken({
          id: user.id,
          email: user.emails?.[0]?.value,
          name: user.displayName
        });
        // Redirect to frontend with token
        res.redirect(`/?token=${token}`);
      }
    );

    // Flashcards (Protected - Async via Queue)
    this.app.post('/api/generate', apiRateLimiter, authMiddleware, async (req, res) => {
      try {
        const { topic, count, mode, knowledgeSource, runtime, parentTopic } = req.body;

        // Check cache first
        if (this.flashcardCache) {
          const cachedResult = this.flashcardCache.get(
            topic,
            count || 10,
            mode,
            knowledgeSource
          );

          if (cachedResult) {
            res.json({
              success: true,
              cached: true,
              ...cachedResult
            });
            return;
          }
        }

        // If queue is available, offload to background job
        if (this.queueService) {
          const jobId = await this.queueService.addGenerateJob({
            topic,
            count: count || 10,
            mode,
            knowledgeSource: knowledgeSource || 'ai-web',
            runtime: runtime || 'ollama',
            parentTopic,
            userId: (req as any).user?.id
          });

          res.status(202).json({
            success: true,
            jobId,
            message: 'Job queued for processing',
            statusUrl: `/api/jobs/${jobId}`
          });
        } else {
          // Fallback to synchronous processing if queue not available
          const result = await this.studyService.generateFlashcards(
            topic,
            count || 10,
            mode,
            knowledgeSource || 'ai-web',
            runtime || 'ollama',
            parentTopic
          );
          res.json({
            success: true,
            cards: result.cards,
            recommendedTopics: result.recommendedTopics,
            metadata: {
              runtime: runtime || 'ollama',
              knowledgeSource: knowledgeSource || 'ai-web',
              timestamp: Date.now()
            }
          });
        }
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Job Status Endpoint
    this.app.get('/api/jobs/:id', authMiddleware, async (req, res) => {
      try {
        if (!this.queueService) {
          res.status(404).json({ error: 'Queue service not available' });
          return;
        }

        const status = await this.queueService.getJobStatus(req.params.id);
        res.json(status);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Queue Statistics (Admin)
    this.app.get('/api/queue/stats', authMiddleware, async (req, res) => {
      try {
        if (!this.queueService) {
          res.status(404).json({ error: 'Queue service not available' });
          return;
        }

        const stats = await this.queueService.getQueueStats();
        res.json(stats);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Get all decks (returns empty - client uses in-memory storage)
    this.app.get('/api/decks', async (req, res) => {
      // In-memory storage on client side, server returns empty
      res.json({ decks: [], warning: 'Using client-side storage' });
    });

    // Save a deck (accepts but doesn't persist - client handles storage)
    this.app.post('/api/decks', apiRateLimiter, async (req, res) => {
      // Client-side storage, just acknowledge
      res.json({ success: true, warning: 'Using client-side storage' });
    });

    // Search endpoint for WebLLM (client-side)
    this.app.post('/api/search', async (req, res) => {
      try {
        const { query } = req.body;
        const results = await this.studyService['searchAdapter'].search(query);
        res.json({ success: true, results });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Scrape endpoint for WebLLM (client-side)
    this.app.post('/api/scrape', async (req, res) => {
      try {
        const { urls } = req.body;
        const content = await this.studyService['scrapeMultipleSources'](urls);
        res.json({ success: true, content });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/api/upload', apiRateLimiter, authMiddleware, this.upload.single('file'), async (req, res) => {
      try {
        const file = req.file;
        const topic = req.body.topic || 'General';
        if (!file) throw new Error('No file uploaded');

        const cards = await this.studyService.processFile(
          file.buffer,
          file.originalname,
          file.mimetype,
          topic
        );
        res.json({ success: true, cards });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/api/brief-answer', async (req, res) => {
      try {
        const { question, context } = req.body;
        const answer = await this.studyService.getBriefAnswer(question, context);
        res.json({ success: true, briefAnswer: answer });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Initial flashcards load
    this.app.get('/api/flashcards', async (req, res) => {
      try {
        // Return empty array initially - cards are loaded from history
        res.json({ cards: [] });
      } catch (error: any) {
        console.warn('[API] Failed to get flashcards:', error.message);
        // Return empty array instead of error
        res.json({ cards: [] });
      }
    });

    // Quiz - Unified endpoint for creating quizzes
    this.app.post('/api/quiz', apiRateLimiter, async (req, res) => {
      try {
        const { topic, numQuestions, flashcardIds } = req.body;

        // Route to appropriate quiz creation method
        if (flashcardIds && Array.isArray(flashcardIds)) {
          // Create quiz from flashcards
          if (flashcardIds.length === 0) {
            res.status(400).json({ error: 'flashcardIds array cannot be empty' });
            return;
          }

          const flashcards = this.flashcardStorage?.getFlashcardsByIds(flashcardIds) || [];
          if (flashcards.length === 0) {
            res.status(404).json({ error: 'No flashcards found with provided IDs' });
            return;
          }

          const formattedCards = flashcards.map(fc => ({
            id: fc.id,
            front: fc.front,
            back: fc.back,
            topic: fc.topic
          }));

          const questions = await this.studyService['aiAdapters'].ollama.generateQuizFromFlashcards(
            formattedCards,
            numQuestions || Math.min(flashcards.length, 10)
          );

          const quiz = {
            id: `quiz-${Date.now()}`,
            topic: flashcards[0].topic || 'Quiz',
            questions,
            source: 'flashcards' as const,
            sourceFlashcardIds: flashcardIds,
            createdAt: Date.now()
          };

          if (this.quizStorage) {
            this.quizStorage.storeQuiz(quiz);
            this.flashcardStorage?.markFlashcardsUsedInQuiz(flashcardIds, quiz.id);
          }

          res.json({ quizId: quiz.id, quiz });
        } else if (topic) {
          // Create quiz from topic
          let context = '';
          try {
            const searchResults = await this.studyService['searchAdapter'].search(topic);
            context = searchResults.slice(0, 3).map(r => r.snippet || '').join('\n');
          } catch (error) {
            console.warn('Web search failed, generating quiz without context');
          }

          const questions = await this.studyService.generateQuiz(
            topic,
            numQuestions || 5
          );

          const quiz = {
            id: `quiz-${Date.now()}`,
            topic,
            questions,
            source: 'topic' as const,
            createdAt: Date.now()
          };

          if (this.quizStorage) {
            this.quizStorage.storeQuiz(quiz);
          }

          res.json({ quizId: quiz.id, quiz });
        } else {
          res.status(400).json({ error: 'Either topic or flashcardIds is required' });
        }
      } catch (error: any) {
        console.error('Quiz creation error:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Create quiz from flashcards
    this.app.post('/api/quiz/create-from-flashcards', apiRateLimiter, async (req, res) => {
      try {
        const { flashcardIds, count, options } = req.body;

        if (!flashcardIds || !Array.isArray(flashcardIds) || flashcardIds.length === 0) {
          res.status(400).json({ error: 'flashcardIds array is required' });
          return;
        }

        // Get flashcards from storage
        const flashcards = this.flashcardStorage?.getFlashcardsByIds(flashcardIds) || [];

        if (flashcards.length === 0) {
          res.status(404).json({ error: 'No flashcards found with provided IDs' });
          return;
        }

        // Convert indexed flashcards to the format expected by generateQuizFromFlashcards
        const formattedCards = flashcards.map(fc => ({
          id: fc.id,
          front: fc.front,
          back: fc.back,
          topic: fc.topic
        }));

        // Generate quiz questions using AI
        const questions = await this.studyService['aiAdapters'].ollama.generateQuizFromFlashcards(
          formattedCards,
          count || Math.min(flashcards.length, 10)
        );

        // Create quiz object
        const quiz = {
          id: `quiz-${Date.now()}`,
          topic: flashcards[0].topic || 'Quiz',
          questions,
          source: 'flashcards' as const,
          sourceFlashcardIds: flashcardIds,
          createdAt: Date.now(),
          metadata: options
        };

        // Store quiz
        if (this.quizStorage) {
          this.quizStorage.storeQuiz(quiz);

          // Mark flashcards as used
          this.flashcardStorage?.markFlashcardsUsedInQuiz(flashcardIds, quiz.id);
        }

        res.json({
          success: true,
          quiz: {
            id: quiz.id,
            topic: quiz.topic,
            questionCount: questions.length,
            createdAt: quiz.createdAt
          }
        });
      } catch (error: any) {
        console.error('Failed to create quiz from flashcards:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Create quiz from topic
    this.app.post('/api/quiz/create-from-topic', apiRateLimiter, async (req, res) => {
      try {
        const { topic, count, options } = req.body;

        if (!topic) {
          res.status(400).json({ error: 'topic is required' });
          return;
        }

        // Search for relevant context using web search
        let context = '';
        try {
          const searchResults = await this.studyService['searchAdapter'].search(topic);
          context = searchResults
            .slice(0, 3)
            .map(r => r.snippet || '')
            .join('\n');
        } catch (error) {
          console.warn('Web search failed, generating quiz without context:', error);
        }

        // Generate quiz questions using AI
        const questions = await this.studyService['aiAdapters'].ollama.generateQuizFromTopic(
          topic,
          count || 5,
          context
        );

        // Create quiz object
        const quiz = {
          id: `quiz-${Date.now()}`,
          topic,
          questions,
          source: 'topic' as const,
          createdAt: Date.now(),
          metadata: options
        };

        // Store quiz
        if (this.quizStorage) {
          this.quizStorage.storeQuiz(quiz);
        }

        res.json({
          success: true,
          quiz: {
            id: quiz.id,
            topic: quiz.topic,
            questionCount: questions.length,
            createdAt: quiz.createdAt
          }
        });
      } catch (error: any) {
        console.error('Failed to create quiz from topic:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Get quiz history - MUST come before /api/quiz/:quizId to avoid route collision
    // Duplicate quiz history route removed - now at top before parameterized routes
    this.app.get('/api/quiz/history', async (req, res) => {
      try {
        const quizzes = this.quizStorage?.getAllQuizzes() || [];

        // Attach attempts to each quiz
        const quizzesWithAttempts = quizzes.map(quiz => ({
          ...quiz,
          attempts: this.quizStorage?.getAttempts(quiz.id) || []
        }));

        res.json({ quizzes: quizzesWithAttempts });
      } catch (error: any) {
        console.warn('[API] Failed to get quiz history:', error.message);
        res.status(500).json({ error: error.message });
      }
    });

    // Get specific quiz
    this.app.get('/api/quiz/:quizId', async (req, res) => {
      try {
        const quiz = this.quizStorage?.getQuiz(req.params.quizId);

        if (!quiz) {
          res.status(404).json({ error: 'Quiz not found' });
          return;
        }

        res.json({ success: true, quiz });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Submit quiz answers
    this.app.post('/api/quiz/:id/submit', async (req, res) => {
      try {
        const quizId = req.params.id;
        const { answers } = req.body;

        const quiz = this.quizStorage?.getQuiz(quizId);
        if (!quiz) {
          res.status(404).json({ error: 'Quiz not found' });
          return;
        }

        if (!answers || !Array.isArray(answers)) {
          res.status(400).json({ error: 'answers array is required' });
          return;
        }

        // Calculate score
        let score = 0;
        quiz.questions.forEach((question, index) => {
          if (answers[index] === question.correctAnswer) {
            score++;
          }
        });

        const attempt = {
          id: `attempt-${Date.now()}`,
          quizId,
          answers,  // Keep as array for now
          score,
          total: quiz.questions.length,
          timestamp: Date.now(),
          completedAt: Date.now()
        };

        // Save attempt (casting to avoid type mismatch)
        if (this.quizStorage) {
          this.quizStorage.storeAttempt(attempt as any);
        }

        res.json({
          success: true,
          score,
          totalQuestions: quiz.questions.length,
          percentage: Math.round((score / quiz.questions.length) * 100),
          attempt
        });
      } catch (error: any) {
        console.error('Quiz submit error:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // List all quizzes
    this.app.get('/api/quiz/list/all', async (req, res) => {
      try {
        const quizzes = this.quizStorage?.getAllQuizzes() || [];

        // Return summaries only
        const summaries = quizzes.map(q => ({
          id: q.id,
          topic: q.topic,
          questionCount: q.questions.length,
          source: q.source,
          createdAt: q.createdAt
        }));

        res.json({ success: true, quizzes: summaries });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // List flashcards for selection
    this.app.get('/api/flashcards/list/all', async (req, res) => {
      try {
        const flashcards = this.flashcardStorage?.getAllFlashcards() || [];

        // Group by topic
        const grouped = flashcards.reduce((acc, fc) => {
          if (!acc[fc.topic]) {
            acc[fc.topic] = [];
          }
          acc[fc.topic].push({
            id: fc.id,
            front: fc.front,
            back: fc.back,
            usedInQuizzes: fc.usedInQuizzes
          });
          return acc;
        }, {} as Record<string, any[]>);

        res.json({
          success: true,
          flashcards: grouped,
          topics: Object.keys(grouped)
        });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/api/quiz/generate-advanced', async (req, res) => {
      try {
        const { previousResults, mode } = req.body;
        const quiz = await this.studyService.generateAdvancedQuiz(previousResults, mode);
        res.json({ success: true, quiz });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });



    this.app.post('/api/quiz/history', async (req, res) => {
      try {
        const result = req.body;
        result.timestamp = Date.now();
        result.id = `quiz-${Date.now()}`;
        await this.studyService.saveQuizResult(result);
        res.json({ success: true, id: result.id });
      } catch (error: any) {
        console.warn('[API] Failed to save quiz result:', error.message);
        // Return success anyway - client should handle persistence
        res.json({ success: true, id: `quiz-${Date.now()}`, warning: 'Server-side storage unavailable' });
      }
    });

    // Decks (History)
    this.app.get('/api/decks', async (req, res) => {
      try {
        const history = await this.studyService.getDeckHistory();
        res.json({ history: history || [] });
      } catch (error: any) {
        console.warn('[API] Failed to get deck history:', error.message);
        // Return empty array instead of 500 error for serverless compatibility
        res.json({ history: [], warning: 'Server-side storage unavailable' });
      }
    });

    this.app.post('/api/decks', async (req, res) => {
      try {
        const deck = req.body;
        deck.timestamp = Date.now();
        deck.id = `deck-${Date.now()}`;
        await this.studyService.saveDeck(deck);
        res.json({ success: true, id: deck.id });
      } catch (error: any) {
        console.warn('[API] Failed to save deck:', error.message);
        res.json({ success: true, id: `deck-${Date.now()}`, warning: 'Server-side storage unavailable' });
      }
    });

    // Swipe tracking (optional analytics)
    this.app.post('/api/swipe', async (req, res) => {
      try {
        // Optional: Track swipes for analytics
        // For now, just acknowledge
        res.json({ success: true });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Get all flashcards (returns empty - client uses in-memory storage)
    this.app.get('/api/flashcards', async (req, res) => {
      // In-memory storage on client side, server returns empty
      res.json({ cards: [] });
    });

    // Health check
    this.app.get('/api/health', (req, res) => {
      res.json({
        ollama: true, // In a real app, check connection
        serper: true  // In a real app, check connection
      });
    });

    // Serve index.html for all other routes (SPA)
    // Use middleware instead of wildcard route for Express v5 compatibility
    this.app.use((req, res, next) => {
      // Only serve index.html for non-API routes
      if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
      } else {
        next();
      }
    });
  }

  public getApp(): express.Application {
    return this.app;
  }

  public async start(port: number) {
    // Setup GraphQL (must be done after construction, as it's async)
    await this.setupGraphQL();

    // Setup REST routes (must be after GraphQL to avoid capturing /graphql requests if we had a catch-all)
    this.setupRoutes();

    this.httpServer.listen(port, () => {
      console.log(`Server running on port ${port}`);
      if (this.wss) {
        console.log(`WebSocket server ready at ws://localhost:${port}/api/webllm/ws`);
      }
    });
  }

  public getHttpServer() {
    return this.httpServer;
  }
}
