import type { ModelConfig } from './types.js';
import { LLMRuntimeType } from './types.js';

export class ModelRegistry {
    static readonly MODELS: Record<string, ModelConfig> = {
        'llama-3-8b-q4': {
            id: 'Llama-3-8B-Instruct-q4f16_1-MLC',
            name: 'Llama 3 8B Instruct (MLC q4f16_1)',
            sizeMB: 4500,
            runtime: LLMRuntimeType.WEB_LLM,
            family: 'llama-3',
            quantization: 'q4f16_1'
        },
        'phi-2-q4': {
            id: 'Phi-3-mini-4k-instruct-q4f16_1-MLC',
            name: 'Phi-3 Mini 4K Instruct (MLC q4f16_1)',
            sizeMB: 1800,
            runtime: LLMRuntimeType.WEB_LLM,
            family: 'phi-3',
            quantization: 'q4f16_1'
        },
        'tiny-llama-1.1b': {
            id: 'tiny-llama-1.1b',
            name: 'TinyLlama 1.1B',
            sizeMB: 600,
            runtime: LLMRuntimeType.TRANSFORMERS,
            family: 'tiny-llama'
        },
        'remote-gpt-4o-mini': {
            id: 'remote-gpt-4o-mini',
            name: 'GPT-4o Mini (Remote)',
            sizeMB: 0,
            runtime: LLMRuntimeType.REMOTE,
            family: 'gpt-4'
        }
    };

    static getRecommendedModel(tier: 'high' | 'mid' | 'low'): ModelConfig {
        switch (tier) {
            case 'high':
                return this.MODELS['phi-2-q4']!; // Safer default than 8B for "High" but not "Ultra"
            case 'mid':
                return this.MODELS['tiny-llama-1.1b']!;
            case 'low':
            default:
                return this.MODELS['remote-gpt-4o-mini']!;
        }
    }
}
