import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { FlashcardGenerationGraph } from '../../src/core/workflows/FlashcardGenerationGraph.js';
import type { Flashcard } from '../../src/core/domain/models.js';

// Mock HybridOllamaAdapter
class MockAdapter {
    async generateFlashcards(topic: string, count: number): Promise<Flashcard[]> {
        return [
            { id: '1', front: `What is ${topic}?`, back: `${topic} is a test concept`, topic },
            { id: '2', front: `Why learn ${topic}?`, back: `${topic} is important`, topic }
        ];
    }

    async generateSearchQuery(topic: string): Promise<string> {
        return `${topic} advanced concepts`;
    }

    async generateFlashcardsFromText(text: string, topic: string, count: number): Promise<Flashcard[]> {
        return [
            { id: 'fallback-1', front: `Fallback: ${topic}?`, back: text.substring(0, 50), topic }
        ];
    }
}

describe('FlashcardGenerationGraph', () => {
    let graph: FlashcardGenerationGraph;
    let mockAdapter: MockAdapter;

    beforeEach(() => {
        mockAdapter = new MockAdapter();
        graph = new FlashcardGenerationGraph(mockAdapter as any);
    });

    describe('generate', () => {
        it('should generate flashcards successfully on primary path', async () => {
            const cards = await graph.generate('TypeScript', 5);

            expect(cards).toHaveLength(2);
            expect(cards[0].front).toContain('TypeScript');
            expect(cards[0].topic).toBe('TypeScript');
        });

        it('should handle fallback path when primary generation fails', async () => {
            // Mock generateFlashcards to fail
            const failingAdapter = {
                ...mockAdapter,
                generateFlashcards: jest.fn().mockRejectedValue(new Error('Primary failed')),
                generateSearchQuery: jest.fn().mockResolvedValue('search query'),
                generateFlashcardsFromText: jest.fn().mockResolvedValue([
                    { id: 'fb-1', front: 'Fallback Q', back: 'Fallback A', topic: 'Test' }
                ])
            };

            const failGraph = new FlashcardGenerationGraph(failingAdapter as any);
            const cards = await failGraph.generate('Test', 3);

            expect(failingAdapter.generateFlashcards).toHaveBeenCalledWith('Test', 3);
            expect(failingAdapter.generateSearchQuery).toHaveBeenCalledWith('Test');
            expect(failingAdapter.generateFlashcardsFromText).toHaveBeenCalled();
            expect(cards).toHaveLength(1);
            expect(cards[0].front).toBe('Fallback Q');
        });

        it('should throw error when all paths fail', async () => {
            const completeFailAdapter = {
                generateFlashcards: jest.fn().mockRejectedValue(new Error('Primary failed')),
                generateSearchQuery: jest.fn().mockRejectedValue(new Error('Search failed')),
                generateFlashcardsFromText: jest.fn().mockRejectedValue(new Error('Synthesis failed'))
            };

            const failGraph = new FlashcardGenerationGraph(completeFailAdapter as any);

            await expect(failGraph.generate('Test', 3)).rejects.toThrow();
        });

        it('should pass correct parameters to adapter', async () => {
            const spyAdapter = {
                ...mockAdapter,
                generateFlashcards: jest.fn().mockResolvedValue([
                    { id: '1', front: 'Q', back: 'A', topic: 'Math' }
                ])
            };

            const spyGraph = new FlashcardGenerationGraph(spyAdapter as any);
            await spyGraph.generate('Mathematics', 10);

            expect(spyAdapter.generateFlashcards).toHaveBeenCalledWith('Mathematics', 10);
        });

        it('should handle empty results from primary generation', async () => {
            const emptyAdapter = {
                ...mockAdapter,
                generateFlashcards: jest.fn().mockResolvedValue([]),
                generateSearchQuery: jest.fn().mockResolvedValue('fallback query'),
                generateFlashcardsFromText: jest.fn().mockResolvedValue([
                    { id: 'fb', front: 'Fallback', back: 'From search', topic: 'Test' }
                ])
            };

            const emptyGraph = new FlashcardGenerationGraph(emptyAdapter as any);
            const cards = await emptyGraph.generate('Test', 5);

            // Should trigger fallback path
            expect(emptyAdapter.generateSearchQuery).toHaveBeenCalled();
            expect(cards).toHaveLength(1);
        });
    });

    describe('graph workflow', () => {
        it('should follow correct edge flow on success', async () => {
            // Primary succeeds → END (no fallback)
            const successAdapter = {
                ...mockAdapter,
                generateFlashcards: jest.fn().mockResolvedValue([
                    { id: '1', front: 'Q1', back: 'A1', topic: 'Test' },
                    { id: '2', front: 'Q2', back: 'A2', topic: 'Test' }
                ]),
                generateSearchQuery: jest.fn(),
                generateFlashcardsFromText: jest.fn()
            };

            const successGraph = new FlashcardGenerationGraph(successAdapter as any);
            await successGraph.generate('Test', 2);

            // Fallback methods should NOT be called
            expect(successAdapter.generateSearchQuery).not.toHaveBeenCalled();
            expect(successAdapter.generateFlashcardsFromText).not.toHaveBeenCalled();
        });

        it('should follow fallback edge flow on failure', async () => {
            const fallbackAdapter = {
                generateFlashcards: jest.fn().mockRejectedValue(new Error('Fail')),
                generateSearchQuery: jest.fn().mockResolvedValue('query'),
                generateFlashcardsFromText: jest.fn().mockResolvedValue([
                    { id: '1', front: 'Q', back: 'A', topic: 'Test' }
                ])
            };

            const fallbackGraph = new FlashcardGenerationGraph(fallbackAdapter as any);
            await fallbackGraph.generate('Test', 3);

            // All nodes in fallback path should be called in order
            expect(fallbackAdapter.generateFlashcards).toHaveBeenCalled();
            expect(fallbackAdapter.generateSearchQuery).toHaveBeenCalled();
            expect(fallbackAdapter.generateFlashcardsFromText).toHaveBeenCalled();
        });
    });
});
