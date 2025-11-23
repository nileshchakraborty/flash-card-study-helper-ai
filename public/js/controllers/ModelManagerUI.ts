import { LLMOrchestrator } from '../services/llm/LLMOrchestrator';
import type { ModelConfig } from '../services/llm/types.js';

export class ModelManagerUI {
    private orchestrator: LLMOrchestrator;
    private container: HTMLElement | null = null;
    private statusElement: HTMLElement | null = null;
    private progressBar: HTMLElement | null = null;
    private progressFill: HTMLElement | null = null;
    private progressText: HTMLElement | null = null;
    private enableBtn: HTMLButtonElement | null = null;

    constructor(orchestrator: LLMOrchestrator) {
        this.orchestrator = orchestrator;
    }

    initialize() {
        this.createUI();
        this.updateStatus();
    }

    private createUI() {
        // Create a floating widget or modal
        this.container = document.createElement('div');
        this.container.className = 'fixed bottom-4 right-4 bg-white rounded-lg shadow-xl border border-gray-200 p-4 z-50 w-80 transition-all transform translate-y-0';
        this.container.id = 'llm-manager-ui';

        this.container.innerHTML = `
            <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-2">
                    <span class="material-icons text-indigo-600">psychology</span>
                    <h3 class="font-semibold text-gray-800">AI Model Manager</h3>
                </div>
                <button id="minimize-llm-ui" class="text-gray-400 hover:text-gray-600">
                    <span class="material-icons">expand_more</span>
                </button>
            </div>
            
            <div id="llm-status-content">
                <div class="mb-3">
                    <p class="text-sm text-gray-600 mb-1">Current Mode:</p>
                    <div id="llm-mode-badge" class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        Detecting...
                    </div>
                </div>

                <div id="llm-download-section" class="hidden">
                    <p class="text-xs text-gray-500 mb-2">
                        A local model is available for your device. 
                        <span id="model-size-info"></span>
                    </p>
                    <button id="enable-local-ai" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium py-2 px-4 rounded transition-colors flex items-center justify-center gap-2">
                        <span class="material-icons text-sm">download</span>
                        Enable Offline AI
                    </button>
                </div>

                <div id="llm-progress-section" class="hidden mt-3">
                    <div class="flex justify-between text-xs text-gray-600 mb-1">
                        <span>Downloading model...</span>
                        <span id="llm-progress-text">0%</span>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-2">
                        <div id="llm-progress-fill" class="bg-indigo-600 h-2 rounded-full transition-all duration-300" style="width: 0%"></div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(this.container);

        // Bind elements
        this.statusElement = this.container.querySelector('#llm-mode-badge');
        this.progressBar = this.container.querySelector('#llm-progress-section');
        this.progressFill = this.container.querySelector('#llm-progress-fill');
        this.progressText = this.container.querySelector('#llm-progress-text');
        this.enableBtn = this.container.querySelector('#enable-local-ai') as HTMLButtonElement;

        // Bind events
        this.enableBtn?.addEventListener('click', () => this.handleEnableClick());

        const minimizeBtn = this.container.querySelector('#minimize-llm-ui');
        minimizeBtn?.addEventListener('click', () => {
            this.container?.classList.toggle('translate-y-[calc(100%-3rem)]');
            const icon = minimizeBtn.querySelector('.material-icons');
            if (icon) {
                icon.textContent = icon.textContent === 'expand_more' ? 'expand_less' : 'expand_more';
            }
        });
    }

    private async updateStatus() {
        try {
            const { tier, config } = this.orchestrator.getRecommendedStrategy();
            const currentConfig = this.orchestrator.getCurrentConfig();
            const isLoaded = this.orchestrator.isModelLoaded();

            if (this.statusElement) {
                if (isLoaded && currentConfig) {
                    this.statusElement.className = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800';
                    this.statusElement.textContent = `Active: ${currentConfig.name}`;
                } else {
                    this.statusElement.className = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800';
                    this.statusElement.textContent = `Ready: ${config.name} (${tier} tier)`;
                }
            }

            const downloadSection = this.container?.querySelector('#llm-download-section');
            const sizeInfo = this.container?.querySelector('#model-size-info');

            if (downloadSection && sizeInfo && !isLoaded && config.runtime !== 'remote') {
                downloadSection.classList.remove('hidden');
                sizeInfo.textContent = `(~${Math.round(config.sizeMB)} MB)`;
            } else if (downloadSection) {
                downloadSection.classList.add('hidden');
            }

        } catch (e) {
            console.error("Error updating UI status:", e);
        }
    }

    private async handleEnableClick() {
        const { config } = this.orchestrator.getRecommendedStrategy();

        if (this.progressBar) this.progressBar.classList.remove('hidden');
        if (this.enableBtn) this.enableBtn.disabled = true;

        try {
            await this.orchestrator.loadModel(config, (progress, message) => {
                if (this.progressFill) this.progressFill.style.width = `${progress}%`;
                if (this.progressText) this.progressText.textContent = `${progress}%`;
            });

            // Success
            this.updateStatus();
            if (this.progressBar) this.progressBar.classList.add('hidden');

        } catch (error) {
            console.error("Failed to load model:", error);
            if (this.progressText) this.progressText.textContent = "Error!";
            if (this.enableBtn) this.enableBtn.disabled = false;
        }
    }
}
