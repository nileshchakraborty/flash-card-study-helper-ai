// @ts-nocheck
import { BaseView } from './base.view.js';
import { apiService } from '../services/api.service.js';
import { eventBus } from '../utils/event-bus.js';

export class GeneratorView extends BaseView {
  constructor() {
    super();
    this.elements = {
      form: this.getElement('#topic-form'),
      topicInput: this.getElement('#topic-input'),
      cardCount: this.getElement('#card-count'),
      generateBtn: this.getElement('#generate-btn'),
      loadingOverlay: this.getElement('#loading-overlay'),
      deckHistoryList: this.getElement('#deck-history-list'),
      uploadForm: this.getElement('#upload-form'),
      fileInput: this.getElement('#file-upload'),
      uploadBtn: this.getElement('#upload-form button[type="submit"]')
    };

    this.init();
  }

  init() {
    this.bindEvents();
    this.loadDeckHistory();
  }

  bindEvents() {
    // Generate Form
    if (this.elements.form) {
      this.bind(this.elements.form, 'submit', async (e) => {
        e.preventDefault();
        await this.handleGenerate();
      });
    }

    // Topic Input Validation
    if (this.elements.topicInput) {
      this.bind(this.elements.topicInput, 'input', (e) => {
        if (this.elements.generateBtn) {
          this.elements.generateBtn.disabled = e.target.value.trim().length === 0;
        }
      });
    }

    // File Upload
    if (this.elements.uploadForm) {
      this.bind(this.elements.uploadForm, 'submit', async (e) => {
        e.preventDefault();
        await this.handleUpload();
      });
    }

    if (this.elements.fileInput) {
      this.bind(this.elements.fileInput, 'change', () => {
        if (this.elements.uploadBtn) {
          this.elements.uploadBtn.disabled = !this.elements.fileInput.files.length;
        }
      });
    }
  }

  async handleGenerate() {
    const topic = this.elements.topicInput.value;
    const count = this.elements.cardCount.value;

    this.showLoading();
    try {
      console.log('Generating flashcards for:', topic, 'count:', count);
      const data = await apiService.post('/generate', { topic, count });
      console.log('Received response:', data);

      if (data.cards && data.cards.length > 0) {
        console.log('Emitting deck:loaded with', data.cards.length, 'cards');
        eventBus.emit('deck:loaded', data.cards);

        // Save to history
        await apiService.post('/decks', {
          topic,
          cards: data.cards
        });
        this.loadDeckHistory(); // Refresh history
      } else {
        console.error('No cards in response:', data);
        alert('No flashcards were generated. Please try again.');
      }
    } catch (error) {
      console.error('Generation error:', error);
      alert('Failed to generate flashcards. Please try again.');
    } finally {
      this.hideLoading();
    }
  }

  async handleUpload() {
    const file = this.elements.fileInput.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    this.showLoading();
    try {
      // Note: apiService.request handles JSON, but upload needs FormData
      // We'll use fetch directly here or extend apiService later.
      // For now, let's use fetch to keep it simple as it's a special case.
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) throw new Error('Upload failed');

      const data = await response.json();
      if (data.cards) {
        eventBus.emit('deck:loaded', data.cards);

        // Save to history
        await apiService.post('/decks', {
          topic: file.name,
          cards: data.cards
        });
        this.loadDeckHistory();
      }
    } catch (error) {
      alert('Failed to upload file.');
      console.error(error);
    } finally {
      this.hideLoading();
    }
  }

  async loadDeckHistory() {
    try {
      const data = await apiService.get('/decks');
      if (data.history) {
        this.renderDeckHistory(data.history);
      }
    } catch (error) {
      console.error('Failed to load deck history:', error);
    }
  }

  renderDeckHistory(history) {
    if (!this.elements.deckHistoryList) return;

    if (history.length === 0) {
      this.elements.deckHistoryList.innerHTML = '<div class="text-gray-500 text-sm italic">No recent decks found.</div>';
      return;
    }

    this.elements.deckHistoryList.innerHTML = history.map(deck => `
      <div class="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex justify-between items-center">
        <div>
          <h4 class="font-semibold text-gray-800">${deck.topic}</h4>
          <p class="text-xs text-gray-500">${new Date(deck.timestamp).toLocaleDateString()} • ${deck.cards.length} cards</p>
        </div>
        <button data-id="${deck.id}" class="load-deck-btn text-primary hover:text-primary-dark text-sm font-medium">
          Load
        </button>
      </div>
    `).join('');

    // Add event listeners to new buttons
    this.elements.deckHistoryList.querySelectorAll('.load-deck-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const deckId = btn.dataset.id;
        const deck = history.find(d => d.id === deckId);
        if (deck) {
          eventBus.emit('deck:loaded', deck.cards);
        }
      });
    });
  }

  showLoading() {
    this.show(this.elements.loadingOverlay);
  }

  hideLoading() {
    this.hide(this.elements.loadingOverlay);
  }
}
