import dotenv from 'dotenv';
import { StudyService } from './core/services/StudyService.js'; // Corrected path for StudyService
import { OllamaAdapter } from './adapters/secondary/ollama/index.js';
import { SerperAdapter } from './adapters/secondary/serper/index.js';
import { ExpressServer } from './adapters/primary/express/server.js';
import { LoggerService } from './core/services/LoggerService.js'; // Assuming logger is LoggerService
import { QueueService } from './core/services/QueueService.js';
import { FlashcardCacheService } from './core/services/FlashcardCacheService.js';
import { WebLLMService } from './core/services/WebLLMService.js';
import { QuizStorageService } from './core/services/QuizStorageService.js';
import { FlashcardStorageService } from './core/services/FlashcardStorageService.js';
// External services
import { RedisService } from './core/services/RedisService.js';
import { SupabaseService } from './core/services/SupabaseService.js';
import { UpstashVectorService } from './core/services/UpstashVectorService.js';
import { BlobStorageService } from './core/services/BlobStorageService.js';
import { CacheService } from './core/services/CacheService.js'; // Re-added CacheService
import { WebLLMAdapter } from './adapters/secondary/webllm/index.js'; // Re-added WebLLMAdapter
import { FileSystemAdapter } from './adapters/secondary/fs/index.js'; // Re-added FileSystemAdapter
import { MetricsService } from './core/services/MetricsService.js'; // Re-added MetricsService
import { ResilienceService } from './core/services/ResilienceService.js'; // Re-added ResilienceService
import { MCPClientWrapper } from './adapters/secondary/mcp/MCPClientWrapper.js'; // Re-added MCPClientWrapper
import { HybridOllamaAdapter } from './adapters/secondary/ollama/HybridOllamaAdapter.js'; // Re-added HybridOllamaAdapter
import { HybridSerperAdapter } from './adapters/secondary/serper/HybridSerperAdapter.js'; // Re-added HybridSerperAdapter

// Load environment variables (.env locally, Vercel env in production)
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

// 1. Initialize Storage Services
const quizStorage = new QuizStorageService();
const flashcardStorage = new FlashcardStorageService();

console.log('💾 Storage services initialized');


// 2. Initialize MCP Client (Optional with Feature Flag)
async function initializeMCP(): Promise<MCPClientWrapper | null> {
    const useMCP = process.env.USE_MCP_SERVER === 'true';

    if (!useMCP) {
        console.log('🔌 MCP disabled (USE_MCP_SERVER=false)');
        return null;
    }

    try {
        const mcpClient = new MCPClientWrapper();
        await mcpClient.connect();

        const healthy = await mcpClient.healthCheck();
        if (!healthy) {
            console.warn('⚠️  MCP server unhealthy, using direct adapters');
            return null;
        }

        console.log('✅ MCP client connected and healthy');
        return mcpClient;
    } catch (error: any) {
        console.error('❌ MCP initialization failed, using direct adapters:', error.message);
        return null;
    }
}

const mcpClient = await initializeMCP();
const useMCP = mcpClient !== null;

// 3. Initialize Metrics Service
const metricsService = new MetricsService('.metrics');
console.log('📊 Metrics service initialized');

// 4. Initialize AI Adapters (Hybrid with MCP fallback)
const directOllamaAdapter = new OllamaAdapter(llmCache);
const ollamaAdapter = new HybridOllamaAdapter(mcpClient, directOllamaAdapter, useMCP);

// Initialize WebLLM Service first, then adapter
const webllmService = new WebLLMService(llmCache);
const webllmAdapter = new WebLLMAdapter(llmCache, webllmService);
webllmAdapter.setWebLLMService(webllmService);

const aiAdapters = {
    ollama: ollamaAdapter,
    webllm: webllmAdapter
};

console.log(`🤖 AI adapters initialized (MCP: ${useMCP ? 'enabled' : 'disabled'}):`, Object.keys(aiAdapters).join(', '));

// 5. Initialize Other Adapters (Hybrid with MCP fallback)
const directSerperAdapter = new SerperAdapter(serperCache);
const serperAdapter = new HybridSerperAdapter(mcpClient, directSerperAdapter, useMCP);
const fsAdapter = new FileSystemAdapter();

// 5. Initialize Resilience and Queue Services
const logger = new LoggerService();
const resilienceService = new ResilienceService();
const queueService = new QueueService();
const flashcardCache = new FlashcardCacheService(3600); // 1 hour TTL

logger.info('🛡️  Resilience services initialized');
logger.info('🌐 WebLLM service initialized');

// 5. Initialize Core Service with Multiple Adapters and Metrics
const studyService = new StudyService(aiAdapters, serperAdapter, fsAdapter, metricsService);

// 6. Initialize Queue Worker
queueService.initWorker(async (job) => {
    logger.info('Processing job', { jobId: job.id, topic: job.data.topic });

    const result = await studyService.generateFlashcards(
        job.data.topic,
        job.data.count,
        (job.data.mode as 'standard' | 'deep-dive') || 'standard',
        (job.data.knowledgeSource as 'ai-only' | 'web-only' | 'ai-web') || 'ai-web',
        (job.data.runtime as 'ollama' | 'webllm') || 'ollama',
        job.data.parentTopic
    );

    // Store result in cache
    flashcardCache.set(
        job.data.topic,
        job.data.count,
        result,
        job.data.mode,
        job.data.knowledgeSource
    );

    // If deep-dive mode and has recommended topics, queue them proactively
    if (job.data.mode === 'deep-dive' && result.recommendedTopics && result.recommendedTopics.length > 0) {
        logger.info('Queueing recommended topics', { count: result.recommendedTopics.length });

        for (const recommendedTopic of result.recommendedTopics.slice(0, 3)) {
            try {
                await queueService.addGenerateJob({
                    topic: recommendedTopic,
                    count: 5,
                    mode: 'standard',
                    knowledgeSource: job.data.knowledgeSource,
                    runtime: job.data.runtime,
                    parentTopic: job.data.topic
                });
            } catch (err) {
                logger.warn('Failed to queue recommended topic', { topic: recommendedTopic });
            }
        }
    }

    return result;
});

logger.info('⚙️  Queue worker initialized');

// Initialize external services (graceful fallbacks if not available)
// Only initialize on Vercel deployment, skip for local development
const isVercelDeployment = process.env.VERCEL === '1' || process.env.VERCEL_ENV !== undefined;

// Declare external service variables before the conditional block
let redisService: RedisService | null = null;
let supabaseService: SupabaseService | null = null;
let vectorService: UpstashVectorService | null = null;
let blobService: BlobStorageService | null = null;

if (isVercelDeployment) {
    logger.info('🔌 Initializing external services (Vercel deployment detected)...');

    // Redis for distributed caching
    if (process.env.REDIS_URL) {
        try {
            redisService = new RedisService();
            await redisService.connect(process.env.REDIS_URL);
        } catch (error: any) {
            logger.warn('Redis initialization failed, using in-memory cache:', error.message);
        }
    } else {
        logger.info('REDIS_URL not set, using in-memory cache only');
    }

    // Supabase for persistent storage
    if (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) {
        supabaseService = new SupabaseService();
        await supabaseService.initialize();
    } else {
        logger.info('Supabase credentials not set, using in-memory storage only');
    }

    // Upstash Vector for semantic search
    if (process.env.UPSTASH_VECTOR_REST_URL) {
        vectorService = new UpstashVectorService();
        await vectorService.initialize();
    } else {
        logger.info('Upstash Vector credentials not set, semantic search disabled');
    }

    // Vercel Blob for file storage
    if (process.env.BLOB_READ_WRITE_TOKEN) {
        blobService = new BlobStorageService(process.env.BLOB_READ_WRITE_TOKEN);
    } else {
        logger.info('Blob storage token not set, file uploads disabled');
    }

    logger.info('✅ External services initialized');
} else {
    logger.info('💻 Local development mode - using in-memory storage only (external services disabled)');
    logger.info('   External services will be enabled automatically when deployed to Vercel');
}

// Create Express server with all services
const server = new ExpressServer(
    studyService,
    queueService,
    flashcardCache,
    webllmService,
    quizStorage,
    flashcardStorage,
    redisService,
    supabaseService,
    vectorService,
    blobService
);

const PORT = parseInt(process.env.PORT || '3000', 10);
await server.start(PORT);

logger.info(`🚀 Server started on port ${PORT}`);
