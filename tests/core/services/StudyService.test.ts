/** @jest-environment node */
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { StudyService } from '../../../src/core/services/StudyService.js';
import type { AIServicePort, SearchServicePort, StoragePort } from '../../../src/core/ports/interfaces.js';

// Mock adapters
const mockAiAdapter: jest.Mocked<AIServicePort> = {
  generateFlashcards: jest.fn(),
  generateFlashcardsFromText: jest.fn(),
  generateBriefAnswer: jest.fn(),
  generateAdvancedQuiz: jest.fn(),
  generateQuizFromFlashcards: jest.fn(),
  generateSummary: jest.fn(),
  generateSearchQuery: jest.fn(),
  generateSubTopics: jest.fn()
};
const mockSearchAdapter: jest.Mocked<SearchServicePort> = {
  search: jest.fn()
};

const mockStorageAdapter: jest.Mocked<StoragePort> = {
  saveQuizResult: jest.fn(),
  getQuizHistory: jest.fn(),
  saveDeck: jest.fn(),
  getDeckHistory: jest.fn()
};

describe('StudyService', () => {
  let studyService: StudyService;

  beforeEach(() => {
    jest.clearAllMocks();
    studyService = new StudyService({ ollama: mockAiAdapter }, mockSearchAdapter, mockStorageAdapter);
  });

  describe('generateFlashcards', () => {
    it('should use AI knowledge when search returns no results', async () => {
      mockSearchAdapter.search.mockResolvedValue([]);
      // Mock generateFlashcardsFromText to return empty (no context scenario)
      mockAiAdapter.generateFlashcardsFromText.mockResolvedValue([]);
      // This will be called as fallback when no context
      mockAiAdapter.generateFlashcards.mockResolvedValue([
        { id: '1', front: 'Q', back: 'A', topic: 'test' }
      ]);
      // These might fail, which is fine
      mockAiAdapter.generateSummary.mockRejectedValue(new Error('Not implemented'));
      mockAiAdapter.generateSearchQuery.mockRejectedValue(new Error('Not implemented'));

      const result = await studyService.generateFlashcards('test topic', 5);

      expect(mockSearchAdapter.search).toHaveBeenCalled();
      // When no context is available, it falls back to generateFlashcards
      expect(mockAiAdapter.generateFlashcards).toHaveBeenCalledWith('test topic', 5);
      expect(result.cards).toHaveLength(5); // enforceCardCount pads to requested count
    });
  });

  describe('generateQuiz', () => {
    it('should return local fallback quiz when flashcards are provided (no adapter needed)', async () => {
      const flashcards = [{ id: '1', front: 'Q', back: 'A', topic: 'test' }];
      mockAiAdapter.generateQuizFromFlashcards.mockResolvedValue([]);

      const quiz = await studyService.generateQuiz('test', 5, flashcards);

      expect(quiz.length).toBeGreaterThan(0);
      // Local fallback is used first; adapter call is optional
      expect(mockAiAdapter.generateQuizFromFlashcards).not.toHaveBeenCalled();
    });

    it('should fallback to generateAdvancedQuiz when no flashcards provided', async () => {
      mockAiAdapter.generateAdvancedQuiz.mockResolvedValue([]);

      await studyService.generateQuiz('test', 5);

      expect(mockAiAdapter.generateAdvancedQuiz).toHaveBeenCalledWith({ topic: 'test', wrongAnswers: [] }, 'harder');
    });
  });
});
