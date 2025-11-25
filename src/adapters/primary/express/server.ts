import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { AuthService } from '../../../core/services/AuthService.js';
import { apiRateLimiter, authRateLimiter } from './middleware/rateLimit.middleware.js';
import { authenticate } from './middleware/auth.middleware.js';
import type { StudyUseCase } from '../../../core/ports/interfaces.js';
import type { QueueService } from '../../../core/services/QueueService.js';
import type { FlashcardCacheService } from '../../../core/services/FlashcardCacheService.js';

export class ExpressServer {
  private app: express.Application;
  private upload: multer.Multer;
  private authService: AuthService;

  constructor(
    private studyService: StudyUseCase,
    private queueService?: QueueService,
    private flashcardCache?: FlashcardCacheService
  ) {
    this.app = express();
    this.upload = multer({ storage: multer.memoryStorage() });
    this.authService = new AuthService();
    this.setupPassport();
    this.setupMiddleware();
    this.setupRoutes();
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

    // Swagger UI
    const swaggerDocument = YAML.load(path.join(process.cwd(), 'swagger.yaml'));
    this.app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  }

  private setupRoutes() {
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
    this.app.post('/api/generate', apiRateLimiter, authenticate, async (req, res) => {
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
    this.app.get('/api/jobs/:id', authenticate, async (req, res) => {
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
    this.app.get('/api/queue/stats', authenticate, async (req, res) => {
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

    this.app.post('/api/upload', apiRateLimiter, authenticate, this.upload.single('file'), async (req, res) => {
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
        res.status(500).json({ error: error.message });
      }
    });

    // Quiz
    this.app.post('/api/quiz', apiRateLimiter, authenticate, async (req, res) => {
      try {
        const { cards, topic } = req.body;
        // Generate quiz questions from provided cards
        const questions = cards.slice(0, Math.min(cards.length, 10)).map((card: any, index: number) => ({
          id: `q${index + 1}`,
          cardId: card.id,
          question: card.front,
          correctAnswer: card.back,
          options: [card.back] // In real app, would generate distractors
        }));
        res.json({ questions });
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

    this.app.get('/api/quiz/history', async (req, res) => {
      try {
        const history = await this.studyService.getQuizHistory();
        res.json({ history });
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
        res.status(500).json({ error: error.message });
      }
    });

    // Decks (History)
    this.app.get('/api/decks', async (req, res) => {
      try {
        const history = await this.studyService.getDeckHistory();
        res.json({ history });
      } catch (error: any) {
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
        res.status(500).json({ error: error.message });
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

  public start(port: number) {
    this.app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  }
}
