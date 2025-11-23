import type { LLMRuntime, ModelConfig, GenerationOptions } from '../types.js';
import { LLMRuntimeType } from '../types.js';
import { pipeline, env } from '@xenova/transformers';

// Skip local model checks for browser environment
env.allowLocalModels = false;
env.useBrowserCache = true;

export class TransformersRuntime implements LLMRuntime {
    type = LLMRuntimeType.TRANSFORMERS;
    isReady = false;
    onProgress?: (progress: number, message: string) => void;

    private generator: any = null;

    async initialize(config: ModelConfig): Promise<void> {
        if (this.generator) {
            return;
        }

        // Map config ID to Hugging Face model ID
        let modelId = 'Xenova/tiny-llama-1.1b-chat-v1.0'; // Default fallback
        if (config.family === 'tiny-llama') {
            modelId = 'Xenova/TinyLlama-1.1B-Chat-v1.0';
        } else if (config.family === 'phi-2') {
            modelId = 'Xenova/phi-2';
        }

        try {
            this.generator = await pipeline('text-generation', modelId, {
                progress_callback: (data: any) => {
                    if (this.onProgress && data.status === 'progress') {
                        this.onProgress(Math.round(data.progress || 0), `Loading ${data.file}...`);
                    }
                }
            });
            this.isReady = true;
        } catch (error) {
            console.error("Failed to initialize Transformers.js:", error);
            throw error;
        }
    }

    async generate(prompt: string, options?: GenerationOptions): Promise<string> {
        if (!this.generator || !this.isReady) {
            throw new Error("Transformers runtime not initialized");
        }

        const output = await this.generator(prompt, {
            max_new_tokens: options?.maxTokens || 128,
            temperature: options?.temperature || 0.7,
            top_p: options?.topP || 0.9,
            do_sample: true,
        });

        // Output is usually an array of objects with 'generated_text'
        return output[0]?.generated_text || "";
    }

    async unload(): Promise<void> {
        // Transformers.js pipelines don't have a strict 'unload' method exposed easily 
        // to clear WASM memory, but we can nullify the reference.
        this.generator = null;
        this.isReady = false;
    }
}
