import type { Flashcard, QuizQuestion, QuizResult, Deck } from '../domain/models.js';
import type { KnowledgeSource, Runtime } from '../domain/types.js';

export interface SearchResult {
  title: string;
  link: string;
  snippet?: string;
}

// Output Ports (Driven)
export interface AIServicePort {
  generateFlashcards(topic: string, count: number, llmConfig?: any): Promise<Flashcard[]>;
  generateFlashcardsFromText(
    text: string,
    topic: string,
    count: number,
    pageInfo?: Record<string, unknown>,
    llmConfig?: any
  ): Promise<Flashcard[]>;
  generateBriefAnswer(question: string, context: string, llmConfig?: any): Promise<string>;
  generateAdvancedQuiz(previousResults: unknown, mode: 'harder' | 'remedial', context?: string, llmConfig?: any): Promise<QuizQuestion[]>;
  generateQuizFromFlashcards(flashcards: Flashcard[], count: number, llmConfig?: any): Promise<QuizQuestion[]>;
  generateSummary(topic: string, llmConfig?: any): Promise<string>;
  generateSearchQuery(topic: string, parentTopic?: string, llmConfig?: any): Promise<string>;
  generateSubTopics(topic: string, llmConfig?: any): Promise<string[]>;
}

export interface SearchServicePort {
  search(query: string): Promise<SearchResult[]>;
}

export interface StoragePort {
  saveQuizResult(result: QuizResult): Promise<void>;
  getQuizHistory(): Promise<QuizResult[]>;
  saveDeck(deck: Deck): Promise<void>;
  getDeckHistory(): Promise<Deck[]>;
  getDeck(id: string): Promise<Deck | null>;
}

// Input Ports (Driving)
export interface StudyUseCase {
  generateFlashcards(topic: string, count: number, mode?: 'standard' | 'deep-dive', knowledgeSource?: KnowledgeSource, runtime?: Runtime, parentTopic?: string, llmConfig?: any): Promise<{ cards: Flashcard[], recommendedTopics?: string[] }>;
  processFile(file: Buffer, filename: string, mimeType: string, topic: string): Promise<Flashcard[]>;
  processRawText(text: string, topic: string): Promise<Flashcard[]>;
  processUrls(urls: string[], topic: string): Promise<Flashcard[]>;
  getBriefAnswer(question: string, context: string): Promise<string>;
  generateQuiz(topic: string, count: number, flashcards?: Flashcard[], preferredRuntime?: Runtime, llmConfig?: any): Promise<QuizQuestion[]>;
  generateAdvancedQuiz(previousResults: unknown, mode: 'harder' | 'remedial', llmConfig?: any): Promise<QuizQuestion[]>;
  saveQuizResult(result: QuizResult): Promise<string>;
  getQuizHistory(): Promise<QuizResult[]>;
  saveDeck(deck: Deck): Promise<void>;
  getDeckHistory(): Promise<Deck[]>;
  getDeck(id: string): Promise<Deck | null>;
}
