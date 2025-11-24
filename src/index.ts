import dotenv from 'dotenv';
import { OllamaAdapter } from './adapters/secondary/ollama/index.js';
import { WebLLMAdapter } from './adapters/secondary/webllm/index.js';
import { SerperAdapter } from './adapters/secondary/serper/index.js';
import { FileSystemAdapter } from './adapters/secondary/fs/index.js';
import { StudyService } from './core/services/StudyService.js';
import { MetricsService } from './core/services/MetricsService.js';
import { ExpressServer } from './adapters/primary/express/server.js';
import { CacheService } from './core/services/CacheService.js';

dotenv.config();

// 0. Initialize Cache Services
const serperCache = new CacheService({
    ttlSeconds: parseInt(process.env.CACHE_SERPER_TTL_SECONDS || '3600'),
    maxEntries: parseInt(process.env.CACHE_SERPER_MAX_ENTRIES || '100')
});

const llmCache = new CacheService({
    ttlSeconds: parseInt(process.env.CACHE_LLM_TTL_SECONDS || '86400'),
    maxEntries: parseInt(process.env.CACHE_LLM_MAX_ENTRIES || '500')
});

console.log('🗂️  Cache initialized:', {
    serper: { ttl: `${process.env.CACHE_SERPER_TTL_SECONDS || '3600'}s`, max: process.env.CACHE_SERPER_MAX_ENTRIES || '100' },
    llm: { ttl: `${process.env.CACHE_LLM_TTL_SECONDS || '86400'}s`, max: process.env.CACHE_LLM_MAX_ENTRIES || '500' }
});

// 1. Initialize Metrics Service
const metricsService = new MetricsService('.metrics');
console.log('📊 Metrics service initialized');

// 2. Initialize AI Adapters (both Ollama and WebLLM)
const ollamaAdapter = new OllamaAdapter(llmCache);
const webllmAdapter = new WebLLMAdapter(llmCache);

const aiAdapters = {
    ollama: ollamaAdapter,
    webllm: webllmAdapter
};

console.log('🤖 AI adapters initialized:', Object.keys(aiAdapters).join(', '));

// 3. Initialize Other Adapters
const serperAdapter = new SerperAdapter(serperCache);
const fsAdapter = new FileSystemAdapter();

// 4. Initialize Core Service with Multiple Adapters and Metrics
const studyService = new StudyService(aiAdapters, serperAdapter, fsAdapter, metricsService);

// 5. Initialize Primary Adapter (Server) with Core Service
const server = new ExpressServer(studyService);

// 6. Start Application
const PORT = parseInt(process.env.PORT || '3000');
server.start(PORT);
