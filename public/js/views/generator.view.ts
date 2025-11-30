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

        cards = this.parseLLMResponse(response);
        console.log('Parsed raw cards:', JSON.stringify(cards, null, 2));

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

      if (cards.length > 0) {
        // Robust mapping
        const formattedCards = cards.map((c, i) => {
          const question = c.question || c.questions || c.front || c.term || c.concept || "Question missing";
          const answer = c.answer || c.answers || c.back || c.definition || c.description || "Answer missing";
          return {
            id: `upload-${Date.now()}-${i}`,
            front: question,
            back: answer,
            topic: topic
          };
        }).filter(c =>
          (c.front !== "Question missing" || c.back !== "Answer missing") &&
          c.front !== "Q1" && c.front !== "Q2"
        );

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

    // Helper to clean and parse JSON
    const tryParse = (str) => {
      try {
        // Fix double braces
        let clean = str.replace(/\{\{/g, '{').replace(/\}\}/g, '}');
        // Fix trailing commas
        clean = clean.replace(/,\s*]/g, ']').replace(/,\s*}/g, '}');
        return JSON.parse(clean);
      } catch (e) {
        return null;
      }
    };

    try {
      // 1. Try to find content between delimiters
      const delimiterMatch = response.match(/<<<JSON_START>>>([\s\S]*?)<<<JSON_END>>>/);
      if (delimiterMatch && delimiterMatch[1]) {
        const parsed = tryParse(delimiterMatch[1]);
        if (parsed) {
          if (Array.isArray(parsed)) return parsed;
          // Handle separate arrays
          const keys = Object.keys(parsed);
          const questionKey = keys.find(k => k.toLowerCase().includes('question') || k.toLowerCase().includes('front'));
          const answerKey = keys.find(k => k.toLowerCase().includes('answer') || k.toLowerCase().includes('back'));
          if (questionKey && answerKey && Array.isArray(parsed[questionKey])) {
            return parsed[questionKey].map((q, i) => ({ question: q, answer: parsed[answerKey][i] || '' }));
          }
        }
      }

      // 2. Fallback: Try to find ANY valid JSON structure (array or object)
      // We search for the largest possible JSON block
      const jsonMatch = response.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
      if (jsonMatch) {
        const parsed = tryParse(jsonMatch[0]);
        if (parsed) {
          if (Array.isArray(parsed)) return parsed;

          const keys = Object.keys(parsed);
          const questionKey = keys.find(k => k.toLowerCase().includes('question') || k.toLowerCase().includes('front'));
          const answerKey = keys.find(k => k.toLowerCase().includes('answer') || k.toLowerCase().includes('back'));
          if (questionKey && answerKey && Array.isArray(parsed[questionKey])) {
            return parsed[questionKey].map((q, i) => ({ question: q, answer: parsed[answerKey][i] || '' }));
          }
          // Handle single object with "questions" array
          if (parsed.questions && Array.isArray(parsed.questions)) return parsed.questions;
        }
      }
    } catch (e) {
      console.warn('Failed to parse LLM response directly, trying regex fallback');
    }

    // 3. Regex fallback: Individual JSON objects
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

    // 4. CSV Format: Try to parse as CSV
    if (cards.length === 0) {
      console.warn('No JSON found, trying CSV format...');

      // Look for CSV-like patterns: "question","answer" or question,answer
      const lines = response.split('\n').map(l => l.trim()).filter(l => l.length > 0);

      for (const line of lines) {
        // Try comma-separated with quotes
        let csvMatch = line.match(/^"([^"]+)"\s*,\s*"([^"]+)"$/);
        if (csvMatch) {
          cards.push({
            question: csvMatch[1].trim(),
            answer: csvMatch[2].trim()
          });
          continue;
        }

        // Try comma-separated without quotes (but not if it's a sentence)
        if (line.includes(',') && !line.endsWith('.')) {
          const parts = line.split(',');
          if (parts.length === 2) {
            const q = parts[0].trim();
            const a = parts[1].trim();
            // Only accept if both parts are substantial
            if (q.length > 5 && a.length > 5 && !q.match(/^\d+$/)) {
              cards.push({
                question: q,
                answer: a
              });
            }
          }
        }

        // Try pipe-separated: question | answer
        const pipeMatch = line.match(/^(.+?)\s*\|\s*(.+)$/);
        if (pipeMatch) {
          cards.push({
            question: pipeMatch[1].trim(),
            answer: pipeMatch[2].trim()
          });
          continue;
        }

        // Try tab-separated
        if (line.includes('\t')) {
          const parts = line.split('\t').map(p => p.trim());
          if (parts.length === 2 && parts[0].length > 5 && parts[1].length > 5) {
            cards.push({
              question: parts[0],
              answer: parts[1]
            });
          }
        }
      }

      if (cards.length > 0) {
        console.log(`Parsed ${cards.length} cards from CSV format`);
        return cards;
      }
    }

    // 5. TOML Format: Try to parse as TOML-like structure
    if (cards.length === 0) {
      console.warn('No CSV found, trying TOML format...');

      // Look for [[card]] sections or [card.N] patterns
      const tomlSections = response.split(/\[\[card\]\]|\[card\.\d+\]/i);

      for (const section of tomlSections) {
        if (!section.trim()) continue;

        const lines = section.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        let question = '';
        let answer = '';

        for (const line of lines) {
          // Match key = value or key = "value"
          const kvMatch = line.match(/^(question|front|q)\s*=\s*["']?([^"']+)["']?$/i);
          if (kvMatch) {
            question = kvMatch[2].trim();
            continue;
          }

          const ansMatch = line.match(/^(answer|back|a)\s*=\s*["']?([^"']+)["']?$/i);
          if (ansMatch) {
            answer = ansMatch[2].trim();
          }
        }

        if (question && answer) {
          cards.push({ question, answer });
        }
      }

      if (cards.length > 0) {
        console.log(`Parsed ${cards.length} cards from TOML format`);
        return cards;
      }
    }

    // 6. Plain text fallback - convert sentences to flashcards
    if (cards.length === 0) {
      console.warn('No JSON found, attempting plain text conversion...');

      // Extract unique sentences (remove duplicates)
      const sentences = response
        .split(/\n+/)
        .map(line => line.trim())
        .filter(line => line.length > 10 && line.length < 200) // Reasonable length
        .map(line => line.replace(/^["']|["']$/g, '')) // Remove quotes
        .filter((line, index, arr) => arr.indexOf(line) === index); // Remove duplicates

      // Convert sentences to Q&A pairs
      for (let i = 0; i < sentences.length && cards.length < 10; i++) {
        const sentence = sentences[i];

        // Try to extract key information
        // Pattern: "X is Y" -> Q: "What is X?" A: "Y"
        const isPattern = sentence.match(/^(.+?)\s+is\s+(.+?)\.?$/i);
        if (isPattern) {
          const subject = isPattern[1].trim();
          const definition = isPattern[2].trim();
          cards.push({
            question: `What is ${subject}?`,
            answer: definition.charAt(0).toUpperCase() + definition.slice(1)
          });
          continue;
        }

        // Pattern: "X refers to Y" -> Q: "What does X refer to?" A: "Y"
        const refersPattern = sentence.match(/^(.+?)\s+refers to\s+(.+?)\.?$/i);
        if (refersPattern) {
          cards.push({
            question: `What does ${refersPattern[1].trim()} refer to?`,
            answer: refersPattern[2].trim()
          });
          continue;
        }

        // Pattern: "X means Y" -> Q: "What does X mean?" A: "Y"
        const meansPattern = sentence.match(/^(.+?)\s+means\s+(.+?)\.?$/i);
        if (meansPattern) {
          cards.push({
            question: `What does ${meansPattern[1].trim()} mean?`,
            answer: meansPattern[2].trim()
          });
          continue;
        }

        // Default: Use sentence as answer, generate question
        if (sentence.includes('for')) {
          const parts = sentence.split('for');
          cards.push({
            question: `What is used for ${parts[1].trim()}?`,
            answer: parts[0].trim()
          });
        } else {
          // Generic conversion: just use the sentence
          cards.push({
            question: `Tell me about this topic`,
            answer: sentence
          });
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
