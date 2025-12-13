import type { LLMRuntime, ModelConfig, GenerationOptions } from '../types.js';
import { LLMRuntimeType } from '../types.js';

export class RemoteRuntime implements LLMRuntime {
    type = LLMRuntimeType.REMOTE;
    isReady = false;
    onProgress?: (progress: number, message: string) => void;

    async initialize(_config: ModelConfig): Promise<void> {
        // Remote runtime is always "ready" instantly, no download needed
        this.isReady = true;
        if (this.onProgress) {
            this.onProgress(100, "Ready");
        }
    }

    async generate(prompt: string, _options?: GenerationOptions): Promise<string> {
        // In a real app, this would call your backend API which proxies to OpenAI/Anthropic/etc.
        // For this demo, we'll simulate a network call or call a mock endpoint.

        // Example: fetch('/api/generate', { ... })

        console.log("Generating with Remote Runtime...");

        // Simulate latency
        await new Promise(resolve => setTimeout(resolve, 1000));

        return `[Remote AI Response] This is a response from the remote fallback API for prompt: "${prompt.substring(0, 20)}..."`;
    }

    async unload(): Promise<void> {
        this.isReady = false;
    }
}
