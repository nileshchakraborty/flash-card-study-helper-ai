import express from 'express';
import * as http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import hpp from 'hpp';
import multer from 'multer';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { WebSocketServer } from 'ws';
import { ApolloServer } from '@apollo/server';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { expressMiddleware as apolloExpressMiddleware } from '@apollo/server/express4';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { AuthService } from '../../../core/services/AuthService.js';
import { apiRateLimiter, authRateLimiter } from './middleware/rateLimit.middleware.js';
import { authMiddleware } from './middleware/auth.middleware.js';
import { requestIdMiddleware, requestLoggingMiddleware } from './middleware/logging.js';
import { asyncHandler } from './middleware/async-handler.js';
import { sendError, sendSuccess, ErrorCodes } from './response-helpers.js';
import { isValidGenerateBody, isValidQuizBody } from './validators.js';
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
import type { LocalDbService } from '../../../core/services/LocalDbService.js';
import type { UpstashVectorService } from '../../../core/services/UpstashVectorService.js';
import type { InMemoryVectorService } from '../../../core/services/InMemoryVectorService.js';
import type { BlobStorageService } from '../../../core/services/BlobStorageService.js';
import { logger } from '../../../core/services/LoggerService.js';
import { appProperties } from '../../../config/properties.js';
import { ensureSupportedFileType } from '../../../utils/fileType.js';

const MAX_UPLOAD_BYTES = appProperties.MAX_UPLOAD_MB * 1024 * 1024;
const MAX_UPLOAD_BYTES_TEST = appProperties.TEST_MAX_UPLOAD_MB * 1024 * 1024;

const isTestAuth = (req: express.Request): boolean =>
  (req.headers['x-test-auth'] === 'true');

export class ExpressServer {
  private app: express.Application;
  private httpServer: http.Server;
  private wss: WebSocketServer | null = null;
  private queueAvailable = true;
  private upload: multer.Multer;
  private uploadChunkStore: Map<string, {
    chunks: Buffer[];
    expected: number;
    received: number;
    mimeType: string;
    filename: string;
    topic: string;
    totalSize: number;
  }>;
  private authService: AuthService;
  private quizStorage: QuizStorageService;
  private flashcardStorage: FlashcardStorageService;
  private apolloServer?: ApolloServer;
  // External services (optional)
  // private _redisService: RedisService | null;
  // private _supabaseService: SupabaseService | null;
  // private _vectorService: UpstashVectorService | null;
  // private _blobService: BlobStorageService | null;

  constructor(
    private studyService: StudyUseCase,
    private queueService: QueueService | null,
    private flashcardCache: FlashcardCacheService,
    private webllmService: WebLLMService,
    quizStorage: QuizStorageService,
    flashcardStorage: FlashcardStorageService,
    _redisService: RedisService | null = null,
    _supabaseService: SupabaseService | LocalDbService | null = null,
    _vectorService: UpstashVectorService | InMemoryVectorService | null = null,
    _blobService: BlobStorageService | null = null
  ) {
    this.app = express();
    this.httpServer = http.createServer(this.app);
    this.uploadChunkStore = new Map();
    this.upload = multer({
      storage: multer.memoryStorage(),
      limits: {
        fileSize: MAX_UPLOAD_BYTES_TEST // cap at highest to allow test header; we validate per-request below
      }
    });
    this.authService = AuthService.getInstance();
    this.quizStorage = quizStorage;
    this.flashcardStorage = flashcardStorage;
    this.studyService = studyService;
    this.queueService = queueService;
    this.flashcardCache = flashcardCache;
    this.webllmService = webllmService;
    // this._redisService = redisService;
    // this._supabaseService = supabaseService;
    // this._vectorService = vectorService;
    // this._blobService = blobService;
    this.setupPassport();
    this.setupMiddleware();
    this.setupWebSocket();
    // Routes are now set up in start() to ensure correct order with GraphQL
  }



  private setupPassport() {
    // Use environment variable if set, otherwise derive from request
    // This allows preview deployments to work correctly
    const configuredCallbackURL = process.env.OAUTH_CALLBACK_URL;

    if (configuredCallbackURL) {
      logger.info('[Passport] Using configured callback URL:', configuredCallbackURL);
    } else {
      logger.info('[Passport] Using dynamic callback URL (derived from request)');
    }

    passport.use(new GoogleStrategy({
      clientID: process.env.GOOGLE_CLIENT_ID || 'mock_client_id',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'mock_client_secret',
      callbackURL: configuredCallbackURL || '/api/auth/google/callback',
      passReqToCallback: false
    }, (_accessToken, _refreshToken, profile, done) => {
      // If using relative path, passport will derive full URL from request
      // This allows preview deployments to work with their own domains
      return done(null, profile);
    }));
  }

  private setupMiddleware() {
    // Trust proxy headers (X-Forwarded-Proto, X-Forwarded-Host) from Vercel/reverse proxies
    // This is critical for OAuth to work behind TLS proxies
    this.app.set('trust proxy', true);

    // Security Headers
    this.app.use(helmet({
      contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false, // Disable strict CSP in dev for Swagger UI/GraphQL Playground
      crossOriginEmbedderPolicy: false // Allow resources to be loaded from other domains (e.g. images)
    }));

    // Parameter Pollution Prevention
    this.app.use(hpp());

    // CORS Configuration
    this.app.use(cors({
      origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
    }));

    // Request ID and Logging (only in non-production for now)
    if (process.env.NODE_ENV !== 'production') {
      this.app.use(requestIdMiddleware);
      this.app.use(requestLoggingMiddleware);
    }

    this.app.use(express.json());
    this.app.use(passport.initialize());
    this.app.use(express.static('public'));

    // Swagger UI - handle gracefully if swagger.yaml doesn't exist
    try {
      const swaggerPath = path.join(process.cwd(), 'swagger.yaml');
      let swaggerDocument;
      try {
        swaggerDocument = YAML.load(swaggerPath);
      } catch (e) {
        // Fallback to json if yaml fails or doesn't exist
        try {
          swaggerDocument = require(path.join(process.cwd(), 'swagger.json'));
        } catch (jsonErr) {
          // Both failed
        }
      }

      if (swaggerDocument) {
        this.app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
        logger.info('📖 Swagger documentation available at /api-docs');
      } else {
        logger.warn('⚠️ Swagger documentation not found (swagger.yaml or swagger.json), /api-docs will be unavailable.');
      }
    } catch (error) {
      console.warn('Swagger documentation setup failed:', error);
    }
  }

  public async setupGraphQL(options: { skipWebSocket?: boolean } = {}) {
    const { skipWebSocket = false } = options;
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

    // Setup WebSocket server for GraphQL subscriptions (skip in test mode)
    if (!skipWebSocket && this.httpServer) {
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
          const connectionParams = (ctx.connectionParams || {}) as Record<string, unknown>;
          const rawAuth = typeof connectionParams.authorization === 'string'
            ? connectionParams.authorization
            : undefined;
          const token = rawAuth?.replace('Bearer ', '');

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
        onConnect: (_ctx) => {
          logger.info('🔌 WebSocket connected');
        },
        onDisconnect: (_ctx) => {
          logger.info('[GraphQL WS] Client disconnected');
        },
      });

      // Handle WebSocket connections
      graphqlWsServer.on('connection', (socket, request) => {
        logger.info('[GraphQL WS] WebSocket connection established for /subscriptions');

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

      logger.info('🚀 GraphQL endpoint available at /graphql');
      logger.info('📡 GraphQL subscriptions available via WebSocket at /subscriptions');
    } else {
      logger.info('🚀 GraphQL endpoint available at /graphql');
      if (skipWebSocket) {
        logger.info('⏭️  GraphQL WebSocket server skipped (test mode)');
      }
    }
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
        } catch (error: unknown) {
          ws.send(JSON.stringify({
            type: 'error',
            error: error instanceof Error ? error.message : 'Unknown error'
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

    // DEV ONLY: Login endpoint for mobile/development
    if (process.env.NODE_ENV !== 'production') {
      this.app.post('/api/auth/dev-login', async (_req, res) => {
        try {
          // Create a mock user for development
          const mockUser = {
            id: 'dev-user-id',
            email: 'dev@mindflip.ai',
            name: 'Dev User'
          };

          const token = await this.authService.encryptToken(mockUser);
          res.json({ success: true, token, user: mockUser });
        } catch (error: any) {
          res.status(500).json({ error: error.message });
        }
      });
    }

    this.app.get('/api/auth/google/callback',
      passport.authenticate('google', { session: false, failureRedirect: '/' }),
      async (req, res) => {
        const user = req.user as { id: string; emails?: { value: string }[]; displayName?: string };
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
    this.app.post('/api/generate', apiRateLimiter, authMiddleware, (req, res) =>
      this.handleGenerate(req, res)
    );

    // Job Status Endpoint
    // Job status endpoint (requires auth; frontend handles 401 by prompting re-login)
    this.app.get('/api/jobs/:id', authMiddleware, asyncHandler(async (req, res) => {
      const requestId = (req as any).requestId;

      if (!this.queueService) {
        return sendError(res, 404, 'Queue service not available', {
          requestId,
          code: ErrorCodes.NOT_FOUND
        });
      }

      const status = await this.queueService.getJobStatus(req.params.id || '');
      return sendSuccess(res, status, { requestId });
    }));

    // Queue Statistics (Admin)
    this.app.get('/api/queue/stats', authMiddleware, asyncHandler(async (req, res) => {
      const requestId = (req as any).requestId;

      if (!this.queueService) {
        return sendError(res, 404, 'Queue service not available', {
          requestId,
          code: ErrorCodes.NOT_FOUND
        });
      }

      const stats = await this.queueService.getQueueStats();
      return sendSuccess(res, stats, { requestId });
    }));

    // Search endpoint for WebLLM (client-side)
    this.app.post('/api/search', async (req, res) => {
      try {
        const { query } = req.body;
        const results = await (this.studyService as any)['searchAdapter'].search(query);
        res.json({ success: true, results });
      } catch (error: unknown) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    // Scrape endpoint for WebLLM (client-side)
    this.app.post('/api/scrape', async (req, res) => {
      try {
        const { urls } = req.body;
        const content = await (this.studyService as any)['scrapeMultipleSources'](urls);
        res.json({ success: true, content });
      } catch (error: unknown) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    this.app.post('/api/upload', apiRateLimiter, authMiddleware, this.upload.single('file'), async (req, res) => {
      const requestId = (req as any).requestId;

      try {
        const file = req.file;
        const topic = (req.body.topic && req.body.topic.trim().length > 0)
          ? req.body.topic.trim()
          : path.parse(file?.originalname || 'Uploaded Content').name || 'Uploaded Content';
        const maxSize = isTestAuth(req) ? MAX_UPLOAD_BYTES_TEST : MAX_UPLOAD_BYTES;

        // Input validation
        if (!file) {
          return sendError(res, 400, 'No file uploaded. Please select a file to upload.', {
            requestId,
            code: ErrorCodes.VALIDATION_ERROR
          });
        }

        if (file.size > maxSize) {
          return sendError(res, 400,
            `File too large. Maximum size is ${(maxSize / 1024 / 1024)}MB. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB.`,
            {
              requestId,
              code: ErrorCodes.FILE_TOO_LARGE
            }
          );
        }

        // Validate topic
        if (typeof topic !== 'string' || topic.trim().length === 0) {
          return sendError(res, 400, 'Topic is required and must be a non-empty string.', {
            requestId,
            code: ErrorCodes.VALIDATION_ERROR
          });
        }

        if (topic.length > 200) {
          return sendError(res, 400, 'Topic is too long. Maximum length is 200 characters.', {
            requestId,
            code: ErrorCodes.VALIDATION_ERROR
          });
        }

        const resolvedMime = ensureSupportedFileType(file.mimetype, file.originalname);

        const cards = await this.studyService.processFile(
          file.buffer,
          file.originalname,
          resolvedMime,
          topic.trim()
        );

        // Ensure we actually generated flashcards
        if (!cards || !Array.isArray(cards) || cards.length === 0) {
          throw new Error('No flashcards generated from the uploaded file. Please try a different file or format.');
        }

        // Persist uploaded cards for later quiz generation
        if (this.flashcardStorage && Array.isArray(cards)) {
          this.flashcardStorage.storeFlashcards(cards as any);
        }

        return sendSuccess(res, { cards }, { requestId });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';

        // Determine error type and code
        const isUnsupportedType = message.includes('Unsupported file type');
        const isExtractionError = message.includes('Unable to extract');
        const isEmptyResult = message.includes('No flashcards generated');

        if (isUnsupportedType) {
          return sendError(res, 400, message, {
            requestId,
            code: ErrorCodes.UNSUPPORTED_FILE_TYPE
          });
        }

        if (isExtractionError) {
          return sendError(res, 400, message, {
            requestId,
            code: ErrorCodes.PROCESSING_ERROR
          });
        }

        if (isEmptyResult) {
          return sendError(res, 422, message, {
            requestId,
            code: ErrorCodes.PROCESSING_ERROR
          });
        }

        return sendError(res, 500, message, {
          requestId,
          code: ErrorCodes.INTERNAL_ERROR
        });
      }
    });

    // Chunked upload endpoint for large files
    this.app.post('/api/upload/chunk', apiRateLimiter, authMiddleware, this.upload.single('chunk'), async (req, res) => {
      const requestId = (req as any).requestId;
      try {
        const uploadId = req.body.uploadId;
        const index = parseInt(req.body.index, 10);
        const total = parseInt(req.body.total, 10);
        const filename = req.body.filename;
        let mimeType = req.body.mimeType;
        const topic = (req.body.topic || 'General').trim();
        const chunk = req.file?.buffer;

        if (!uploadId || Number.isNaN(index) || Number.isNaN(total) || !filename || !mimeType || !chunk) {
          return sendError(res, 400, 'Invalid chunk upload payload.', { requestId, code: ErrorCodes.VALIDATION_ERROR });
        }

        if (total > 100 || total < 1) {
          return sendError(res, 400, 'Invalid total chunk count.', { requestId, code: ErrorCodes.VALIDATION_ERROR });
        }

        // Validate type early
        try {
          mimeType = ensureSupportedFileType(mimeType, filename);
        } catch (err) {
          return sendError(res, 400, 'Unsupported file type', { requestId, code: ErrorCodes.UNSUPPORTED_FILE_TYPE });
        }

        const entry = this.uploadChunkStore.get(uploadId) || {
          chunks: new Array(total).fill(null),
          expected: total,
          received: 0,
          mimeType,
          filename,
          topic,
          totalSize: 0
        };

        entry.chunks[index] = chunk;
        entry.received += 1;
        entry.totalSize += chunk.length;
        this.uploadChunkStore.set(uploadId, entry);

        // Enforce 30MB aggregate cap
        const maxTotal = isTestAuth(req) ? MAX_UPLOAD_BYTES_TEST : MAX_UPLOAD_BYTES;
        if (entry.totalSize > maxTotal) {
          this.uploadChunkStore.delete(uploadId);
          return sendError(res, 400, `File too large. Maximum size is ${(maxTotal / 1024 / 1024)}MB.`, { requestId, code: ErrorCodes.FILE_TOO_LARGE });
        }

        // If not all chunks are in, acknowledge partial
        if (entry.received < entry.expected) {
          return sendSuccess(res, { status: 'partial', received: entry.received, expected: entry.expected }, { requestId });
        }

        // All chunks received: merge and process
        const merged = Buffer.concat(entry.chunks.filter(Boolean) as Buffer[]);
        this.uploadChunkStore.delete(uploadId);

        const cards = await this.studyService.processFile(
          merged,
          filename,
          mimeType,
          topic
        );

        if (this.flashcardStorage && Array.isArray(cards)) {
          this.flashcardStorage.storeFlashcards(cards as any);
        }

        return sendSuccess(res, { cards }, { requestId });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return sendError(res, 500, message, { requestId, code: ErrorCodes.INTERNAL_ERROR });
      }
    });

    // Multer error handling middleware (must be right after the upload route)
    this.app.use('/api/upload', (error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      const requestId = (req as any).requestId;

      // Handle Multer-specific errors
      if (error.name === 'MulterError') {
        if (error.code === 'LIMIT_FILE_SIZE') {
          return sendError(res, 400, 'File too large. Maximum size is 10MB.', {
            requestId,
            code: ErrorCodes.FILE_TOO_LARGE
          });
        }
        if (error.code === 'LIMIT_FILE_COUNT') {
          return sendError(res, 400, 'Too many files. Only one file allowed.', {
            requestId,
            code: ErrorCodes.VALIDATION_ERROR
          });
        }
        if (error.code === 'LIMIT_UNEXPECTED_FILE') {
          return sendError(res, 400, 'Unexpected field name. Use "file" as the field name.', {
            requestId,
            code: ErrorCodes.VALIDATION_ERROR
          });
        }

        return sendError(res, 400, `File upload error: ${error.message}`, {
          requestId,
          code: ErrorCodes.VALIDATION_ERROR
        });
      }

      // Pass non-Multer errors to the global error handler
      next(error);
    });

    // Endpoint for generating from raw content (Text or URLs)
    this.app.post('/api/generate/from-content', apiRateLimiter, authMiddleware, async (req, res) => {
      try {
        const { type, content, topic } = req.body;
        let cards: any[] = [];

        if (type === 'text' && typeof content === 'string') {
          cards = await this.studyService.processRawText(content, topic || 'Text Content');
        } else if (type === 'url' && Array.isArray(content)) {
          cards = await this.studyService.processUrls(content, topic || 'Web Content');
        } else {
          throw new Error('Invalid content type or format');
        }

        if (this.flashcardStorage && Array.isArray(cards)) {
          this.flashcardStorage.storeFlashcards(cards as any);
        }

        res.json({ success: true, cards });
      } catch (error: unknown) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    this.app.post('/api/brief-answer', async (req, res) => {
      try {
        const { question, context } = req.body;
        const answer = await this.studyService.getBriefAnswer(question, context);
        res.json({ success: true, briefAnswer: answer });
      } catch (error: unknown) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    // Initial flashcards load
    this.app.get('/api/flashcards', async (_req, res) => {
      try {
        // Return empty array initially - cards are loaded from history
        res.json({ cards: [] });
      } catch (error: any) {
        console.warn('[API] Failed to get flashcards:', error.message);
        // Return empty array instead of error
        res.json({ cards: [], warning: 'Flashcards unavailable' });
      }
    });

    // Quiz - Unified endpoint for creating quizzes
    this.app.post('/api/quiz', apiRateLimiter, async (req, res) => {
      const requestId = (req as any).requestId;

      try {
        const { topic, numQuestions, count, flashcardIds, cards } = req.body;
        if (!isValidQuizBody(req.body)) {
          return sendError(res, 400, 'Either topic or flashcardIds is required', {
            requestId,
            code: ErrorCodes.VALIDATION_ERROR
          });
        }
        const desiredCount = numQuestions ?? count;

        // Route to appropriate quiz creation method
        if (cards && Array.isArray(cards) && cards.length > 0) {
          const questions = await this.studyService.generateQuiz(
            topic || cards[0].topic || 'Quiz',
            desiredCount || Math.min(cards.length, 10),
            cards
          );

          const quiz = {
            id: `quiz-${Date.now()}`,
            topic: topic || cards[0].topic || 'Quiz',
            questions,
            source: 'flashcards' as const,
            createdAt: Date.now()
          };

          if (this.quizStorage) this.quizStorage.storeQuiz(quiz as any);

          return sendSuccess(res, { questions, quizId: quiz.id, quiz }, { requestId });
        } else if (flashcardIds && Array.isArray(flashcardIds)) {
          // Create quiz from flashcards
          if (flashcardIds.length === 0) {
            return sendError(res, 400, 'flashcardIds array cannot be empty', {
              requestId,
              code: ErrorCodes.VALIDATION_ERROR
            });
          }

          const flashcards = this.flashcardStorage?.getFlashcardsByIds(flashcardIds) || [];
          if (flashcards.length === 0) {
            return sendError(res, 404, 'No flashcards found with provided IDs', {
              requestId,
              code: ErrorCodes.NOT_FOUND
            });
          }

          const formattedCards = flashcards.map(fc => ({
            id: fc.id,
            front: fc.front,
            back: fc.back,
            topic: fc.topic
          }));

          const questions = await this.studyService.generateQuiz(
            flashcards[0]?.topic || topic || 'Quiz',
            desiredCount || Math.min(flashcards.length, 10),
            formattedCards
          );

          const quiz = {
            id: `quiz-${Date.now()}`,
            topic: flashcards[0]?.topic || 'Quiz',
            questions,
            source: 'flashcards' as const,
            sourceFlashcardIds: flashcardIds,
            createdAt: Date.now()
          };

          if (this.quizStorage) this.quizStorage.storeQuiz(quiz as any);

          return sendSuccess(res, { questions, quizId: quiz.id, quiz }, { requestId });
        } else if (topic) {
          // Create quiz from topic
          // let context = '';
          try {
            await (this.studyService as any)['searchAdapter'].search(topic);
            // context = searchResults.slice(0, 3).map((r: any) => r.snippet || '').join('\n');
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
            this.quizStorage.storeQuiz(quiz as any);
          }

          res.json({ questions, quizId: quiz.id, quiz });
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
        const { flashcardIds, flashcards: payloadFlashcards, count, numQuestions, options } = req.body;
        const desiredCount = numQuestions ?? count;

        if ((!flashcardIds || !Array.isArray(flashcardIds) || flashcardIds.length === 0) && (!payloadFlashcards || !Array.isArray(payloadFlashcards))) {
          res.status(400).json({ error: 'flashcardIds array or flashcards payload is required' });
          return;
        }

        // Get flashcards from storage first
        let flashcards = this.flashcardStorage?.getFlashcardsByIds(flashcardIds || []) || [];

        // Fallback: use payload flashcards if storage is empty (e.g., stateless server)
        if (flashcards.length === 0 && payloadFlashcards && Array.isArray(payloadFlashcards)) {
          const normalized = payloadFlashcards.map((fc: any) => ({
            id: fc.id,
            front: fc.front,
            back: fc.back,
            topic: fc.topic || 'Quiz'
          }));
          // Cache them for future requests (adds missing fields internally)
          this.flashcardStorage?.storeFlashcards(normalized as any);
          flashcards = this.flashcardStorage?.getFlashcardsByIds(normalized.map(n => n.id)) || normalized;
        }

        if (flashcards.length === 0) {
          res.status(404).json({ error: 'No flashcards found with provided data' });
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
        const questions = await this.studyService.generateQuiz(
          flashcards[0]?.topic || 'Quiz',
          desiredCount || Math.min(flashcards.length, 10),
          formattedCards
        );

        // Create quiz object
        const quiz = {
          id: `quiz-${Date.now()}`,
          topic: flashcards[0]?.topic || 'Quiz',
          questions,
          source: 'flashcards' as const,
          sourceFlashcardIds: flashcardIds,
          createdAt: Date.now(),
          metadata: options
        };

        // Store quiz
        if (this.quizStorage) {
          this.quizStorage.storeQuiz(quiz as any);

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
        // let context = '';
        try {
          await (this.studyService as any)['searchAdapter'].search(topic);
          // context = searchResults
          //   .slice(0, 3)
          //   .map((r: any) => r.snippet || '')
          //   .join('\n');
        } catch (error) {
          console.warn('Web search failed, generating quiz without context:', error);
        }

        // Generate quiz questions using AI
        const questions = await this.studyService.generateQuiz(
          topic,
          count || 5
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
          this.quizStorage.storeQuiz(quiz as any);
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
    this.app.get('/api/quiz/history', async (_req, res) => {
      try {
        const quizzes = this.quizStorage?.getAllQuizzes() || [];

        // Attach attempts to each quiz
        const quizzesWithAttempts = quizzes.map(quiz => ({
          ...quiz,
          attempts: this.quizStorage?.getAttempts(quiz.id) || []
        }));

        res.json({ quizzes: quizzesWithAttempts });
      } catch (error: any) {
        console.warn('[API] Failed to get quiz history, returning empty array:', error.message);
        res.json({ quizzes: [], warning: 'history unavailable' });
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

        // Shuffle options for each question to ensure variety on retry
        const shuffledQuestions = quiz.questions.map(q => {
          // Create a copy of options and shuffle them
          const shuffledOptions = [...q.options].sort(() => Math.random() - 0.5);
          return {
            ...q,
            options: shuffledOptions
          };
        });

        res.json({
          success: true,
          quiz: {
            ...quiz,
            questions: shuffledQuestions
          }
        });
      } catch (error: unknown) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
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
    this.app.get('/api/quiz/list/all', async (_req, res) => {
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
      } catch (error: unknown) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    // Get recommendations for a topic
    this.app.get('/api/recommendations/:topic', async (req, res) => {
      try {
        const topic = decodeURIComponent(req.params.topic);

        // Check if we have a webContextCache on the studyService
        const cacheKey = `recommendations:${topic}`;
        const cached = (this.studyService as any).webContextCache?.get(cacheKey);

        if (cached) {
          const recommendations = JSON.parse(cached);
          res.json({
            success: true,
            topic,
            recommendedQuizzes: recommendations.recommendedQuizzes || [],
            recommendedLearning: recommendations.recommendedLearning || []
          });
        } else {
          // Not yet generated
          res.json({
            success: true,
            topic,
            recommendedQuizzes: [],
            recommendedLearning: [],
            pending: true
          });
        }
      } catch (error: unknown) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    // Force refresh recommendations for a topic
    this.app.post('/api/recommendations/refresh/:topic', async (req, res) => {
      try {
        const topic = decodeURIComponent(req.params.topic);

        // Trigger async generation (fire-and-forget)
        (this.studyService as any).generateRecommendationsAsync(topic).catch((err: Error) => {
          console.warn(`[Server] Recommendation refresh failed for ${topic}:`, err.message);
        });

        res.json({ success: true, message: 'Recommendation generation triggered', topic });
      } catch (error: unknown) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    // List flashcards for selection
    this.app.get('/api/flashcards/list/all', async (_req, res) => {
      try {
        const flashcards = this.flashcardStorage?.getAllFlashcards() || [];

        // Group by topic
        const grouped = flashcards.reduce((acc, fc) => {
          if (!acc[fc.topic]) {
            acc[fc.topic] = [];
          }
          const topicList = acc[fc.topic] || [];
          topicList.push({
            id: fc.id,
            front: fc.front,
            back: fc.back,
            topic: fc.topic
          });
          acc[fc.topic] = topicList;
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
      logger.info('[Server] POST /api/quiz/generate-advanced received');
      logger.info('[Server] Body:', JSON.stringify(req.body, null, 2));

      try {
        const { previousResults, mode } = req.body;
        logger.info(`[Server] Generating advanced quiz - mode: ${mode}, topic: ${previousResults?.topic}`);

        const quiz = await this.studyService.generateAdvancedQuiz(previousResults, mode);
        logger.info(`[Server] Advanced quiz generated: ${quiz.length} questions`);

        res.json({ success: true, quiz });
      } catch (error: any) {
        console.error('[Server] Advanced quiz error:', error);
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

    // Ensure no placeholder deck routes were registered earlier (cleanup stub routes)
    const dropRoute = (method: string, path: string) => {
      const stack = (this.app as any)?._router?.stack;
      if (!stack) return;
      (this.app as any)._router.stack = stack.filter((layer: any) => {
        return !(layer?.route?.path === path && layer?.route?.methods?.[method]);
      });
    };

    dropRoute('get', '/api/decks');
    dropRoute('post', '/api/decks');

    // Decks (History)
    this.app.get('/api/decks', async (_req, res) => {
      try {
        const history = await this.studyService.getDeckHistory();
        res.json({ history: history || [] });
      } catch (error: any) {
        console.warn('[API] Failed to get deck history:', error.message);
        // Return empty array instead of 500 error for serverless compatibility
        res.json({ history: [], warning: 'Server-side storage unavailable' });
      }
    });

    this.app.get('/api/decks/:id', async (req, res) => {
      try {
        const deck = await this.studyService.getDeck(req.params.id);
        if (!deck) {
          res.status(404).json({ error: 'Deck not found' });
          return;
        }
        res.json(deck);
      } catch (error: any) {
        console.warn('[API] Failed to get deck:', error.message);
        res.status(500).json({ error: error.message });
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
    this.app.post('/api/swipe', async (_req, res) => {
      try {
        // Optional: Track swipes for analytics
        // For now, just acknowledge
        res.json({ success: true });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Get all flashcards (returns empty - client uses in-memory storage)
    this.app.get('/api/flashcards', async (_req, res) => {
      // In-memory storage on client side, server returns empty
      res.json({ cards: [] });
    });

    // Health check
    this.app.get('/api/health', async (_req, res) => {
      const startTime = Date.now();

      try {
        // Check file processing libraries
        const libraryChecks = {
          pdfParse: await this.checkLibrary('pdf-parse'),
          mammoth: await this.checkLibrary('mammoth'),
          xlsx: await this.checkLibrary('xlsx'),
          tesseract: await this.checkLibrary('tesseract.js')
        };

        // Supported file formats
        const supportedFormats = {
          documents: ['PDF', 'DOCX', 'DOC', 'TXT'],
          spreadsheets: ['XLS', 'XLSX'],
          images: ['PNG', 'JPEG', 'JPG', 'GIF', 'WEBP']
        };

        // Service status
        const services = {
          studyService: !!this.studyService,
          queueService: !!this.queueService && this.queueAvailable,
          flashcardCache: !!this.flashcardCache,
          flashcardStorage: !!this.flashcardStorage,
          quizStorage: !!this.quizStorage,
          webLLMService: !!this.webllmService
        };

        // Environment info
        const environment = {
          nodeEnv: process.env.NODE_ENV || 'development',
          nodeVersion: process.version,
          platform: process.platform,
          uptime: process.uptime()
        };

        const responseTime = Date.now() - startTime;

        res.json({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          responseTime: `${responseTime}ms`,
          version: process.env.npm_package_version || '1.0.0',
          services,
          fileProcessing: {
            libraries: libraryChecks,
            supportedFormats
          },
          environment
        });
      } catch (error) {
        const responseTime = Date.now() - startTime;
        res.status(503).json({
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          responseTime: `${responseTime}ms`,
          error: error instanceof Error ? error.message : 'Health check failed'
        });
      }
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

    // Global error handler (must be last)
    this.app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
      const requestId = (req as any).requestId;
      logger.error('🔥 Unhandled Server Error', {
        requestId,
        path: req.path,
        method: req.method,
        error: err?.message,
        stack: err?.stack
      });

      // Avoid leaking stack traces to clients
      sendError(res, 500, 'Internal server error. Please try again later.', {
        requestId,
        code: ErrorCodes.INTERNAL_ERROR
      });
    });
  }

  /**
   * Check if a library is available
   */
  private async checkLibrary(libraryName: string): Promise<boolean> {
    try {
      await import(libraryName);
      return true;
    } catch {
      return false;
    }
  }

  private async handleGenerate(req: express.Request, res: express.Response) {
    const requestId = (req as any).requestId;

    try {
      const { topic, count, mode, knowledgeSource, runtime, parentTopic } = req.body;
      if (!isValidGenerateBody(req.body)) {
        return sendError(res, 400, 'topic is required', {
          requestId,
          code: ErrorCodes.VALIDATION_ERROR
        });
      }
      const desiredCount = Math.max(1, parseInt(count || '10', 10));

      // Check cache first
      if (this.flashcardCache) {
        const cachedResult = await this.flashcardCache.get(
          topic,
          desiredCount,
          mode,
          knowledgeSource
        );

        if (cachedResult) {
          return res.json({
            success: true,
            cached: true,
            ...cachedResult
          });
        }
      }

      let jobId: string | null = null;

      // If queue is available, try to offload to background job
      if (this.queueService && this.queueAvailable) {
        try {
          jobId = await this.queueService.addGenerateJob({
            topic,
            count: desiredCount,
            mode,
            knowledgeSource: knowledgeSource || 'ai-web',
            runtime: runtime || 'ollama',
            parentTopic,
            userId: (req as { user?: { id?: string } }).user?.id
          });

          res.status(202).json({ jobId, status: 'queued' });
          return;
        } catch (error: unknown) {
          this.queueAvailable = false;
          const message = error instanceof Error ? error.message : 'Unknown error';
          console.warn('[Queue] enqueue failed, falling back to sync generation', { message });
        }
      }

      // Fallback to synchronous generation
      const result = await this.studyService.generateFlashcards(
        topic,
        desiredCount,
        mode,
        knowledgeSource || 'ai-web',
        runtime || 'ollama',
        parentTopic
      );

      return res.json({
        success: true,
        cards: result.cards,
        recommendedTopics: result.recommendedTopics,
        metadata: {
          runtime: runtime || 'ollama',
          knowledgeSource: knowledgeSource || 'ai-web',
          timestamp: Date.now()
        }
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return sendError(res, 500, message, {
        requestId,
        code: ErrorCodes.INTERNAL_ERROR
      });
    }
  }

  public getApp(): express.Application {
    return this.app;
  }

  public async start(port: number) {
    // Setup GraphQL (must be done after construction, as it's async)
    await this.setupGraphQL();

    // Setup REST routes (must be after GraphQL to avoid capturing /graphql requests if we had a catch-all)
    this.setupRoutes();

    // Global error handler (must be last)
    this.app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      console.error('🔥 Unhandled Server Error:', err);
      res.status(500).json({
        error: 'Internal Server Error',
        message: err.message || 'Unknown error',
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
      });
    });

    this.httpServer.listen(port, () => {
      logger.info(`Server running on port ${port}`);
      if (this.wss) {
        logger.info(`WebSocket server ready at ws://localhost:${port}/api/webllm/ws`);
      }
    });
  }

  public getHttpServer() {
    return this.httpServer;
  }
}
