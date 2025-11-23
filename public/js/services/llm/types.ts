export interface DeviceCapabilities {
    hasWebGPU: boolean;
    hasWebGL: boolean;
    memoryEstimate: number; // in GB
    isMobile: boolean;
    isOnCellular: boolean;
}

export enum LLMRuntimeType {
    WEB_LLM = 'web_llm', // WebGPU
    TRANSFORMERS = 'transformers', // WASM
    REMOTE = 'remote' // API
}

export interface ModelConfig {
    id: string;
    name: string;
    sizeMB: number;
    runtime: LLMRuntimeType;
    family: string; // e.g., "llama-3", "phi-2"
    quantization?: string; // e.g., "q4f16_1"
}

export interface GenerationOptions {
    maxTokens?: number;
    temperature?: number;
    topP?: number;
    stopSequences?: string[];
    streamCallback?: (token: string) => void;
}

export interface LLMRuntime {
    type: LLMRuntimeType;
    isReady: boolean;

    initialize(config: ModelConfig): Promise<void>;
    generate(prompt: string, options?: GenerationOptions): Promise<string>;
    unload(): Promise<void>;

    // Progress for downloading/loading
    onProgress?: (progress: number, message: string) => void;
}

export interface LLMStrategy {
    tier: 'high' | 'mid' | 'low';
    recommendedRuntime: LLMRuntimeType;
    recommendedModelId: string;
}
