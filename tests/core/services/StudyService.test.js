import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { StudyService } from '../../../src/core/services/StudyService.js';
// Mock adapters
const mockAiAdapter = {
    generateFlashcards: jest.fn(),
    generateFlashcardsFromText: jest.fn(),
    generateBriefAnswer: jest.fn(),
    generateAdvancedQuiz: jest.fn(),
    generateQuizFromFlashcards: jest.fn()
};
const mockSearchAdapter = {
    search: jest.fn()
};
const mockStorageAdapter = {
    saveQuizResult: jest.fn(),
    getQuizHistory: jest.fn(),
    saveDeck: jest.fn(),
    getDeckHistory: jest.fn()
};
describe('StudyService', () => {
    let studyService;
    beforeEach(() => {
        jest.clearAllMocks();
        studyService = new StudyService(mockAiAdapter, mockSearchAdapter, mockStorageAdapter);
    });
    describe('generateFlashcards', () => {
        it('should use AI knowledge when search returns no results', async () => {
            mockSearchAdapter.search.mockResolvedValue([]);
            mockAiAdapter.generateFlashcards.mockResolvedValue([{ id: '1', front: 'Q', back: 'A', topic: 'test' }]);
            const result = await studyService.generateFlashcards('test topic', 5);
            expect(mockSearchAdapter.search).toHaveBeenCalledWith('test topic');
            expect(mockAiAdapter.generateFlashcards).toHaveBeenCalledWith('test topic', 5);
            expect(result).toHaveLength(1);
        });
    });
    describe('generateQuiz', () => {
        it('should use generateQuizFromFlashcards when flashcards are provided', async () => {
            const flashcards = [{ id: '1', front: 'Q', back: 'A', topic: 'test' }];
            mockAiAdapter.generateQuizFromFlashcards.mockResolvedValue([]);
            await studyService.generateQuiz('test', 5, flashcards);
            expect(mockAiAdapter.generateQuizFromFlashcards).toHaveBeenCalledWith(flashcards, 5);
        });
        it('should fallback to generateAdvancedQuiz when no flashcards provided', async () => {
            mockAiAdapter.generateAdvancedQuiz.mockResolvedValue([]);
            await studyService.generateQuiz('test', 5);
            expect(mockAiAdapter.generateAdvancedQuiz).toHaveBeenCalledWith({ topic: 'test', wrongAnswers: [] }, 'harder');
        });
    });
});
//# sourceMappingURL=StudyService.test.js.map