import type { Flashcard, QuizQuestion } from '../../../core/domain/models.js';

export interface MCPToolResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
}

export interface FlashcardsResponse {
    flashcards: Flashcard[];
}

export interface QuizResponse {
    questions: QuizQuestion[];
}

export interface SearchResponse {
    results: Array<{
        title: string;
        link: string;
        snippet: string;
    }>;
}

export interface TextGenerationResponse {
    text: string;
    model?: string;
}
