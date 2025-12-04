import dotenv from 'dotenv';
import { OllamaAdapter } from '../src/adapters/secondary/ollama/index.js';
import { WebLLMAdapter } from '../src/adapters/secondary/webllm/index.js';
import { SerperAdapter } from '../src/adapters/secondary/serper/index.js';
import { FileSystemAdapter } from '../src/adapters/secondary/fs/index.js';
import { StudyService } from '../src/core/services/StudyService.js';
import { MetricsService } from '../src/core/services/MetricsService.js';
import { ExpressServer } from '../src/adapters/primary/express/server.js';
import { CacheService } from '../src/core/services/CacheService.js';
import { QueueService } from '../src/core/services/QueueService.js';
import { FlashcardCacheService } from '../src/core/services/FlashcardCacheService.js';
import { WebLLMService } from '../src/core/services/WebLLMService.js';
import { QuizStorageService } from '../src/core/services/QuizStorageService.js';
import { FlashcardStorageService } from '../src/core/services/FlashcardStorageService.js';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import path from 'path';

dotenv.config();

// Initialize Cache Services (lightweight for serverless)
const serperCache = new CacheService({ ttlSeconds: 3600, maxEntries: 50 });
const llmCache = new CacheService({ ttlSeconds: 86400, maxEntries: 100 });
const swaggerSpec = YAML.load(path.join(process.cwd(), 'swagger.yaml'));

// Initialize Metrics Service
const metricsService = new MetricsService('/tmp/.metrics'); // Use /tmp for serverless

// Storage and caches (lightweight, in-memory for serverless)
const quizStorage = new QuizStorageService();
const flashcardStorage = new FlashcardStorageService();
const queueService = new QueueService();
const flashcardCache = new FlashcardCacheService(3600);
const webllmService = new WebLLMService(llmCache);

// Initialize AI Adapters
const aiAdapters = {
    ollama: new OllamaAdapter(llmCache),
    webllm: new WebLLMAdapter(llmCache)
};

// Initialize Other Adapters
const serperAdapter = new SerperAdapter(serperCache);
const fsAdapter = new FileSystemAdapter();

// Initialize Core Service with Multiple Adapters and Metrics
const studyService = new StudyService(aiAdapters, serperAdapter, fsAdapter, metricsService);

// Initialize Primary Adapter (Server) with Core Service and required services
const expressServer = new ExpressServer(
    studyService,
    queueService,
    flashcardCache,
    webllmService,
    quizStorage,
    flashcardStorage
);

// Setup GraphQL and REST routes (no http listen in serverless)
await expressServer.setupGraphQL({ skipWebSocket: true });
expressServer.setupRoutes();

const app = expressServer.getApp().use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Export the Express app for Vercel
export default app;
