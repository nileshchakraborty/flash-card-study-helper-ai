import type { AIServicePort } from '../../../core/ports/interfaces.js';
import type { Flashcard, QuizQuestion } from '../../../core/domain/models.js';
import { OllamaAdapter } from '../ollama/index.js';
import { MCPClientWrapper } from '../mcp/MCPClientWrapper.js';
import type { FlashcardsResponse } from '../mcp/types.js';
import { LoggerService } from '../../../core/services/LoggerService.js';

const logger = new LoggerService();

/**
 * Hybrid Ollama Adapter
 * - Uses MCP when enabled and healthy
 * - Falls back to direct Ollama calls on MCP failure
 * - Feature flag controlled via USE_MCP_SERVER env var
 */
export class HybridOllamaAdapter implements AIServicePort {
    constructor(
        private mcpClient: MCPClientWrapper | null,
        private directAdapter: OllamaAdapter,
        private useMCP: boolean
    ) { }

    async generateFlashcards(topic: string, count: number): Promise<Flashcard[]> {
        if (!this.useMCP || !this.mcpClient) {
            return this.directAdapter.generateFlashcards(topic, count);
        }

        try {
            logger.debug('Attempting MCP flashcard generation', { topic, count });

            const result = await this.mcpClient.callTool<FlashcardsResponse>(
                'generate_flashcards_ollama',
                { topic, count }
            );

            logger.info('MCP flashcard generation succeeded', { topic, count });
            return result.flashcards;
        } catch (error: any) {
            logger.warn('MCP failed, falling back to direct Ollama', {
                topic,
                count,
                error: error.message
            });
            return this.directAdapter.generateFlashcards(topic, count);
        }
    }

    async generateFlashcardsFromText(
        text: string,
        topic: string,
        count: number,
        pageInfo?: any
    ): Promise<Flashcard[]> {
        // MCP doesn't support this yet, use direct adapter
        return this.directAdapter.generateFlashcardsFromText(text, topic, count, pageInfo);
    }

    async generateBriefAnswer(question: string, context: string): Promise<string> {
        // MCP doesn't support this yet, use direct adapter
        return this.directAdapter.generateBriefAnswer(question, context);
    }

    async generateAdvancedQuiz(previousResults: any, mode: 'harder' | 'remedial'): Promise<QuizQuestion[]> {
        // MCP doesn't support this yet, use direct adapter
        return this.directAdapter.generateAdvancedQuiz(previousResults, mode);
    }

    async generateQuizFromFlashcards(flashcards: Flashcard[], count: number): Promise<QuizQuestion[]> {
        // MCP doesn't support this yet, use direct adapter
        return this.directAdapter.generateQuizFromFlashcards(flashcards, count);
    }

    async generateSummary(topic: string): Promise<string> {
        // MCP doesn't support this yet, use direct adapter
        return this.directAdapter.generateSummary(topic);
    }

    async generateSearchQuery(topic: string, parentTopic?: string): Promise<string> {
        // MCP doesn't support this yet, use direct adapter
        return this.directAdapter.generateSearchQuery(topic, parentTopic);
    }

    async generateSubTopics(topic: string): Promise<string[]> {
        // MCP doesn't support this yet, use direct adapter
        return this.directAdapter.generateSubTopics(topic);
    }
}
