import { AppController } from './controllers/app.controller.js';
import { LLMOrchestrator } from './services/llm/LLMOrchestrator';
import { ModelManagerUI } from './controllers/ModelManagerUI';

document.addEventListener('DOMContentLoaded', async () => {
  const app = new AppController();
  (window as any).app = app;

  // Initialize LLM Orchestrator
  const orchestrator = new LLMOrchestrator();
  await orchestrator.initialize();
  (window as any).llmOrchestrator = orchestrator;

  // Initialize Model Manager UI
  const modelManager = new ModelManagerUI(orchestrator);
  modelManager.initialize();
});
