// @ts-nocheck
const RUNTIME_KEY = 'PREFERRED_RUNTIME';
const MODEL_MANAGER_KEY = 'MODEL_MANAGER_ENABLED';

export type RuntimePref = 'ollama' | 'webllm';

export const settingsService = {
  getPreferredRuntime(): RuntimePref {
    const stored = localStorage.getItem(RUNTIME_KEY);
    // Default to 'webllm' (Browser/Client-side) for faster local inference
    // Falls back to 'ollama' if explicitly set by user
    return stored === 'ollama' ? 'ollama' : 'webllm';
  },
  setPreferredRuntime(runtime: RuntimePref) {
    localStorage.setItem(RUNTIME_KEY, runtime);
  },

  getModelManagerEnabled(): boolean {
    const stored = localStorage.getItem(MODEL_MANAGER_KEY);
    if (stored === null) return true; // default enabled
    return stored === 'false';
  },
  setModelManagerEnabled(enabled: boolean) {
    localStorage.setItem(MODEL_MANAGER_KEY, enabled ? 'false' : 'true');
  },

  // Custom LLM Settings
  getCustomLlmUrl(): string {
    return localStorage.getItem('LLM_CUSTOM_URL') || '';
  },
  setCustomLlmUrl(url: string) {
    localStorage.setItem('LLM_CUSTOM_URL', url);
  },

  getCustomLlmModel(): string {
    return localStorage.getItem('LLM_CUSTOM_MODEL') || '';
  },
  setCustomLlmModel(model: string) {
    localStorage.setItem('LLM_CUSTOM_MODEL', model);
  },

  getCustomLlmApiKey(): string { // Added for completeness, though security warning needed in UI
    return localStorage.getItem('LLM_CUSTOM_KEY') || '';
  },
  setCustomLlmApiKey(key: string) {
    localStorage.setItem('LLM_CUSTOM_KEY', key);
  }
};
