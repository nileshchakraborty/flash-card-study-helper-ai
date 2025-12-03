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
      fileInput: this.getElement('#file-input'),
      uploadArea: this.getElement('#upload-area'),
      selectedFilesContainer: this.getElement('#selected-files'),
      fileList: this.getElement('#file-list'),
      uploadBtn: this.getElement('#upload-form button[type="submit"]'),
      useBrowserLLM: this.getElement('#use-browser-llm'),
      uploadTopic: this.getElement('#upload-topic')
    };
    this.selectedFiles = [];

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
    // Determine runtime based on presence of LLM Orchestrator (WebLLM)
    const orchestrator = (window as any).llmOrchestrator;
    const useBrowser = !!orchestrator; // if orchestrator exists, we will use client‑side generation
    // runtime variable kept for logging purposes
    const runtime = useBrowser ? 'webllm' : 'ollama';

    this.showLoading();
    try {
      let cards = [];

      if (useBrowser) {
        console.log('Generating flashcards for:', topic, 'count:', count, 'runtime: webllm (client-side)');

        const orchestrator = (window as any).llmOrchestrator;
        if (!orchestrator) {
          throw new Error('LLM Orchestrator not initialized for client-side generation.');
        }

        // Ensure model is loaded (if not, it might try to load default or fail)
        if (!orchestrator.isModelLoaded()) {
          const { config } = orchestrator.getRecommendedStrategy();
          await orchestrator.loadModel(config);
        }

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

        cards = this.parseLLMResponseStrict(response, count);
        console.log('Parsed raw cards (strict):', JSON.stringify(cards, null, 2));

        // If client-side parsing failed to produce the requested count, fallback to backend generation
        if (cards.length < count) {
          console.warn(`Client-side generation returned ${cards.length}/${count}. Falling back to backend.`);
          const fallback = await apiService.generateFlashcards({ topic, count, runtime: 'ollama', knowledgeSource: 'ai-web' });
          cards = (fallback.cards || []).slice(0, count);
        }

        // Enforce requested count client-side
        if (cards.length > count) {
          cards = cards.slice(0, count);
        }

        if (cards.length > 0) {
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
        } else {
          throw new Error('Failed to generate valid flashcards from client-side LLM response');
        }

      } else {
        console.log('Generating flashcards for:', topic, 'count:', count, 'runtime: ollama (server-side)');

        // Get configuration
        const { ConfigurationService } = await import('../services/ConfigurationService.js');
        const knowledgeSource = ConfigurationService.getKnowledgeSource();

        // Use hybrid method - supports both GraphQL and REST
        const data = await apiService.generateFlashcards({
          topic,
          count,
          runtime: useBrowser ? 'webllm' : 'ollama',
          knowledgeSource
        });
        cards = data.cards || [];
        console.log('Received response from backend:', data);

        // Enforce requested count in case backend over-returns
        if (cards.length > count) {
          cards = cards.slice(0, count);
        }
      }

      if (cards.length > 0) {
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
      alert('Failed to generate flashcards. Please try again. Error: ' + error.message);
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
TASK: Create 10 educational flashcards about "${topic}".

Text:
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
      const arrMatch = cleaned.match(/\[[\s\S]*\]/);
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
  }

  hideLoading() {
    this.hide(this.elements.loadingOverlay);
  }
}
