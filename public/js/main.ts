import { AppController } from './controllers/app.controller.js';
import { LLMOrchestrator } from './services/llm/LLMOrchestrator';
import { ModelManagerUI } from './controllers/ModelManagerUI';
import { injectSpeedInsights } from '@vercel/speed-insights';
import { apiService } from './services/api.service.js';
import { graphqlService } from './services/graphql.service.js';
import { settingsService } from './services/settings.service.js';

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
  const settingsBtn = document.getElementById('settings-btn');
  const settingsModal = document.getElementById('settings-modal');
  const settingsClose = document.getElementById('settings-close');
  const settingsCancel = document.getElementById('settings-cancel');
  const settingsSave = document.getElementById('settings-save');
  const runtimeRadios = Array.from(document.querySelectorAll('.runtime-radio')) as HTMLInputElement[];
  const navToggle = document.getElementById('nav-toggle');
  const navLinks = document.getElementById('nav-links');

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

  const openSettings = () => {
    const pref = settingsService.getPreferredRuntime();
    runtimeRadios.forEach(r => r.checked = r.value === pref);
    settingsModal?.classList.remove('hidden');
    settingsModal?.classList.add('flex');
  };
  const closeSettings = () => {
    settingsModal?.classList.add('hidden');
    settingsModal?.classList.remove('flex');
  };

  settingsBtn?.addEventListener('click', openSettings);
  settingsClose?.addEventListener('click', closeSettings);
  settingsCancel?.addEventListener('click', closeSettings);
  settingsSave?.addEventListener('click', () => {
    const selected = runtimeRadios.find(r => r.checked);
    if (selected) settingsService.setPreferredRuntime(selected.value as any);
    closeSettings();
  });

  // Hamburger toggle
  navToggle?.addEventListener('click', () => {
    navLinks?.classList.toggle('hidden');
    navLinks?.classList.toggle('flex');
    navLinks?.classList.toggle('flex-col');
  });
});
