import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { WebLLMRuntime } from '../public/js/services/llm/runtimes/WebLLMRuntime.js';
import { LLMRuntimeType } from '../public/js/services/llm/types.js';
import * as webllm from '@mlc-ai/web-llm';

// Mock is handled by moduleNameMapper in jest.config.cjs

describe('WebLLMRuntime', () => {
    let runtime: WebLLMRuntime;

    beforeEach(() => {
        jest.clearAllMocks();
        runtime = new WebLLMRuntime();
    });

    it('should have correct type', () => {
        expect(runtime.type).toBe(LLMRuntimeType.WEB_LLM);
    });

    it('should initialize correctly', async () => {
        const config = {
            id: 'test-model',
            name: 'Test Model',
            sizeMB: 1000,
            runtime: LLMRuntimeType.WEB_LLM,
            family: 'phi-2'
        };

        await runtime.initialize(config);
        expect(runtime.isReady).toBe(true);
        expect(webllm.MLCEngine).toHaveBeenCalled();
    });

    it('should generate text', async () => {
        const config = {
            id: 'test-model',
            name: 'Test Model',
            sizeMB: 1000,
            runtime: LLMRuntimeType.WEB_LLM,
            family: 'phi-2'
        };
        await runtime.initialize(config);

        // Get the mock instance to configure return value if needed
        const mockEngineInstance = (webllm.MLCEngine as unknown as jest.Mock).mock.results[0].value as any;
        mockEngineInstance.chat.completions.create.mockResolvedValue({
            choices: [{ message: { content: 'Mock response' } }]
        });

        const response = await runtime.generate('Hello');
        expect(response).toBe('Mock response');
        expect(mockEngineInstance.chat.completions.create).toHaveBeenCalledWith(expect.objectContaining({
            messages: [{ role: 'user', content: 'Hello' }]
        }));
    });

    it('should throw if generating before initialization', async () => {
        await expect(runtime.generate('Hello')).rejects.toThrow('WebLLM runtime not initialized');
    });
});
