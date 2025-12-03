import type { Flashcard, QuizQuestion, QuizResult, Deck } from '../domain/models.js';

// Output Ports (Driven)
export interface AIServicePort {
  generateFlashcards(topic: string, count: number): Promise<Flashcard[]>;
  generateFlashcardsFromText(text: string, topic: string, count: number, pageInfo?: any): Promise<Flashcard[]>;
  generateBriefAnswer(question: string, context: string): Promise<string>;
  generateAdvancedQuiz(previousResults: any, mode: 'harder' | 'remedial'): Promise<QuizQuestion[]>;
  generateQuizFromFlashcards(flashcards: Flashcard[], count: number): Promise<QuizQuestion[]>;
  generateSummary(topic: string): Promise<string>;
  generateSearchQuery(topic: string, parentTopic?: string): Promise<string>;
  generateSubTopics(topic: string): Promise<string[]>;
}

export interface SearchServicePort {
  search(query: string): Promise<any[]>;
}

export interface StoragePort {
  saveQuizResult(result: QuizResult): Promise<void>;
  getQuizHistory(): Promise<QuizResult[]>;
  saveDeck(deck: Deck): Promise<void>;
  getDeckHistory(): Promise<Deck[]>;
}

// Input Ports (Driving)
export interface StudyUseCase {
  generateFlashcards(topic: string, count: number, mode?: 'standard' | 'deep-dive', knowledgeSource?: 'ai-only' | 'web-only' | 'ai-web', runtime?: 'ollama' | 'webllm', parentTopic?: string): Promise<{ cards: Flashcard[], recommendedTopics?: string[] }>;
  processFile(file: Buffer, filename: string, mimeType: string, topic: string): Promise<Flashcard[]>;
  getBriefAnswer(question: string, context: string): Promise<string>;
  generateQuiz(topic: string, count: number, flashcards?: Flashcard[], preferredRuntime?: 'ollama' | 'webllm'): Promise<QuizQuestion[]>;
  generateAdvancedQuiz(previousResults: any, mode: 'harder' | 'remedial'): Promise<QuizQuestion[]>;
  saveQuizResult(result: QuizResult): Promise<string>;
  getQuizHistory(): Promise<QuizResult[]>;
  saveDeck(deck: Deck): Promise<void>;
  getDeckHistory(): Promise<Deck[]>;
}
