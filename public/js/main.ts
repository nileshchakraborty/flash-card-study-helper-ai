import { AppController } from './controllers/app.controller.js';
import { LLMOrchestrator } from './services/llm/LLMOrchestrator';
import { ModelManagerUI } from './controllers/ModelManagerUI';
import { injectSpeedInsights } from '@vercel/speed-insights';
import { apiService } from './services/api.service.js';
import { graphqlService } from './services/graphql.service.js';
import { settingsService } from './services/settings.service.js';
import { eventBus } from './utils/event-bus.js';
import SkeletonLoader from './components/SkeletonLoader.js';

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

  const landingPage = document.getElementById('landing-page');
  const appContent = document.getElementById('app-content');

  if (apiService.isAuthenticated()) {
    landingPage?.classList.add('hidden');
    appContent?.classList.remove('hidden');

    const app = new AppController();
    (window as any).app = app;

    // Initialize LLM Orchestrator
    const orchestrator = new LLMOrchestrator();
    await orchestrator.initialize();
    (window as any).llmOrchestrator = orchestrator;

    // Model Manager is opt-in
    let modelManager: ModelManagerUI | null = null;
    let modelManagerInitialized = false;
    const ensureModelManager = () => {
      if (!modelManagerInitialized) {
        modelManager = new ModelManagerUI(orchestrator);
        modelManager.initialize();
        modelManagerInitialized = true;
      }
    };

    // Auto-enable model manager if user previously opted in
    if (settingsService.getModelManagerEnabled()) {
      ensureModelManager();
    }

    // Setup Settings Modal Logic (only needed if logged in)
    setupSettingsModal(ensureModelManager);

  } else {
    landingPage?.classList.remove('hidden');
    appContent?.classList.add('hidden');
    // Don't initialize app controllers if not logged in
  }

  // Setup login/logout button state (for both views if needed, but mainly app view)
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
        window.location.reload();
      } else {
        window.location.href = '/api/auth/google';
      }
    };
  };

  renderAuthState();

  // Hamburger toggle
  const navToggle = document.getElementById('nav-toggle');
  const navLinks = document.getElementById('nav-links');
  navToggle?.addEventListener('click', () => {
    navLinks?.classList.toggle('hidden');
    navLinks?.classList.toggle('flex');
    navLinks?.classList.toggle('flex-col');
  });

  // Expose eventBus for inline handlers (legacy refresh button)
  (window as any).eventBus = eventBus;
  (window as any).apiService = apiService;
  // Expose models for E2E testing
  import('./models/quiz.model.js').then(({ quizModel }) => {
    (window as any).quizModel = quizModel;
  });
});

function setupSettingsModal(ensureModelManager: () => void) {
  const settingsBtn = document.getElementById('settings-btn');
  const settingsModal = document.getElementById('settings-modal');
  const settingsClose = document.getElementById('settings-close');
  const settingsCancel = document.getElementById('settings-cancel');
  const settingsSave = document.getElementById('settings-save');
  const runtimeRadios = Array.from(document.querySelectorAll('.runtime-radio')) as HTMLInputElement[];
  const modelManagerToggle = document.getElementById('model-manager-enabled') as HTMLInputElement | null;

  const openSettings = () => {
    const pref = settingsService.getPreferredRuntime();
    runtimeRadios.forEach(r => r.checked = r.value === pref);
    if (modelManagerToggle) modelManagerToggle.checked = settingsService.getModelManagerEnabled();
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
    if (modelManagerToggle) {
      const enabled = modelManagerToggle.checked;
      settingsService.setModelManagerEnabled(enabled);
      if (enabled) ensureModelManager();
    }
    closeSettings();
  });
}
