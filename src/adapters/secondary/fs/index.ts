import type {Deck, QuizResult} from '../../../core/domain/models.js';
import type {StoragePort} from '../../../core/ports/interfaces.js';

export class FileSystemAdapter implements StoragePort {
  // In-memory storage for now, as per original implementation
  // Can be easily swapped for real DB or file persistence later
  private quizHistory: QuizResult[] = [];
  private deckHistory: Deck[] = [];
  
  async saveQuizResult(result: QuizResult): Promise<void> {
    this.quizHistory.push(result);
  }
  
  async getQuizHistory(): Promise<QuizResult[]> {
    return [...this.quizHistory];
  }
  
  async saveDeck(deck: Deck): Promise<void> {
    this.deckHistory.push(deck);
  }
  
  async getDeckHistory(): Promise<Deck[]> {
    return [...this.deckHistory];
  }
}
