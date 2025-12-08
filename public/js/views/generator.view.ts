import { BaseView } from './base.view.js';
import { apiService } from '../services/api.service.js';
import { eventBus } from '../utils/event-bus.js';
import type { Flashcard } from '../models/deck.model.js';
import { settingsService } from '../services/settings.service.js';

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
      fileInput: this.getElement('#file-input'),
      uploadArea: this.getElement('#upload-area'),
      selectedFilesContainer: this.getElement('#selected-files'),
      fileList: this.getElement('#file-list'),
      uploadBtn: this.getElement('#upload-form button[type="submit"]'),
      uploadQuizBtn: this.getElement('#upload-quiz-btn'),
      uploadTopic: this.getElement('#upload-topic')
    };
    this.selectedFiles = [];
    this.lastUploadedCards = [];

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

    if (this.elements.uploadQuizBtn) {
      this.bind(this.elements.uploadQuizBtn, 'click', async () => {
        if (!this.lastUploadedCards || this.lastUploadedCards.length === 0) {
          alert('Upload and generate flashcards first, then take a quiz.');
          return;
        }
        // Ensure deck is set to these cards
        eventBus.emit('deck:loaded', this.lastUploadedCards);
        eventBus.emit('quiz:request-start', { count: this.lastUploadedCards.length, topic: this.lastUploadedCards[0]?.topic || 'Uploaded Content' });
      });
    }

    if (this.elements.fileInput) {
      this.bind(this.elements.fileInput, 'change', (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length) {
          this.selectedFiles.push(...files);
          this.refreshFileList();
        }
      });
    }

    if (this.elements.uploadArea) {
      this.bind(this.elements.uploadArea, 'click', () => this.elements.fileInput?.click());
      ['dragover', 'dragenter'].forEach(evt => {
        this.bind(this.elements.uploadArea, evt, (ev) => { ev.preventDefault(); this.elements.uploadArea.classList.add('border-purple-400'); });
      });
      ['dragleave', 'drop'].forEach(evt => {
        this.bind(this.elements.uploadArea, evt, (ev) => { ev.preventDefault(); this.elements.uploadArea.classList.remove('border-purple-400'); });
      });
      this.bind(this.elements.uploadArea, 'drop', (ev) => {
        const files = Array.from(ev.dataTransfer?.files || []);
        if (files.length) {
          this.selectedFiles.push(...files);
          this.refreshFileList();
        }
      });
    }
  }

  async handleGenerate() {
    const topic = this.elements.topicInput.value;
    const countRaw = this.elements.cardCount.value;
    const count = Math.max(1, parseInt(countRaw || '1', 10));
    // Determine runtime based on settings
    const orchestrator = (window as any).llmOrchestrator;
    const prefersBrowser = settingsService.getPreferredRuntime() === 'webllm' && !!orchestrator;
    const useBrowser = prefersBrowser; // single flag
    const runtime = useBrowser ? 'webllm' : 'ollama';

    this.showLoading();
    try {
      let cards = [];
      let usedBackend = false;

      if (useBrowser) {
        console.log('Generating flashcards for:', topic, 'count:', count, 'runtime: webllm (client-side)');
        this.updateLoadingProgress(5, 'Loading browser model...');

        const orchestrator = (window as any).llmOrchestrator;
        if (!orchestrator) {
          throw new Error('LLM Orchestrator not initialized for client-side generation.');
        }

        // Ensure model is loaded (if not, it might try to load default or fail)
        if (!orchestrator.isModelLoaded()) {
          const { config } = orchestrator.getRecommendedStrategy();
          await orchestrator.loadModel(config);
        }

        this.updateLoadingProgress(15, 'Generating locally...');

        const prompt = `You must generate flashcards in STRICT JSON format.

TASK: Create exactly ${count} flashcards about: "${topic}"

CRITICAL RULES:
- Output MUST start with <<<JSON_START>>>
- Output MUST end with <<<JSON_END>>>
- Between markers: ONLY a valid JSON array
- Each object needs "question" and "answer" fields
- NO explanations, NO other text, ONLY JSON
- DO NOT write code, examples, markdown, or instructions outside the JSON array.

REQUIRED FORMAT:
<<<JSON_START>>>
[
  {"question": "...", "answer": "..."},
  {"question": "...", "answer": "..."}
]
<<<JSON_END>>>

EXAMPLES:
Topic: "Python Programming"
<<<JSON_START>>>
[
  {"question": "What is a Python list?", "answer": "An ordered, mutable collection of items"},
  {"question": "How do you define a function in Python?", "answer": "Using the 'def' keyword followed by function name and parentheses"}
]
<<<JSON_END>>>

Topic: "World History"
<<<JSON_START>>>
[
  {"question": "When did World War II begin?", "answer": "September 1, 1939"},
  {"question": "Who was the first president of the United States?", "answer": "George Washington"}
]
<<<JSON_END>>>

NOW create ${count} flashcards about "${topic}" following this EXACT format:`;

        console.log('Generating flashcards with client-side LLM...');
        const response = await orchestrator.generate(prompt);
        console.log('Client-side LLM Response:', response);

        try {
          cards = this.parseLLMResponseStrict(response, count);
        } catch (e) {
          console.warn('Client-side parsing error, will fallback to backend:', e);
          cards = [];
        }

        console.log(`Parsed ${cards.length} raw cards (strict), expected: ${count}`);

        // If client-side failed or count mismatched, fallback to backend queue
        if (cards.length !== count) {
          this.updateLoadingProgress(35, 'Switching to backend for reliable generation...');
          usedBackend = true;
          const backendResponse = await apiService.generateFlashcards({ topic, count, runtime: 'ollama', knowledgeSource: 'ai-web' });

          let backendResult = backendResponse;
          if ((!backendResponse.cards || backendResponse.cards.length === 0) && backendResponse.jobId) {
            backendResult = await apiService.waitForJobResult(backendResponse.jobId, {
              maxWaitMs: 180000,
              pollIntervalMs: 2000,
              onProgress: (p) => this.updateLoadingProgress(p, 'Generating on server...')
            });
          }

          cards = (backendResult?.cards || []).slice(0, count);
        }

        // Enforce requested count client-side - final check
        if (cards.length > count) {
          cards = cards.slice(0, count);
        }

        if (cards.length > 0) {
          this.updateLoadingProgress(95, usedBackend ? 'Finalizing server results...' : 'Finalizing local results...');
          // Robust mapping to handle various property names
          cards = cards.map((c, i) => {
            // Try to find the question and answer in common properties
            const question = c.question || c.questions || c.front || c.term || c.concept || "Question missing";
            const answer = c.answer || c.answers || c.back || c.definition || c.description || "Answer missing";

            return {
              id: `gen-${Date.now()}-${i}`,
              front: question,
              back: answer,
              topic: topic
            };
          });

          // Filter out cards where both sides are missing or placeholders
          cards = cards.filter(c =>
            (c.front !== "Question missing" || c.back !== "Answer missing") &&
            c.front !== "Q1" && c.front !== "Q2" // Reject template placeholders
          );
        }

      } else {
        console.log('Generating flashcards for:', topic, 'count:', count, 'runtime: ollama (server-side)');

        // Get configuration
        const { ConfigurationService } = await import('../services/ConfigurationService.js');
        const knowledgeSource = ConfigurationService.getKnowledgeSource();

        // Use hybrid method - supports both GraphQL and REST
        this.updateLoadingProgress(10, 'Queuing backend job...');

        const data = await apiService.generateFlashcards({
          topic,
          count,
          runtime: useBrowser ? 'webllm' : 'ollama',
          knowledgeSource
        });
        let backendResult = data;

        if ((!data.cards || data.cards.length === 0) && data.jobId) {
          backendResult = await apiService.waitForJobResult(data.jobId, {
            maxWaitMs: 180000,
            pollIntervalMs: 2000,
            onProgress: (p) => this.updateLoadingProgress(p, 'Waiting for backend to finish...')
          });
        }

        cards = (backendResult?.cards || []);
        console.log('Received response from backend:', data);

        // Enforce requested count in case backend over-returns
        if (cards.length > count) {
          cards = cards.slice(0, count);
        }
      }

      if (cards.length > 0) {
        this.updateLoadingProgress(100, 'Flashcards ready!');
        console.log('Emitting deck:loaded with', cards.length, 'cards');
        eventBus.emit('deck:loaded', cards);

        // Save to history
        await apiService.post('/decks', {
          topic,
          cards: cards
        });
        this.loadDeckHistory(); // Refresh history

        // Poll for recommendations in background
        this.pollForRecommendations(topic);
      } else {
        console.error('No cards generated');
        alert('No flashcards were generated. Please try again.');
      }
    } catch (error) {
      console.error('Generation error:', error);
      if (error?.message?.includes('Unauthorized')) {
        alert('Your session expired. Please log in again to generate flashcards.');
        window.location.href = '/api/auth/google';
      } else {
        alert('Failed to generate flashcards. Please try again. Error: ' + (error.message || error));
      }
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

      const prompt = `You are a strict JSON generator.
IMPORTANT: Use ONLY the provided text. Do NOT use the internet or outside knowledge. If information is missing, answer with "Not specified in the provided PDF".
TASK: Create 10 educational flashcards about "${topic}".

Text (from uploaded files only):
${text.substring(0, 15000)}

OUTPUT RULES:
1. Output ONLY a raw JSON array of objects.
2. Start with <<<JSON_START>>> and end with <<<JSON_END>>>.
3. DO NOT output separate arrays for questions and answers.

EXAMPLE:
<<<JSON_START>>>
[
  { "question": "What is the main idea?", "answer": "The central concept of the text." }
]
<<<JSON_END>>>

Generate the JSON array now:`;

      console.log('Generating flashcards with LLM...');
      const response = await orchestrator.generate(prompt);
      console.log('LLM Response:', response);

      // Parse JSON from response
      let cards = this.parseLLMResponse(response);
      console.log('Parsed raw cards (upload):', JSON.stringify(cards, null, 2));

      if (cards.length === 0) {
        throw new Error('Failed to generate valid flashcards from response');
      }

      const formattedCards = cards.map((c, i) => {
        const question = c.question || c.questions || c.front || c.term || c.concept || `Card ${i + 1}`;
        const answer = c.answer || c.answers || c.back || c.definition || c.description || 'Answer not provided';
        return {
          id: `upload-${Date.now()}-${i}`,
          front: question,
          back: answer,
          topic: topic
        };
      }).filter(c => (c.front && c.back));

      // Remember last uploaded batch for quiz
      this.lastUploadedCards = formattedCards;

      eventBus.emit('deck:loaded', formattedCards);

      // Save to history
      await apiService.post('/decks', {
        topic: topic,
        cards: formattedCards
      });
      this.loadDeckHistory();

      if (confirm('Flashcards created from PDF/images. Create a quiz from them now?')) {
        eventBus.emit('quiz:request-start', { count: formattedCards.length, topic });
      }

      this.selectedFiles = [];
      this.refreshFileList();

    } catch (error) {
      alert('Failed to process files: ' + error.message);
      console.error(error);
    } finally {
      this.hideLoading();
    }
  }

  refreshFileList() {
    const hasFiles = this.selectedFiles.length > 0;
    if (this.elements.uploadBtn) this.elements.uploadBtn.disabled = !hasFiles;
    if (this.elements.selectedFilesContainer) this.elements.selectedFilesContainer.classList.toggle('hidden', !hasFiles);
    if (!this.elements.fileList) return;
    this.elements.fileList.innerHTML = this.selectedFiles.map((f, idx) => `
      <li class="flex items-center justify-between bg-gray-50 border border-gray-200 px-3 py-2 rounded-lg">
        <span class="text-sm text-gray-700 truncate">${f.name}</span>
        <button class="text-sm text-red-500 hover:text-red-700 remove-file" data-idx="${idx}">Remove</button>
      </li>
    `).join('');
    this.elements.fileList.querySelectorAll('.remove-file').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.getAttribute('data-idx')) || 0;
        this.selectedFiles.splice(idx, 1);
        this.refreshFileList();
      });
    });
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
    const isCodeLike = (text) => /import\s+|class\s+|def\s+|function\s|console\.log|System\.out\.println|flashcards_json|randomly selected/i.test(text);
    const normalizeCard = (raw) => ({
      question: (raw?.question || raw?.front || '').trim(),
      answer: (raw?.answer || raw?.back || '').trim()
    });
    const isValidCard = (card) => card.question && card.answer && card.question.length > 6 && card.answer.length > 6 && !isCodeLike(card.question + ' ' + card.answer);

    const stripNoise = (str) => str
      .replace(/```[a-z]*\n?/gi, '')
      .replace(/```/g, '')
      .replace(/<<<JSON_START>>>/g, '')
      .replace(/<<<JSON_END>>>/g, '')
      .replace(/^[\s\S]*?(\[)/, '$1');

    const tryParse = (str) => {
      try {
        let clean = stripNoise(str)
          .replace(/\{\{/g, '{').replace(/\}\}/g, '}')
          .replace(/,\s*]/g, ']').replace(/,\s*}/g, '}');
        return JSON.parse(clean);
      } catch (e) {
        return null;
      }
    };

    // 1) Prefer JSON arrays (with or without delimiters)
    const arrayMatches = response.match(/<<<JSON_START>>>[\s\S]*?<<<JSON_END>>>|\[[\s\S]*?\]/g) || [];
    for (const match of arrayMatches) {
      const parsed = tryParse(match);
      if (parsed && Array.isArray(parsed)) {
        const filtered = parsed.map(normalizeCard).filter(isValidCard);
        if (filtered.length) return filtered;
      }
    }

    // 2) Any JSON object containing question/answer arrays
    const objectMatches = response.match(/\{[\s\S]*?\}/g) || [];
    for (const match of objectMatches) {
      const parsed = tryParse(match);
      if (parsed) {
        if (Array.isArray(parsed)) {
          const filtered = parsed.map(normalizeCard).filter(isValidCard);
          if (filtered.length) return filtered;
        }

        const keys = Object.keys(parsed);
        const qKey = keys.find(k => k.toLowerCase().includes('question') || k.toLowerCase().includes('front'));
        const aKey = keys.find(k => k.toLowerCase().includes('answer') || k.toLowerCase().includes('back'));
        if (qKey && aKey && Array.isArray(parsed[qKey])) {
          const filtered = parsed[qKey]
            .map((q, i) => normalizeCard({ question: q, answer: parsed[aKey][i] || '' }))
            .filter(isValidCard);
          if (filtered.length) return filtered;
        }
        if (parsed.questions && Array.isArray(parsed.questions)) {
          const filtered = parsed.questions.map(normalizeCard).filter(isValidCard);
          if (filtered.length) return filtered;
        }
      }
    }

    // 3) Regex fallback for inline objects
    const cards = [];
    const objectRegex = /\{\s*\"question\"\s*:\s*\"((?:[^\"\\]|\\.)*)\"\s*,\s*\"answer\"\s*:\s*\"((?:[^\"\\]|\\.)*)\"\s*\}/g;
    let match;
    while ((match = objectRegex.exec(response)) !== null) {
      try {
        const card = normalizeCard({
          question: JSON.parse(`\"${match[1]}\"`),
          answer: JSON.parse(`\"${match[2]}\"`)
        });
        if (isValidCard(card)) cards.push(card);
      } catch (e) { }
    }

    // 4) CSV / pipe / tab fallback (skip lines that look like code)
    if (cards.length === 0) {
      const lines = response.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !isCodeLike(l));
      for (const line of lines) {
        let csvMatch = line.match(/^\"([^\"]+)\"\s*,\s*\"([^\"]+)\"$/);
        if (csvMatch) {
          const card = normalizeCard({ question: csvMatch[1], answer: csvMatch[2] });
          if (isValidCard(card)) cards.push(card);
          continue;
        }

        if (line.includes(',') && !line.endsWith('.')) {
          const parts = line.split(',');
          if (parts.length === 2) {
            const card = normalizeCard({ question: parts[0], answer: parts[1] });
            if (isValidCard(card)) cards.push(card);
          }
        }

        const pipeMatch = line.match(/^(.+?)\s*\|\s*(.+)$/);
        if (pipeMatch) {
          const card = normalizeCard({ question: pipeMatch[1], answer: pipeMatch[2] });
          if (isValidCard(card)) cards.push(card);
          continue;
        }

        if (line.includes('\t')) {
          const parts = line.split('\t').map(p => p.trim());
          if (parts.length === 2) {
            const card = normalizeCard({ question: parts[0], answer: parts[1] });
            if (isValidCard(card)) cards.push(card);
          }
        }
      }
      if (cards.length) return cards;
    }

    // 5) Plain text fallback – conservative
    if (cards.length === 0) {
      const sentences = response
        .split(/\n+/)
        .map(line => line.trim())
        .filter(line => line.length > 10 && line.length < 200 && !isCodeLike(line))
        .map(line => line.replace(/^[\"']|[\"']$/g, ''))
        .filter((line, index, arr) => arr.indexOf(line) === index);

      for (let i = 0; i < sentences.length - 1; i += 2) {
        const card = normalizeCard({
          question: sentences[i].endsWith('?') ? sentences[i] : `${sentences[i]}?`,
          answer: sentences[i + 1]
        });
        if (isValidCard(card)) cards.push(card);
      }
    }

    return cards;
  }

  // Stricter parser for client-side generation: requires explicit markers and clean JSON
  parseLLMResponseStrict(response, expectedCount = null) {
    if (!response) return [];

    // Strip common wrappers (e.g., <stdout>, markdown fences)
    let cleaned = response
      .replace(/```[a-zA-Z]*\n?/g, '')
      .replace(/<stdout>/gi, '')
      .replace(/<\/?span[^>]*>/gi, '')
      // Normalise slightly malformed markers sometimes emitted by WebLLM/Ollama
      .replace(/<JSON_START>>>/gi, '<<<JSON_START>>>')
      .replace(/<JSON_END>>>/gi, '<<<JSON_END>>>')
      .replace(/JSON_START>>>/gi, '<<<JSON_START>>>')
      .replace(/JSON_END>>>/gi, '<<<JSON_END>>>')
      .trim();

    const blockMatch = cleaned.match(/<<<JSON_START>>>[\s\S]*?<<<JSON_END>>>/i);
    let jsonBlock = '';
    if (blockMatch) {
      jsonBlock = blockMatch[0]
        .replace(/<<<JSON_START>>>/i, '')
        .replace(/<<<JSON_END>>>/i, '')
        .trim();
    } else {
      // fallback: grab the first JSON array in the text
      const arrMatch = cleaned.match(/\[[\s\S]*?\]/);
      if (arrMatch) jsonBlock = arrMatch[0];
    }

    if (!jsonBlock) return [];

    let parsed;
    try {
      parsed = JSON.parse(jsonBlock);
    } catch (e) {
      return [];
    }

    if (!Array.isArray(parsed)) return [];

    let cards = parsed.map((c, i) => {
      const question = (c.question || c.front || '').trim();
      const answer = (c.answer || c.back || '').trim();
      return { question, answer };
    }).filter(c => c.question && c.answer && !/json.dumps|JSON_START|function|def\s|#/.test(c.question + c.answer));

    if (expectedCount && cards.length > expectedCount) {
      cards = cards.slice(0, expectedCount);
    }

    return cards;
  }

  showLoading() {
    this.show(this.elements.loadingOverlay);
    this.updateLoadingProgress(0, 'Starting...');
  }

  hideLoading() {
    this.hide(this.elements.loadingOverlay);
  }

  updateLoadingProgress(progress?: number, message?: string) {
    const overlay = document.getElementById('loading-overlay');
    const progressEl = document.getElementById('loading-progress');
    const progressBar = document.getElementById('loading-progress-bar') as HTMLElement | null;
    if (!overlay) return;

    const parts = [];
    if (typeof progress === 'number') {
      const pct = Math.max(0, Math.min(100, Math.round(progress)));
      parts.push(`Progress: ${pct}%`);
      if (progressBar) progressBar.style.width = `${pct}%`;
    }
    if (message) parts.push(message);

    if (progressEl) {
      progressEl.textContent = parts.join(' • ') || 'Working...';
    }
  }

  async pollForRecommendations(topic: string) {
    console.log(`[Generator] Polling for recommendations: ${topic}`);

    let attempts = 0;
    const maxAttempts = 5; // Poll for up to 10 seconds (5 attempts * 2 seconds)

    const poll = async () => {
      try {
        const response = await apiService.get(`/recommendations/${encodeURIComponent(topic)}`);

        if (response.recommendedQuizzes?.length > 0 || response.recommendedLearning?.length > 0) {
          console.log('[Generator] Recommendations received:', response);
          this.displayRecommendations(response);
          return; // Stop polling
        }

        // Not ready yet, continue polling
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 2000); // Poll again in 2 seconds
        } else {
          console.log('[Generator] Recommendations polling timeout');
        }
      } catch (error) {
        console.warn('[Generator] Failed to fetch recommendations:', error);
      }
    };

    // Start polling after a brief delay
    setTimeout(poll, 2000);
  }

  displayRecommendations(recommendations: any) {
    const container = document.getElementById('recommendations-container');
    if (!container) {
      console.warn('[Generator] Recommendations container not found');
      return;
    }

    const quizzes = recommendations.recommendedQuizzes || [];
    const learning = recommendations.recommendedLearning || [];

    let html = '<div class="recommendations-section" style="margin-top: 2rem; padding: 1.5rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; color: white;">';
    html += '<h3 style="margin: 0 0 1rem 0; font-size: 1.25rem;">📚 Recommendations for You</h3>';

    if (quizzes.length > 0) {
      html += '<div style="margin-bottom: 1rem;"><strong>Recommended Quizzes:</strong><ul style="margin: 0.5rem 0; padding-left: 1.5rem;">';
      quizzes.forEach((quiz: string) => {
        html += `<li style="margin: 0.25rem 0;">${quiz}</li>`;
      });
      html += '</ul></div>';
    }

    if (learning.length > 0) {
      html += '<div><strong>Next Learning Paths:</strong><ul style="margin: 0.5rem 0; padding-left: 1.5rem;">';
      learning.forEach((path: string) => {
        html += `<li style="margin: 0.25rem 0;">${path}</li>`;
      });
      html += '</ul></div>';
    }

    html += '</div>';
    container.innerHTML = html;
    container.style.display = 'block';
  }
}
