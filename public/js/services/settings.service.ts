// @ts-nocheck
const RUNTIME_KEY = 'PREFERRED_RUNTIME';
const MODEL_MANAGER_KEY = 'MODEL_MANAGER_ENABLED';

export type RuntimePref = 'ollama' | 'webllm';

export const settingsService = {
  getPreferredRuntime(): RuntimePref {
    const stored = localStorage.getItem(RUNTIME_KEY);
    return stored === 'webllm' ? 'webllm' : 'ollama';
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
  }
};
