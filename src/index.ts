import dotenv from 'dotenv';
import { OllamaAdapter } from './adapters/secondary/ollama/index.js';
import { SerperAdapter } from './adapters/secondary/serper/index.js';
import { FileSystemAdapter } from './adapters/secondary/fs/index.js';
import { StudyService } from './core/services/StudyService.js';
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

// 1. Initialize Adapters with Cache
const ollamaAdapter = new OllamaAdapter(llmCache);
const serperAdapter = new SerperAdapter(serperCache);
const fsAdapter = new FileSystemAdapter();

// 2. Initialize Core Service with Adapters
const studyService = new StudyService(ollamaAdapter, serperAdapter, fsAdapter);

// 3. Initialize Primary Adapter (Server) with Core Service
const server = new ExpressServer(studyService);

// 4. Start Application
const PORT = parseInt(process.env.PORT || '3000');
server.start(PORT);
