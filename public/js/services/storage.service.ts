// @ts-nocheck
/**
 * Client-side storage service for quizzes and flashcards
 */

class StorageService {
    constructor() {
        this.quizzes = new Map();
        this.flashcards = new Map();
        this.quizAttempts = new Map();
    }

    // Quiz operations
    storeQuiz(quiz) {
        this.quizzes.set(quiz.id, quiz);
        console.log(`💾 Stored quiz: ${quiz.id}`, quiz);
    }

    getQuiz(quizId) {
        return this.quizzes.get(quizId) || null;
    }

    getAllQuizzes() {
        return Array.from(this.quizzes.values());
    }

    deleteQuiz(quizId) {
        this.quizzes.delete(quizId);
        this.quizAttempts.delete(quizId);
    }

    // Flashcard operations
    storeFlashcard(flashcard) {
        this.flashcards.set(flashcard.id, flashcard);
    }

    storeFlashcards(flashcards) {
        flashcards.forEach(fc => this.storeFlashcard(fc));
        console.log(`💾 Stored ${flashcards.length} flashcards`);
    }

    getFlashcard(id) {
        return this.flashcards.get(id) || null;
    }

    getAllFlashcards() {
        return Array.from(this.flashcards.values());
    }

    getFlashcardsByTopic(topic) {
        return this.getAllFlashcards().filter(fc =>
            fc.topic && fc.topic.toLowerCase().includes(topic.toLowerCase())
        );
    }

    // Quiz attempt operations
    storeQuizAttempt(quizId, attempt) {
        if (!this.quizAttempts.has(quizId)) {
            this.quizAttempts.set(quizId, []);
        }
        this.quizAttempts.get(quizId).push(attempt);
        console.log(`📊 Stored quiz attempt for: ${quizId}`);
    }

    getQuizAttempts(quizId) {
        return this.quizAttempts.get(quizId) || [];
    }

    getAllAttempts() {
        const allAttempts = [];
        this.quizAttempts.forEach(attempts => {
            allAttempts.push(...attempts);
        });
        return allAttempts.sort((a, b) => b.timestamp - a.timestamp);
    }

    // Statistics
    getStats() {
        return {
            totalQuizzes: this.quizzes.size,
            totalFlashcards: this.flashcards.size,
            totalAttempts: this.getAllAttempts().length
        };
    }

    // Clear all data
    clear() {
        this.quizzes.clear();
        this.flashcards.clear();
        this.quizAttempts.clear();
        console.log('🗑️  Storage cleared');
    }
}

// Export singleton instance
export const storageService = new StorageService();
