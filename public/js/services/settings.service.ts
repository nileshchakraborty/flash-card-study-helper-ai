// @ts-nocheck
const RUNTIME_KEY = 'PREFERRED_RUNTIME';

export type RuntimePref = 'ollama' | 'webllm';

export const settingsService = {
  getPreferredRuntime(): RuntimePref {
    const stored = localStorage.getItem(RUNTIME_KEY);
    return stored === 'webllm' ? 'webllm' : 'ollama';
  },
  setPreferredRuntime(runtime: RuntimePref) {
    localStorage.setItem(RUNTIME_KEY, runtime);
  }
};
