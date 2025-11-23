/**
 * ConfigurationService - Centralized configuration management
 * Manages AI runtime mode, knowledge source, and persists user preferences
 */

export type RuntimeMode = 'local' | 'external' | 'auto';
export type KnowledgeSource = 'ai-only' | 'web-only' | 'ai-web';

export interface AppConfiguration {
    runtime: RuntimeMode;
    knowledgeSource: KnowledgeSource;
    selectedModelId?: string;
}

type ConfigChangeCallback = (config: AppConfiguration) => void;

class ConfigurationServiceClass {
    private config: AppConfiguration;
    private subscribers: Set<ConfigChangeCallback> = new Set();
    private readonly STORAGE_KEY = 'mindflip-ai-config';

    constructor() {
        // Load from localStorage or use defaults
        this.config = this.loadConfig();
    }

    private loadConfig(): AppConfiguration {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                console.log('📋 Loaded config from localStorage:', parsed);
                return {
                    runtime: parsed.runtime || 'auto',
                    knowledgeSource: parsed.knowledgeSource || 'ai-web',
                    selectedModelId: parsed.selectedModelId
                };
            }
        } catch (e) {
            console.warn('Failed to load config from localStorage:', e);
        }

        // Defaults
        const defaults: AppConfiguration = {
            runtime: 'auto',
            knowledgeSource: 'ai-web'
        };
        console.log('📋 Using default config:', defaults);
        return defaults;
    }

    private saveConfig(): void {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.config));
            console.log('💾 Saved config to localStorage:', this.config);
        } catch (e) {
            console.error('Failed to save config to localStorage:', e);
        }
    }

    private notifySubscribers(): void {
        this.subscribers.forEach(callback => {
            try {
                callback(this.config);
            } catch (e) {
                console.error('Error in config subscriber:', e);
            }
        });
    }

    // Getters
    getConfig(): AppConfiguration {
        return { ...this.config };
    }

    getRuntime(): RuntimeMode {
        return this.config.runtime;
    }

    getKnowledgeSource(): KnowledgeSource {
        return this.config.knowledgeSource;
    }

    getSelectedModelId(): string | undefined {
        return this.config.selectedModelId;
    }

    // Setters
    setRuntime(mode: RuntimeMode): void {
        console.log(`🔧 Setting runtime mode: ${mode}`);
        this.config.runtime = mode;
        this.saveConfig();
        this.notifySubscribers();
    }

    setKnowledgeSource(source: KnowledgeSource): void {
        console.log(`🔧 Setting knowledge source: ${source}`);
        this.config.knowledgeSource = source;
        this.saveConfig();
        this.notifySubscribers();
    }

    setSelectedModelId(modelId: string | undefined): void {
        console.log(`🔧 Setting selected model: ${modelId}`);
        this.config.selectedModelId = modelId;
        this.saveConfig();
        this.notifySubscribers();
    }

    setConfig(config: Partial<AppConfiguration>): void {
        console.log('🔧 Updating config:', config);
        this.config = { ...this.config, ...config };
        this.saveConfig();
        this.notifySubscribers();
    }

    // Subscription
    subscribe(callback: ConfigChangeCallback): () => void {
        this.subscribers.add(callback);
        // Return unsubscribe function
        return () => {
            this.subscribers.delete(callback);
        };
    }

    // Reset to defaults
    reset(): void {
        console.log('🔄 Resetting config to defaults');
        this.config = {
            runtime: 'auto',
            knowledgeSource: 'ai-web'
        };
        this.saveConfig();
        this.notifySubscribers();
    }

    // Helper to determine actual runtime (resolve 'auto')
    resolveRuntime(deviceCapabilities: any): 'local' | 'external' {
        if (this.config.runtime === 'local') return 'local';
        if (this.config.runtime === 'external') return 'external';

        // Auto mode: decide based on device capabilities
        // High-tier devices can handle local AI
        const tier = deviceCapabilities?.tier || 'low';
        return (tier === 'high' || tier === 'medium') ? 'local' : 'external';
    }
}

// Singleton instance
export const ConfigurationService = new ConfigurationServiceClass();
