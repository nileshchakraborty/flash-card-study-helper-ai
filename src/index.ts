import dotenv from 'dotenv';
import { CacheService } from './core/services/CacheService.js';
import { OllamaAdapter } from './adapters/secondary/ollama/index.js';
import { WebLLMAdapter } from './adapters/secondary/webllm/index.js';
import { SerperAdapter } from './adapters/secondary/serper/index.js';
import { FileSystemAdapter } from './adapters/secondary/fs/index.js';
import { StudyService } from './core/services/StudyService.js';
import { ExpressServer } from './adapters/primary/express/server.js';
import { MetricsService } from './core/services/MetricsService.js';
import { QueueService } from './core/services/QueueService.js';
import { ResilienceService } from './core/services/ResilienceService.js';
import { LoggerService } from './core/services/LoggerService.js';
import { FlashcardCacheService } from './core/services/FlashcardCacheService.js';
import { MCPClientWrapper } from './adapters/secondary/mcp/MCPClientWrapper.js';
import { HybridOllamaAdapter } from './adapters/secondary/ollama/HybridOllamaAdapter.js';
import { HybridSerperAdapter } from './adapters/secondary/serper/HybridSerperAdapter.js';

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
const webllmAdapter = new WebLLMAdapter(llmCache);

const aiAdapters = {
    ollama: ollamaAdapter,
    webllm: webllmAdapter
};

console.log(`🤖 AI adapters initialized (MCP: ${useMCP ? 'enabled' : 'disabled'}):`, Object.keys(aiAdapters).join(', '));

// 5. Initialize Other Adapters (Hybrid with MCP fallback)
const directSerperAdapter = new SerperAdapter(serperCache);
const serperAdapter = new HybridSerperAdapter(mcpClient, directSerperAdapter, useMCP);
const fsAdapter = new FileSystemAdapter();

// 4. Initialize Resilience and Queue Services
const logger = new LoggerService();
const resilienceService = new ResilienceService();
const queueService = new QueueService();
const flashcardCache = new FlashcardCacheService(3600); // 1 hour TTL

logger.info('🛡️  Resilience services initialized');

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

// 7. Initialize Primary Adapter (Server) with Core Service, Queue, and Cache
const server = new ExpressServer(studyService, queueService, flashcardCache);

// 8. Start Application
const PORT = parseInt(process.env.PORT || '3000');
server.start(PORT);

logger.info(`🚀 Server started on port ${PORT}`);
