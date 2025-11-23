import { DeviceCapabilityService } from './DeviceCapabilityService.js';
import { ModelRegistry } from './ModelRegistry.js';
import type { LLMRuntime, ModelConfig, GenerationOptions, DeviceCapabilities } from './types.js';
import { LLMRuntimeType } from './types.js';
import { WebLLMRuntime } from './runtimes/WebLLMRuntime.js';
import { TransformersRuntime } from './runtimes/TransformersRuntime.js';
import { RemoteRuntime } from './runtimes/RemoteRuntime.js';

export class LLMOrchestrator {
    private runtime: LLMRuntime | null = null;
    private capabilities: DeviceCapabilities | null = null;
    private currentConfig: ModelConfig | null = null;

    async initialize(): Promise<void> {
        this.capabilities = await DeviceCapabilityService.detectCapabilities();
        console.log("Device Capabilities:", this.capabilities);
    }

    getRecommendedStrategy(): { tier: string, config: ModelConfig } {
        if (!this.capabilities) {
            throw new Error("Orchestrator not initialized");
        }
        const tier = DeviceCapabilityService.getTier(this.capabilities);
        const config = ModelRegistry.getRecommendedModel(tier);
        return { tier, config };
    }

    async loadModel(config: ModelConfig, onProgress?: (progress: number, message: string) => void): Promise<void> {
        if (this.runtime && this.currentConfig?.id === config.id && this.runtime.isReady) {
            return; // Already loaded
        }

        // Unload previous if exists
        if (this.runtime) {
            await this.runtime.unload();
        }

        // Select runtime implementation
        switch (config.runtime) {
            case LLMRuntimeType.WEB_LLM:
                this.runtime = new WebLLMRuntime();
                break;
            case LLMRuntimeType.TRANSFORMERS:
                this.runtime = new TransformersRuntime();
                break;
            case LLMRuntimeType.REMOTE:
                this.runtime = new RemoteRuntime();
                break;
            default:
                throw new Error(`Unknown runtime type: ${config.runtime}`);
        }

        this.runtime.onProgress = onProgress;
        this.currentConfig = config;
        await this.runtime.initialize(config);
    }

    async generate(prompt: string, options?: GenerationOptions): Promise<string> {
        if (!this.runtime || !this.runtime.isReady) {
            throw new Error("No model loaded");
        }
        return this.runtime.generate(prompt, options);
    }

    isModelLoaded(): boolean {
        return !!(this.runtime && this.runtime.isReady);
    }

    getCurrentConfig(): ModelConfig | null {
        return this.currentConfig;
    }
}
