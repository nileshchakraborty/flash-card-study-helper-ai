import type { LLMAdapter } from '../../../core/services/AdapterManager.js';
import type { Flashcard, QuizQuestion } from '../../../core/domain/models.js';

export class MockLLMAdapter implements LLMAdapter {
    readonly name = 'mock';

    async isAvailable(): Promise<boolean> {
        return true;
    }

    async generateFlashcards(topic: string, count: number): Promise<Flashcard[]> {
        return Array.from({ length: count }, (_, i) => ({
            id: `mock-${i}`,
            front: `Mock Question ${i + 1} about ${topic}`,
            back: `Mock Answer ${i + 1} for ${topic}`,
            topic: topic
        }));
    }

    async generateFlashcardsFromText(_text: string, topic: string, count: number, _pageInfo?: Record<string, unknown>): Promise<Flashcard[]> {
        return Array.from({ length: count }, (_, i) => ({
            id: `mock-text-${i}`,
            front: `Mock Question ${i + 1} from text`,
            back: `Mock Answer ${i + 1} from text`,
            topic: topic
        }));
    }

    async generateBriefAnswer(question: string, _context: string): Promise<string> {
        return `This is a mock answer to "${question}".`;
    }

    async generateAdvancedQuiz(_previousResults: unknown, _mode: 'harder' | 'remedial'): Promise<QuizQuestion[]> {
        return [
            {
                id: 'mock-quiz-1',
                question: 'What is the answer to everything?',
                options: ['42', '21', 'Something else', 'Nothing'],
                correctAnswer: '42',
                explanation: 'Deep Thought said so.'
            },
            {
                id: 'mock-quiz-2',
                question: 'Is this a mock quiz?',
                options: ['Yes', 'No', 'Maybe', 'Ask the AI'],
                correctAnswer: 'Yes',
                explanation: 'Because the real one is too slow.'
            }
        ];
    }

    async generateQuizFromFlashcards(flashcards: Flashcard[], count: number): Promise<QuizQuestion[]> {
        return flashcards.slice(0, count).map((card, i) => ({
            id: `mock-quiz-card-${i}`,
            question: card.front,
            options: [card.back, 'Wrong 1', 'Wrong 2', 'Wrong 3'],
            correctAnswer: card.back,
            explanation: 'Based on the flashcard.'
        }));
    }

    async generateSummary(topic: string): Promise<string> {
        return `Mock summary for ${topic}. This topic is very interesting.`;
    }

    async generateSearchQuery(topic: string, _parentTopic?: string): Promise<string> {
        return `Mock search query for ${topic}`;
    }

    async generateSubTopics(topic: string): Promise<string[]> {
        return [`${topic} Basics`, `${topic} Advanced`, `${topic} History`];
    }
}
