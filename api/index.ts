import dotenv from 'dotenv';
import { OllamaAdapter } from '../src/adapters/secondary/ollama/index.js';
import { WebLLMAdapter } from '../src/adapters/secondary/webllm/index.js';
import { SerperAdapter } from '../src/adapters/secondary/serper/index.js';
import { FileSystemAdapter } from '../src/adapters/secondary/fs/index.js';
import { StudyService } from '../src/core/services/StudyService.js';
import { MetricsService } from '../src/core/services/MetricsService.js';
import { ExpressServer } from '../src/adapters/primary/express/server.js';
import { CacheService } from '../src/core/services/CacheService.js';

dotenv.config();

// Initialize Cache Services (lightweight for serverless)
const serperCache = new CacheService({ ttlSeconds: 3600, maxEntries: 50 });
const llmCache = new CacheService({ ttlSeconds: 86400, maxEntries: 100 });

// Initialize Metrics Service
const metricsService = new MetricsService('/tmp/.metrics'); // Use /tmp for serverless

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

// Initialize Primary Adapter (Server) with Core Service
const expressServer = new ExpressServer(studyService);

// Export the Express app for Vercel
export default expressServer.getApp();
