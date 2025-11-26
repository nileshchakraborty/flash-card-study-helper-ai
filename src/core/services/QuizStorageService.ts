import { LoggerService } from './LoggerService.js';

const logger = new LoggerService();

export interface Quiz {
    id: string;
    topic: string;
    questions: QuizQuestion[];
    source: 'flashcards' | 'topic';
    sourceFlashcardIds?: string[];
    createdAt: number;
    metadata?: {
        difficulty?: string;
        estimatedTime?: number;
    };
}

export interface QuizQuestion {
    id: string;
    question: string;
    options: string[];
    correctAnswer: string;
    explanation?: string;
    difficulty?: 'easy' | 'medium' | 'hard';
}

export interface QuizAttempt {
    id: string;
    quizId: string;
    timestamp: number;
    answers: Record<string, string>;
    score: number;
    total: number;
    timeSpent?: number;
}

export class QuizStorageService {
    private quizzes: Map<string, Quiz>;
    private attempts: Map<string, QuizAttempt[]>;

    constructor() {
        this.quizzes = new Map();
        this.attempts = new Map();
        logger.info('QuizStorageService initialized');
    }

    /**
     * Store a quiz
     */
    storeQuiz(quiz: Quiz): void {
        this.quizzes.set(quiz.id, quiz);
        logger.info('Quiz stored', { id: quiz.id, topic: quiz.topic, questionCount: quiz.questions.length });
    }

    /**
     * Get a quiz by ID
     */
    getQuiz(quizId: string): Quiz | null {
        const quiz = this.quizzes.get(quizId);
        if (!quiz) {
            logger.debug('Quiz not found', { quizId });
            return null;
        }
        return quiz;
    }

    /**
     * Get all quizzes
     */
    getAllQuizzes(): Quiz[] {
        return Array.from(this.quizzes.values());
    }

    /**
     * Get quizzes by topic
     */
    getQuizzesByTopic(topic: string): Quiz[] {
        return Array.from(this.quizzes.values()).filter(
            q => q.topic.toLowerCase().includes(topic.toLowerCase())
        );
    }

    /**
     * Get quizzes by source type
     */
    getQuizzesBySource(source: 'flashcards' | 'topic'): Quiz[] {
        return Array.from(this.quizzes.values()).filter(q => q.source === source);
    }

    /**
     * Delete a quiz
     */
    deleteQuiz(quizId: string): boolean {
        const deleted = this.quizzes.delete(quizId);
        if (deleted) {
            this.attempts.delete(quizId);
            logger.info('Quiz deleted', { quizId });
        }
        return deleted;
    }

    /**
     * Store a quiz attempt
     */
    storeAttempt(attempt: QuizAttempt): void {
        const quizAttempts = this.attempts.get(attempt.quizId) || [];
        quizAttempts.push(attempt);
        this.attempts.set(attempt.quizId, quizAttempts);
        logger.info('Quiz attempt stored', {
            attemptId: attempt.id,
            quizId: attempt.quizId,
            score: `${attempt.score}/${attempt.total}`
        });
    }

    /**
     * Get all attempts for a quiz
     */
    getAttempts(quizId: string): QuizAttempt[] {
        return this.attempts.get(quizId) || [];
    }

    /**
     * Get all attempts across all quizzes
     */
    getAllAttempts(): QuizAttempt[] {
        const allAttempts: QuizAttempt[] = [];
        this.attempts.forEach(attempts => {
            allAttempts.push(...attempts);
        });
        return allAttempts.sort((a, b) => b.timestamp - a.timestamp);
    }

    /**
     * Get quiz with its attempt history
     */
    getQuizWithHistory(quizId: string): { quiz: Quiz | null; attempts: QuizAttempt[] } {
        return {
            quiz: this.getQuiz(quizId),
            attempts: this.getAttempts(quizId)
        };
    }

    /**
     * Get statistics
     */
    getStats() {
        return {
            totalQuizzes: this.quizzes.size,
            totalAttempts: Array.from(this.attempts.values()).reduce((sum, arr) => sum + arr.length, 0),
            quizzesBySource: {
                flashcards: this.getQuizzesBySource('flashcards').length,
                topic: this.getQuizzesBySource('topic').length
            }
        };
    }

    /**
     * Clear all data
     */
    clear(): void {
        this.quizzes.clear();
        this.attempts.clear();
        logger.info('Quiz storage cleared');
    }
}
