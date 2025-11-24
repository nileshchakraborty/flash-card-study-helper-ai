/**
 * WebLLMAdapter - Backend adapter for browser-based WebLLM
 * 
 * Since WebLLM runs in the browser, this adapter acts as a proxy/coordinator
 * that manages the flow and metrics, but delegates actual generation to frontend
 */

import type { AIServicePort } from '../../../core/ports/interfaces.js';
import type { Flashcard, QuizQuestion } from '../../../core/domain/models.js';
import type { CacheService } from '../../../core/services/CacheService.js';

export class WebLLMAdapter implements AIServicePort {
    private cache?: CacheService<any>;

    constructor(cache?: CacheService<any>) {
        this.cache = cache;
        console.log('🌐 WebLLMAdapter initialized (browser-based)');
    }

    /**
     * Note: These methods follow the same interface as OllamaAdapter
     * but since WebLLM runs in browser, actual implementation is client-side
     * 
     * This adapter serves as a metric/cache coordinator rather than direct implementation
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

        console.log(`⚠️  WebLLM backend adapter called - flashcard generation happens client-side`);

        // In the refactored architecture, the client will handle this
        // This method exists for interface compatibility
        throw new Error('WebLLM generation should be handled client-side. Use runtime="webllm" in API request.');
    }

    async generateFlashcardsFromText(text: string, topic: string, count: number, pageInfo?: any): Promise<Flashcard[]> {
        const textHash = require('crypto').createHash('sha256').update(text.substring(0, 10000)).digest('hex').substring(0, 16);
        const cacheKey = `webllm:flashcards-text:${textHash}:${topic}:${count}`;

        if (this.cache) {
            const cached = this.cache.get(cacheKey);
            if (cached !== undefined) return cached;
        }

        throw new Error('WebLLM generation should be handled client-side. Use runtime="webllm" in API request.');
    }

    async generateBriefAnswer(question: string, context: string): Promise<string> {
        const cacheKey = `webllm:brief:${question.substring(0, 50)}`;
        if (this.cache) {
            const cached = this.cache.get(cacheKey);
            if (cached !== undefined) return cached;
        }

        throw new Error('WebLLM generation should be handled client-side.');
    }

    async generateSummary(topic: string): Promise<string> {
        const cacheKey = `webllm:summary:${topic}`;
        if (this.cache) {
            const cached = this.cache.get(cacheKey);
            if (cached !== undefined) return cached;
        }

        throw new Error('WebLLM generation should be handled client-side.');
    }

    async generateSearchQuery(topic: string, parentTopic?: string): Promise<string> {
        const cacheKey = `webllm:query:${topic}:${parentTopic || ''}`;
        if (this.cache) {
            const cached = this.cache.get(cacheKey);
            if (cached !== undefined) return cached;
        }

        throw new Error('WebLLM generation should be handled client-side.');
    }

    async generateSubTopics(topic: string): Promise<string[]> {
        const cacheKey = `webllm:subtopics:${topic}`;
        if (this.cache) {
            const cached = this.cache.get(cacheKey);
            if (cached !== undefined) return cached;
        }

        throw new Error('WebLLM generation should be handled client-side.');
    }

    async generateQuizFromFlashcards(flashcards: Flashcard[], count: number): Promise<QuizQuestion[]> {
        throw new Error('WebLLM generation should be handled client-side.');
    }

    async generateAdvancedQuiz(previousResults: any, mode: 'harder' | 'remedial'): Promise<QuizQuestion[]> {
        throw new Error('WebLLM generation should be handled client-side.');
    }
}
