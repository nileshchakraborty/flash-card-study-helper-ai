import { AppController } from './controllers/app.controller.js';
import { LLMOrchestrator } from './services/llm/LLMOrchestrator';
import { ModelManagerUI } from './controllers/ModelManagerUI';
import { injectSpeedInsights } from '@vercel/speed-insights';
import { apiService } from './services/api.service.js';
import { graphqlService } from './services/graphql.service.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize Speed Insights
  injectSpeedInsights();

  // Capture token from OAuth redirect (?token=...) before anything else
  const urlParams = new URLSearchParams(window.location.search);
  const tokenFromUrl = urlParams.get('token');
  if (tokenFromUrl) {
    localStorage.setItem('authToken', tokenFromUrl);
    graphqlService.updateHeaders();
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  const app = new AppController();
  (window as any).app = app;

  // Initialize LLM Orchestrator
  const orchestrator = new LLMOrchestrator();
  await orchestrator.initialize();
  (window as any).llmOrchestrator = orchestrator;

  // Initialize Model Manager UI
  const modelManager = new ModelManagerUI(orchestrator);
  modelManager.initialize();

  // Setup login/logout button state
  const authBtn = document.getElementById('auth-btn');
  const labelEl = document.getElementById('auth-btn-label');

  const renderAuthState = () => {
    if (!authBtn || !labelEl) return;
    const isAuthed = apiService.isAuthenticated();
    labelEl.textContent = isAuthed ? 'Logout' : 'Login';
    authBtn.onclick = () => {
      if (isAuthed) {
        localStorage.removeItem('authToken');
        graphqlService.updateHeaders();
        // Simple refresh to reset app state and buttons
        window.location.reload();
      } else {
        window.location.href = '/api/auth/google';
      }
    };
  };

  renderAuthState();
});
