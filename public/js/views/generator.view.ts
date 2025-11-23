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
      uploadBtn: this.getElement('#upload-form button[type="submit"]'),
      useBrowserLLM: this.getElement('#use-browser-llm')
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
    const useBrowser = this.elements.useBrowserLLM && this.elements.useBrowserLLM.checked;

    this.showLoading();
    try {
      console.log('Generating flashcards for:', topic, 'count:', count, 'mode:', useBrowser ? 'browser' : 'server');

      let cards = [];

      if (useBrowser) {
        // Use LLM Orchestrator
        const orchestrator = (window as any).llmOrchestrator;
        if (!orchestrator) {
          throw new Error('LLM Orchestrator not initialized');
        }

        // Ensure model is loaded
        if (!orchestrator.isModelLoaded()) {
          const { config } = orchestrator.getRecommendedStrategy();
          await orchestrator.loadModel(config, (progress, message) => {
            console.log(`Loading model: ${Math.round(progress * 100)}% - ${message}`);
            // Optional: Update UI with progress
          });
        }

        const prompt = `
          You are a helpful study assistant. Create ${count} flashcards about: ${topic}.
          Return ONLY a valid JSON array of objects with "question" and "answer" fields.
          - Do NOT use numbered lists.
          - Do NOT use markdown code blocks.
          - Start directly with '[' and end with ']'.
          
          Example:
          [{"question": "Q1", "answer": "A1"}, {"question": "Q2", "answer": "A2"}]
        `;

        console.log('Generating with Browser LLM...');
        const response = await orchestrator.generate(prompt);
        console.log('LLM Response:', response);

        const rawCards = this.parseLLMResponse(response);
        cards = rawCards.map((c, i) => ({
          id: `gen-${Date.now()}-${i}`,
          front: c.question,
          back: c.answer,
          topic: topic
        }));

      } else {
        const data = await apiService.post('/generate', { topic, count });
        console.log('Received response:', data);
        cards = data.cards || [];
      }

      if (cards && cards.length > 0) {
        console.log('Emitting deck:loaded with', cards.length, 'cards');
        eventBus.emit('deck:loaded', cards);

        // Save to history
        await apiService.post('/decks', {
          topic,
          cards: cards
        });
        this.loadDeckHistory(); // Refresh history
      } else {
        console.error('No cards generated');
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
    const files = this.elements.fileInput.files;
    if (!files || files.length === 0) return;

    this.showLoading();
    try {
      // Import dynamically to avoid circular deps if any, or just standard import
      const { FileProcessingService } = await import('../services/FileProcessingService.js');

      console.log('Processing', files.length, 'files...');
      const text = await FileProcessingService.processFiles(Array.from(files));
      console.log('Extracted text length:', text.length);

      if (!text.trim()) {
        throw new Error('No text could be extracted from the files.');
      }

      // Use LLM Orchestrator
      const orchestrator = (window as any).llmOrchestrator;
      if (!orchestrator) {
        throw new Error('LLM Orchestrator not initialized');
      }

      // Ensure model is loaded (if not, it might try to load default or fail)
      // Ideally we check orchestrator.isModelLoaded() or load a default
      if (!orchestrator.isModelLoaded()) {
        // Trigger load of recommended model? 
        // For now, let's assume the user has set it up or we force a default remote/local load
        const { config } = orchestrator.getRecommendedStrategy();
        await orchestrator.loadModel(config);
      }

      const topic = this.elements.uploadForm.querySelector('#upload-topic')?.value || 'Uploaded Content';

      const prompt = `
        You are a helpful study assistant. Create 10 flashcards from the provided text about: ${topic}.
        
        Text:
        ${text.substring(0, 15000)} 
        
        Return ONLY a valid JSON array of objects with "question" and "answer" fields.
        - Do NOT use numbered lists.
        - Do NOT use markdown code blocks.
        - Start directly with '[' and end with ']'.
        
        Example:
        [{"question": "Q1", "answer": "A1"}, {"question": "Q2", "answer": "A2"}]
      `;

      console.log('Generating flashcards with LLM...');
      const response = await orchestrator.generate(prompt);
      console.log('LLM Response:', response);

      // Parse JSON from response
      const cards = this.parseLLMResponse(response);

      if (cards.length > 0) {
        // Format cards
        const formattedCards = cards.map((c, i) => ({
          id: `upload-${Date.now()}-${i}`,
          front: c.question,
          back: c.answer,
          topic: topic
        }));

        eventBus.emit('deck:loaded', formattedCards);

        // Save to history
        await apiService.post('/decks', {
          topic: topic,
          cards: formattedCards
        });
        this.loadDeckHistory();
      } else {
        throw new Error('Failed to generate valid flashcards from response');
      }

    } catch (error) {
      alert('Failed to process files: ' + error.message);
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

  parseLLMResponse(response) {
    let cards = [];
    try {
      // Simple extraction
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        cards = JSON.parse(jsonMatch[0]);
      } else {
        cards = JSON.parse(response);
      }
    } catch (e) {
      console.warn('Failed to parse LLM response directly, trying regex fallback');
      // Fallback regex
      const objectRegex = /\{\s*"question"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"answer"\s*:\s*"((?:[^"\\]|\\.)*)"\s*\}/g;
      let match;
      while ((match = objectRegex.exec(response)) !== null) {
        try {
          cards.push({
            question: JSON.parse(`"${match[1]}"`),
            answer: JSON.parse(`"${match[2]}"`)
          });
        } catch (e) { }
      }
    }

    // Text Format Fallback (Question: ... Answer: ...)
    if (cards.length === 0) {
      const textRegex = /(?:^|\n)\s*(?:\d+\.\s*)?(?:\*\*)?(?:Card|Question)(?:\*\*)?:?\s*(.+?)\s*(?:\*\*)?Answer(?:\*\*)?:?\s*(.+?)(?=(?:\n\s*(?:\d+\.|\[Card|\*\*Card)|$))/gis;
      let textMatch;
      while ((textMatch = textRegex.exec(response)) !== null) {
        const question = textMatch[1].trim();
        const answer = textMatch[2].trim();
        if (question && answer) {
          cards.push({ question, answer });
        }
      }
    }
    return cards;
  }

  showLoading() {
    this.show(this.elements.loadingOverlay);
  }

  hideLoading() {
    this.hide(this.elements.loadingOverlay);
  }
}
