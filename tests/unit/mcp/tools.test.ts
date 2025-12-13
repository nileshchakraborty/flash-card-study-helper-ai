
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { searchWebTool } from '../../../mcp-server/tools/search-web.tool.js';
import { flashcardsOllamaTool } from '../../../mcp-server/tools/flashcards-ollama.tool.js';
import { ollamaTool } from '../../../mcp-server/tools/ollama.tool.js';
import { serperTool } from '../../../mcp-server/tools/serper.tool.js';

// Mock global fetch
const originalFetch = global.fetch;

describe('MCP Tools', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        global.fetch = jest.fn() as any;
        process.env.SERPER_API_KEY = 'test-api-key';
        process.env.OLLAMA_BASE_URL = 'http://localhost:11434';
    });

    afterEach(() => {
        global.fetch = originalFetch;
        delete process.env.SERPER_API_KEY;
        delete process.env.OLLAMA_BASE_URL;
    });

    describe('searchWebTool', () => {
        it('should execute search successfully', async () => {
            const mockResponse = {
                organic: [
                    { title: 'Result 1', link: 'http://example.com/1', snippet: 'Snippet 1' }
                ]
            };

            (global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
                json: async () => mockResponse
            });

            const result = await searchWebTool.execute({ query: 'test query', limit: 1 });

            expect(global.fetch).toHaveBeenCalledWith('https://google.serper.dev/search', expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({
                    'X-API-KEY': 'test-api-key'
                })
            }));

            expect(result).toEqual({
                results: [
                    { title: 'Result 1', link: 'http://example.com/1', snippet: 'Snippet 1' }
                ],
                searchQuery: 'test query'
            });
        });

        it('should throw error if API key missing', async () => {
            delete process.env.SERPER_API_KEY;
            await expect(searchWebTool.execute({ query: 'test' }))
                .rejects.toThrow('SERPER_API_KEY not configured');
        });
    });

    describe('flashcardsOllamaTool', () => {
        it('should generate flashcards successfully', async () => {
            const mockOllamaResponse = {
                response: JSON.stringify([
                    { question: "What is AI?", answer: "Artificial Intelligence" }
                ])
            };

            (global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
                json: async () => mockOllamaResponse
            });

            const result: any = await flashcardsOllamaTool.execute({
                topic: 'AI',
                count: 1
            });

            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/generate'),
                expect.objectContaining({ method: 'POST' })
            );

            expect(result.flashcards).toHaveLength(1);
            expect(result.flashcards[0].front).toBe('What is AI?');
            expect(result.flashcards[0].back).toBe('Artificial Intelligence');
        });

        it('should handle malformed JSON from Ollama', async () => {
            const mockOllamaResponse = {
                response: "Here is the JSON: ```json\n[{ \"question\": \"Q\", \"answer\": \"A\" }]\n```"
            };

            (global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
                json: async () => mockOllamaResponse
            });

            const result: any = await flashcardsOllamaTool.execute({
                topic: 'Test',
                count: 1
            });

            expect(result.flashcards).toHaveLength(1);
            expect(result.flashcards[0].front).toBe('Q');
        });
    });

    describe('ollamaTool', () => {
        it('should generate text successfully', async () => {
            const mockOllamaResponse = {
                response: 'Generated text',
                done: true
            };

            (global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
                json: async () => mockOllamaResponse
            });

            const result: any = await ollamaTool.execute({
                model: 'llama2',
                prompt: 'Hello'
            });

            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/generate'),
                expect.objectContaining({
                    method: 'POST',
                    body: expect.stringContaining('"model":"llama2"')
                })
            );

            expect(result.text).toBe('Generated text');
        });
    });

    describe('serperTool', () => {
        it('should execute search successfully', async () => {
            const mockResponse = {
                organic: [
                    { title: 'Result 1', link: 'http://example.com/1', snippet: 'Snippet 1' }
                ]
            };

            (global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
                json: async () => mockResponse
            });

            const result: any = await serperTool.execute({ query: 'test query' });

            expect(global.fetch).toHaveBeenCalledWith('https://google.serper.dev/search', expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({
                    'X-API-KEY': 'test-api-key'
                })
            }));

            expect(result.results).toHaveLength(1);
            expect(result.results[0].title).toBe('Result 1');
        });
    });
});
