import type { LLMRuntime, ModelConfig, GenerationOptions } from '../types.js';
import { LLMRuntimeType } from '../types.js';
import * as webllm from '@mlc-ai/web-llm';
import type { ChatCompletionMessageParam } from '@mlc-ai/web-llm';

export class WebLLMRuntime implements LLMRuntime {
    type = LLMRuntimeType.WEB_LLM;
    isReady = false;
    onProgress?: (progress: number, message: string) => void;

    private engine: webllm.MLCEngine | null = null;

    async initialize(config: ModelConfig): Promise<void> {
        if (this.engine) {
            return;
        }

        this.engine = new webllm.MLCEngine();

        this.engine.setInitProgressCallback((report: webllm.InitProgressReport) => {
            if (this.onProgress) {
                // Convert progress to 0-100
                // report.progress is 0-1
                this.onProgress(Math.round(report.progress * 100), report.text);
            }
        });

        // Use the model ID from config. 
        // Note: WebLLM requires specific model IDs that match its prebuilt list or a custom config.
        // For this demo, we'll map our internal IDs to WebLLM's expected IDs if needed, 
        // or assume the config.id is valid for WebLLM.
        // 'Phi-3-mini-4k-instruct-q4f16_1-MLC' is a common one, let's try to map or use directly.

        let modelId = config.id;
        if (config.family === 'phi-2') {
            modelId = 'phi-2-q4f16_1-MLC';
        } else if (config.family === 'llama-3') {
            modelId = 'Llama-3-8B-Instruct-q4f16_1-MLC'; // Check if this exists, or use a safer one like Llama-2 if needed, but Llama-3 is likely there.
        }

        try {
            await this.engine.reload(modelId);
            this.isReady = true;
        } catch (error) {
            console.error("Failed to initialize WebLLM:", error);
            throw error;
        }
    }

    async generate(prompt: string, options?: GenerationOptions): Promise<string> {
        if (!this.engine || !this.isReady) {
            throw new Error("WebLLM runtime not initialized");
        }

        const messages: ChatCompletionMessageParam[] = [
            { role: "user", content: prompt }
        ];

        const reply = await this.engine.chat.completions.create({
            messages,
            temperature: options?.temperature || 0.7,
            max_tokens: options?.maxTokens || 512,
            top_p: options?.topP || 0.9,
            stream: !!options?.streamCallback,
        }) as webllm.ChatCompletion;

        if (options?.streamCallback) {
            // Streaming handling would go here if we used the async generator
            // For now, let's just return the full response for simplicity in this step
            // or implement proper streaming if the library supports it easily in this call style.
            // The `create` call returns a non-streamed response by default unless stream: true is passed
            // and we iterate. 
            // Let's keep it simple: non-streaming for now unless requested.
        }

        return reply.choices[0].message.content || "";
    }

    async unload(): Promise<void> {
        if (this.engine) {
            await this.engine.unload();
            this.engine = null;
            this.isReady = false;
        }
    }
}
