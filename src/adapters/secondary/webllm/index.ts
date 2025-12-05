/**
 * WebLLMAdapter - Backend adapter for browser-based WebLLM
 * 
 * This adapter coordinates with WebLLMService which manages WebSocket sessions.
 * Actual WebLLM execution happens client-side via WebSocket, but business logic
 * and orchestration is handled by the backend service.
 */

import type { AIServicePort } from '../../../core/ports/interfaces.js';
import type { Flashcard, QuizQuestion } from '../../../core/domain/models.js';
import type { CacheService } from '../../../core/services/CacheService.js';
import type { WebLLMService } from '../../../core/services/WebLLMService.js';
import type { LLMAdapter } from '../../../core/services/AdapterManager.js';

export class WebLLMAdapter implements AIServicePort, LLMAdapter {
    readonly name = 'webllm';

    async isAvailable(): Promise<boolean> {
        // WebLLM is always "available" as it runs client-side in the browser
        // Actual availability is determined at runtime by the frontend
        return true;
    }

    private cache?: CacheService<any>;
    // private _webllmService?: WebLLMService;

    constructor(cache?: CacheService<any>, _webllmService?: WebLLMService) {
        this.cache = cache;
        // this._webllmService = webllmService;
        console.log('🌐 WebLLMAdapter initialized (WebSocket-based)');
    }

    /**
     * Set WebLLM service (injected after service creation)
     */
    setWebLLMService(_service: WebLLMService): void {
        // this._webllmService = service;
    }

    /**
     * Generate flashcards via WebLLM service
     * Note: This requires a WebSocket session to be established first
     */
    async generateFlashcards(topic: string, count: number): Promise<Flashcard[]> {
        // Check cache
        const cacheKey = `webllm:flashcards:${topic}:${count}`;
        if (this.cache) {
            const cached = this.cache.get(cacheKey);
            if (cached !== undefined) {
                console.log(`✅ WebLLM cache hit: ${cacheKey}`);
                return cached;
            }
        }

        // WebLLM generation happens via WebSocket
        // This method is kept for interface compatibility
        // Actual generation should use WebLLMService.createSession() and WebSocket
        throw new Error('WebLLM generation requires WebSocket session. Use /api/webllm/session endpoint first.');
    }

    async generateFlashcardsFromText(text: string, topic: string, count: number, _pageInfo?: any): Promise<Flashcard[]> {
        const crypto = await import('crypto');
        const textHash = crypto.createHash('sha256').update(text.substring(0, 10000)).digest('hex').substring(0, 16);
        const cacheKey = `webllm:flashcards-text:${textHash}:${topic}:${count}`;

        if (this.cache) {
            const cached = this.cache.get(cacheKey);
            if (cached !== undefined) return cached;
        }

        throw new Error('WebLLM generation requires WebSocket session. Use /api/webllm/session endpoint first.');
    }

    async generateBriefAnswer(question: string, _context: string): Promise<string> {
        const cacheKey = `webllm:brief:${question.substring(0, 50)}`;
        if (this.cache) {
            const cached = this.cache.get(cacheKey);
            if (cached !== undefined) return cached;
        }

        throw new Error('WebLLM generation requires WebSocket session. Use /api/webllm/session endpoint first.');
    }

    async generateSummary(topic: string): Promise<string> {
        const cacheKey = `webllm:summary:${topic}`;
        if (this.cache) {
            const cached = this.cache.get(cacheKey);
            if (cached !== undefined) return cached;
        }

        throw new Error('WebLLM generation requires WebSocket session. Use /api/webllm/session endpoint first.');
    }

    async generateSearchQuery(topic: string, parentTopic?: string): Promise<string> {
        const cacheKey = `webllm:query:${topic}:${parentTopic || ''}`;
        if (this.cache) {
            const cached = this.cache.get(cacheKey);
            if (cached !== undefined) return cached;
        }

        throw new Error('WebLLM generation requires WebSocket session. Use /api/webllm/session endpoint first.');
    }

    async generateSubTopics(topic: string): Promise<string[]> {
        const cacheKey = `webllm:subtopics:${topic}`;
        if (this.cache) {
            const cached = this.cache.get(cacheKey);
            if (cached !== undefined) return cached;
        }

        throw new Error('WebLLM generation requires WebSocket session. Use /api/webllm/session endpoint first.');
    }

    async generateQuizFromFlashcards(_flashcards: Flashcard[], _count: number): Promise<QuizQuestion[]> {
        throw new Error('WebLLM generation requires WebSocket session. Use /api/webllm/session endpoint first.');
    }

    async generateAdvancedQuiz(_previousResults: any, _mode: 'harder' | 'remedial'): Promise<QuizQuestion[]> {
        throw new Error('WebLLM generation requires WebSocket session. Use /api/webllm/session endpoint first.');
    }
}
