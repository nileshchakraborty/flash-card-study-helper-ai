import type { Flashcard, QuizQuestion, QuizResult, Deck } from '../domain/models.js';
import type { KnowledgeSource, Runtime } from '../domain/types.js';

export interface SearchResult {
  title: string;
  link: string;
  snippet?: string;
}

// Output Ports (Driven)
export interface AIServicePort {
  generateFlashcards(topic: string, count: number): Promise<Flashcard[]>;
  generateFlashcardsFromText(
    text: string,
    topic: string,
    count: number,
    pageInfo?: Record<string, unknown>
  ): Promise<Flashcard[]>;
  generateBriefAnswer(question: string, context: string): Promise<string>;
  generateAdvancedQuiz(previousResults: unknown, mode: 'harder' | 'remedial'): Promise<QuizQuestion[]>;
  generateQuizFromFlashcards(flashcards: Flashcard[], count: number): Promise<QuizQuestion[]>;
  generateSummary(topic: string): Promise<string>;
  generateSearchQuery(topic: string, parentTopic?: string): Promise<string>;
  generateSubTopics(topic: string): Promise<string[]>;
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
  generateFlashcards(topic: string, count: number, mode?: 'standard' | 'deep-dive', knowledgeSource?: KnowledgeSource, runtime?: Runtime, parentTopic?: string): Promise<{ cards: Flashcard[], recommendedTopics?: string[] }>;
  processFile(file: Buffer, filename: string, mimeType: string, topic: string): Promise<Flashcard[]>;
  processRawText(text: string, topic: string): Promise<Flashcard[]>;
  processUrls(urls: string[], topic: string): Promise<Flashcard[]>;
  getBriefAnswer(question: string, context: string): Promise<string>;
  generateQuiz(topic: string, count: number, flashcards?: Flashcard[], preferredRuntime?: Runtime): Promise<QuizQuestion[]>;
  generateAdvancedQuiz(previousResults: unknown, mode: 'harder' | 'remedial'): Promise<QuizQuestion[]>;
  saveQuizResult(result: QuizResult): Promise<string>;
  getQuizHistory(): Promise<QuizResult[]>;
  saveDeck(deck: Deck): Promise<void>;
  getDeckHistory(): Promise<Deck[]>;
  getDeck(id: string): Promise<Deck | null>;
}
