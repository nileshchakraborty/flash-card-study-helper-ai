import { LoggerService } from './LoggerService.js';
import type { Flashcard } from '../domain/models.js';

const logger = new LoggerService();

export interface FlashcardIndex {
    id: string;
    topic: string;
    front: string;
    back: string;
    usedInQuizzes: string[];
    createdAt: number;
}

export class FlashcardStorageService {
    private flashcards: Map<string, FlashcardIndex>;
    private topicIndex: Map<string, Set<string>>;

    constructor() {
        this.flashcards = new Map();
        this.topicIndex = new Map();
        logger.info('FlashcardStorageService initialized');
    }

    /**
     * Store a flashcard
     */
    storeFlashcard(flashcard: Flashcard): void {
        const indexed: FlashcardIndex = {
            id: flashcard.id,
            topic: flashcard.topic || 'General',
            front: flashcard.front,
            back: flashcard.back,
            usedInQuizzes: [],
            createdAt: Date.now()
        };

        this.flashcards.set(flashcard.id, indexed);

        // Update topic index
        const topic = indexed.topic.toLowerCase();
        if (!this.topicIndex.has(topic)) {
            this.topicIndex.set(topic, new Set());
        }
        this.topicIndex.get(topic)!.add(flashcard.id);

        logger.debug('Flashcard stored', { id: flashcard.id, topic: indexed.topic });
    }

    /**
     * Store multiple flashcards
     */
    storeFlashcards(flashcards: Flashcard[]): void {
        flashcards.forEach(fc => this.storeFlashcard(fc));
        logger.info('Flashcards stored', { count: flashcards.length });
    }

    /**
     * Get a flashcard by ID
     */
    getFlashcard(id: string): FlashcardIndex | null {
        return this.flashcards.get(id) || null;
    }

    /**
     * Get flashcards by IDs
     */
    getFlashcardsByIds(ids: string[]): FlashcardIndex[] {
        return ids
            .map(id => this.flashcards.get(id))
            .filter((fc): fc is FlashcardIndex => fc !== undefined);
    }

    /**
     * Get all flashcards
     */
    getAllFlashcards(): FlashcardIndex[] {
        return Array.from(this.flashcards.values());
    }

    /**
     * Get flashcards by topic
     */
    getFlashcardsByTopic(topic: string): FlashcardIndex[] {
        const topicKey = topic.toLowerCase();
        const ids = this.topicIndex.get(topicKey);

        if (!ids) {
            return [];
        }

        return Array.from(ids)
            .map(id => this.flashcards.get(id))
            .filter((fc): fc is FlashcardIndex => fc !== undefined);
    }

    /**
     * Get all topics
     */
    getAllTopics(): string[] {
        return Array.from(this.topicIndex.keys());
    }

    /**
     * Mark flashcard as used in a quiz
     */
    markUsedInQuiz(flashcardId: string, quizId: string): void {
        const flashcard = this.flashcards.get(flashcardId);
        if (flashcard && !flashcard.usedInQuizzes.includes(quizId)) {
            flashcard.usedInQuizzes.push(quizId);
        }
    }

    /**
     * Mark multiple flashcards as used in a quiz
     */
    markFlashcardsUsedInQuiz(flashcardIds: string[], quizId: string): void {
        flashcardIds.forEach(id => this.markUsedInQuiz(id, quizId));
        logger.debug('Flashcards marked as used in quiz', {
            flashcardCount: flashcardIds.length,
            quizId
        });
    }

    /**
     * Get flashcards used in a specific quiz
     */
    getFlashcardsForQuiz(quizId: string): FlashcardIndex[] {
        return Array.from(this.flashcards.values()).filter(
            fc => fc.usedInQuizzes.includes(quizId)
        );
    }

    /**
     * Delete a flashcard
     */
    deleteFlashcard(id: string): boolean {
        const flashcard = this.flashcards.get(id);
        if (!flashcard) return false;

        // Remove from topic index
        const topicKey = flashcard.topic.toLowerCase();
        const topicSet = this.topicIndex.get(topicKey);
        if (topicSet) {
            topicSet.delete(id);
            if (topicSet.size === 0) {
                this.topicIndex.delete(topicKey);
            }
        }

        this.flashcards.delete(id);
        logger.debug('Flashcard deleted', { id });
        return true;
    }

    /**
     * Get statistics
     */
    getStats() {
        return {
            totalFlashcards: this.flashcards.size,
            totalTopics: this.topicIndex.size,
            topicBreakdown: Array.from(this.topicIndex.entries()).map(([topic, ids]) => ({
                topic,
                count: ids.size
            }))
        };
    }

    /**
     * Clear all data
     */
    clear(): void {
        this.flashcards.clear();
        this.topicIndex.clear();
        logger.info('Flashcard storage cleared');
    }
}
