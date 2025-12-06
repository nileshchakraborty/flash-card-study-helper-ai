import type { AIServicePort } from '../ports/interfaces.js';

/**
 * Configuration for LLM adapter manager
 */
export interface AdapterManagerConfig {
    /**
     * Priority order of adapters to try (comma-separated)
     * Example: 'webllm,ollama,anthropic,google'
     */
    priority?: string;

    /**
     * Default adapter to use if no preference specified
     */
    defaultAdapter?: string;
}

/**
 * Extended interface for LLM adapters with availability checking
 */
export interface LLMAdapter extends AIServicePort {
    /**
     * Unique identifier for this adapter
     */
    readonly name: string;

    /**
     * Check if this adapter is currently available/configured
     */
    isAvailable(): Promise<boolean>;
}

/**
 * Manages multiple LLM adapters with priority-based selection and fallback
 */
export class AdapterManager {
    private adapters: Map<string, LLMAdapter> = new Map();
    private priority: string[];
    private defaultAdapter: string;

    constructor(
        adapters: Record<string, LLMAdapter>,
        config?: AdapterManagerConfig
    ) {
        // Register all adapters
        Object.entries(adapters).forEach(([name, adapter]) => {
            this.adapters.set(name.toLowerCase(), adapter);
        });

        // Parse priority from config or environment
        const priorityStr = config?.priority || process.env.LLM_PRIORITY || 'webllm,ollama';
        this.priority = priorityStr.split(',').map(s => s.trim().toLowerCase());

        // Set default adapter
        this.defaultAdapter = (config?.defaultAdapter || process.env.LLM_DEFAULT_PROVIDER || 'webllm').toLowerCase();
    }

    /**
     * Get the first available adapter based on priority order
     * @param preferredName Optional preferred adapter name to try first
     * @returns Available adapter and its name
     */
    async getAvailableAdapter(preferredName?: string): Promise<{ adapter: LLMAdapter; name: string }> {
        // Try preferred adapter first if specified
        if (preferredName) {
            const normalizedName = preferredName.toLowerCase();
            const adapter = this.adapters.get(normalizedName);

            if (adapter) {
                try {
                    const available = await adapter.isAvailable();
                    if (available) {
                        console.log(`[AdapterManager] Using preferred adapter: ${normalizedName}`);
                        return { adapter, name: normalizedName };
                    }
                } catch (error) {
                    console.warn(`[AdapterManager] Preferred adapter ${normalizedName} failed availability check:`, error);
                }
            }
        }

        // Try adapters in priority order
        for (const name of this.priority) {
            const adapter = this.adapters.get(name);

            if (!adapter) {
                console.warn(`[AdapterManager] Adapter ${name} not registered`);
                continue;
            }

            try {
                const available = await adapter.isAvailable();
                if (available) {
                    console.log(`[AdapterManager] Using adapter from priority list: ${name}`);
                    return { adapter, name };
                } else {
                    console.log(`[AdapterManager] Adapter ${name} is not available, trying next...`);
                }
            } catch (error) {
                console.warn(`[AdapterManager] Adapter ${name} availability check failed:`, error);
                continue;
            }
        }

        // Fallback to default adapter (last resort) - CHECK AVAILABILITY FIRST!
        const defaultAdapterInstance = this.adapters.get(this.defaultAdapter);
        if (defaultAdapterInstance) {
            try {
                const available = await defaultAdapterInstance.isAvailable();
                if (available) {
                    console.warn(`[AdapterManager] All priority adapters unavailable, using default: ${this.defaultAdapter}`);
                    return { adapter: defaultAdapterInstance, name: this.defaultAdapter };
                } else {
                    console.warn(`[AdapterManager] Default adapter ${this.defaultAdapter} is also not available`);
                }
            } catch (error) {
                console.warn(`[AdapterManager] Default adapter ${this.defaultAdapter} availability check failed:`, error);
            }
        }

        // No adapters available - throw descriptive error
        const availableAdapters = Array.from(this.adapters.keys()).join(', ');
        const triedAdapters = this.priority.join(', ');

        throw new Error(
            `No LLM adapters available. ` +
            `Tried (in order): ${triedAdapters}. ` +
            `Default adapter (${this.defaultAdapter}) also unavailable. ` +
            `Registered adapters: ${availableAdapters}. ` +
            `\n\nTo fix this:\n` +
            `1. For Ollama: Ensure Ollama is running and OLLAMA_BASE_URL is correct\n` +
            `2. For Anthropic: Set ANTHROPIC_API_KEY in environment variables\n` +
            `3. For Google: Set GOOGLE_API_KEY in environment variables\n` +
            `4. For Custom LLM: Set CUSTOM_LLM_URL and CUSTOM_LLM_API_KEY\n` +
            `5. For WebLLM: This is client-side only and cannot be used for backend generation`
        );
    }

    /**
     * Execute a function with automatic fallback through adapter priority list
     * Useful for resilient execution with graceful degradation
     */
    async executeWithFallback<T>(
        fn: (adapter: LLMAdapter, name: string) => Promise<T>,
        preferredName?: string
    ): Promise<T> {
        const errors: Array<{ name: string; error: any }> = [];

        // Build list of adapters to try
        const adaptersToTry: string[] = [];

        if (preferredName) {
            adaptersToTry.push(preferredName.toLowerCase());
        }

        adaptersToTry.push(...this.priority.filter(name => name !== preferredName?.toLowerCase()));

        // Try each adapter
        for (const name of adaptersToTry) {
            const adapter = this.adapters.get(name);

            if (!adapter) continue;

            try {
                const available = await adapter.isAvailable();
                if (!available) continue;

                console.log(`[AdapterManager] Executing with adapter: ${name}`);
                return await fn(adapter, name);
            } catch (error) {
                console.warn(`[AdapterManager] Adapter ${name} failed execution:`, error);
                errors.push({ name, error });
                continue;
            }
        }

        // All adapters failed
        throw new Error(
            `All LLM adapters failed execution. Errors: ${errors.map(e => `${e.name}: ${e.error.message}`).join('; ')}`
        );
    }

    /**
     * Get list of all registered adapter names
     */
    getRegisteredAdapters(): string[] {
        return Array.from(this.adapters.keys());
    }

    /**
     * Get the current priority order
     */
    getPriority(): string[] {
        return [...this.priority];
    }
}
