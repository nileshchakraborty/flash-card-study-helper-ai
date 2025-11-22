import {beforeEach, describe, expect, it, jest} from '@jest/globals';
import axios from 'axios';
import {OllamaAdapter} from '../../../../src/adapters/secondary/ollama/index.js';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('OllamaAdapter', () => {
  let adapter: OllamaAdapter;
  let axiosPostSpy: any;
  
  beforeEach(() => {
    jest.clearAllMocks();
    adapter = new OllamaAdapter();
    axiosPostSpy = jest.spyOn(axios, 'post');
  });
  
  describe('generateFlashcards', () => {
    it('should parse valid JSON response', async () => {
      const mockResponse = {
        data: {
          response: JSON.stringify([
            {front: 'Q1', back: 'A1'},
            {front: 'Q2', back: 'A2'}
          ])
        }
      };
      axiosPostSpy.mockResolvedValue(mockResponse);
      
      const result = await adapter.generateFlashcards('test', 2);
      
      expect(result).toHaveLength(2);
      expect(result[0].front).toBe('Q1');
      expect(result[0].back).toBe('A1');
    });
    
    it('should handle regex fallback for malformed JSON', async () => {
      const mockResponse = {
        data: {
          response: 'Here is the JSON: "front": "Q1", "back": "A1" ... "front": "Q2", "back": "A2"'
        }
      };
      axiosPostSpy.mockResolvedValue(mockResponse);
      
      const result = await adapter.generateFlashcards('test', 2);
      
      expect(result).toHaveLength(2);
      expect(result[0].front).toBe('Q1');
    });
  });
  
  describe('generateQuizFromFlashcards', () => {
    it('should construct prompt with flashcards', async () => {
      const flashcards = [{id: '1', front: 'Front', back: 'Back', topic: 'Test'}];
      const mockResponse = {
        data: {
          response: '[]'
        }
      };
      axiosPostSpy.mockResolvedValue(mockResponse);
      
      await adapter.generateQuizFromFlashcards(flashcards, 5);
      
      const callArgs = axiosPostSpy.mock.calls[0][1] as any;
      expect(callArgs.prompt).toContain('Q: Front');
      expect(callArgs.prompt).toContain('A: Back');
    });
  });
});
