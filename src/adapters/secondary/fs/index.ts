import type { Deck, QuizResult } from '../../../core/domain/models.js';
import type { StoragePort } from '../../../core/ports/interfaces.js';

export class FileSystemAdapter implements StoragePort {
  // In-memory storage for serverless environments
  // NOTE: This storage is ephemeral and resets on each serverless function invocation
  // For production, consider using a database or client-side localStorage
  private quizHistory: QuizResult[] = [];
  private deckHistory: Deck[] = [];

  async saveQuizResult(result: QuizResult): Promise<void> {
    try {
      this.quizHistory.push(result);
      console.log('[FileSystemAdapter] Quiz result saved (in-memory only, will not persist in serverless)');
    } catch (error) {
      console.warn('[FileSystemAdapter] Failed to save quiz result:', error);
      // Don't throw - allow the app to continue functioning
    }
  }

  async getQuizHistory(): Promise<QuizResult[]> {
    try {
      console.log(`[FileSystemAdapter] Returning ${this.quizHistory.length} quiz results (in-memory only)`);
      return [...this.quizHistory];
    } catch (error) {
      console.warn('[FileSystemAdapter] Failed to get quiz history:', error);
      return []; // Return empty array instead of crashing
    }
  }

  async saveDeck(deck: Deck): Promise<void> {
    try {
      this.deckHistory.push(deck);
      console.log('[FileSystemAdapter] Deck saved (in-memory only, will not persist in serverless)');
    } catch (error) {
      console.warn('[FileSystemAdapter] Failed to save deck:', error);
      // Don't throw - allow the app to continue functioning
    }
  }

  async getDeckHistory(): Promise<Deck[]> {
    try {
      console.log(`[FileSystemAdapter] Returning ${this.deckHistory.length} decks (in-memory only)`);
      return [...this.deckHistory];
    } catch (error) {
      console.warn('[FileSystemAdapter] Failed to get deck history:', error);
      return []; // Return empty array instead of crashing
    }
  }

  async getDeck(id: string): Promise<Deck | null> {
    try {
      const deck = this.deckHistory.find(d => d.id === id);
      return deck || null;
    } catch (error) {
      console.warn('[FileSystemAdapter] Failed to get deck:', error);
      return null;
    }
  }
}
