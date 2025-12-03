import type { StudyUseCase, AIServicePort, SearchServicePort, StoragePort } from '../ports/interfaces.js';
import type { Flashcard, QuizQuestion, QuizResult, Deck } from '../domain/models.js';
import { MetricsService } from './MetricsService.js';
// @ts-ignore
import pdfParse from 'pdf-parse';
// @ts-ignore
import Tesseract from 'tesseract.js';
import * as cheerio from 'cheerio';
import axios from 'axios';

export class StudyService implements StudyUseCase {
  private getAdapter(runtime: string): any {
    // If aiAdapters is a map keyed by runtime, return that entry.
    // Otherwise, assume aiAdapters itself is the adapter (e.g., in tests).
    const possible = (this.aiAdapters as any)[runtime];
    if (possible) return possible;
    return this.aiAdapters;
  }
  constructor(
    private aiAdapters: Record<string, AIServicePort>,
    private searchAdapter: SearchServicePort,
    private storageAdapter: StoragePort,
    private metricsService?: MetricsService
  ) { }

  async generateFlashcards(
    topic: string,
    count: number,
    mode: 'standard' | 'deep-dive' = 'standard',
    knowledgeSource: 'ai-only' | 'web-only' | 'ai-web' = 'ai-web',
    runtime: 'ollama' | 'webllm' = 'ollama',
    parentTopic?: string
  ): Promise<{ cards: Flashcard[], recommendedTopics?: string[] }> {
    const desiredCount = Math.max(1, count || 1);
    const startTime = Date.now();
    const adapter = this.getAdapter(runtime);
    if (!adapter) {
      throw new Error(`Unknown runtime: ${runtime}. Available: ${Object.keys(this.aiAdapters).join(', ')}`);
    }

    try {
      const result = await this.doGenerateFlashcards(topic, desiredCount, mode, knowledgeSource, adapter, parentTopic);
      const validated = await this.validateAndRepairFlashcards(result.cards, desiredCount, topic, adapter);
      const adjustedCards = this.enforceCardCount(validated, desiredCount, topic);

      // Record success metrics
      if (this.metricsService) {
        this.metricsService.recordGeneration({
          runtime,
          knowledgeSource,
          mode,
          topic,
          cardCount: Math.min(desiredCount, adjustedCards.length),
          duration: Date.now() - startTime,
          success: true
        });
      }

      return { ...result, cards: adjustedCards };
    } catch (error: any) {
      // Record failure metrics
      if (this.metricsService) {
        this.metricsService.recordGeneration({
          runtime,
          knowledgeSource,
          mode,
          topic,
          cardCount: 0,
          duration: Date.now() - startTime,
          success: false,
          errorMessage: error.message
        });
      }
      throw error;
    }
  }

  private async doGenerateFlashcards(
    topic: string,
    count: number,
    mode: 'standard' | 'deep-dive',
    knowledgeSource: 'ai-only' | 'web-only' | 'ai-web',
    aiAdapter: AIServicePort,
    parentTopic?: string
  ): Promise<{ cards: Flashcard[], recommendedTopics?: string[] }> {
    if (mode === 'deep-dive') {
      return this.generateDeepDiveFlashcards(topic, count);
    }

    console.log(`\n=== Starting Knowledge Retrieval for: "${topic}" (Mode: ${knowledgeSource}) ===`);

    // Step 1: Check AI Internal Knowledge (skip if web-only)
    let aiSummary = '';
    if (knowledgeSource !== 'web-only') {
      console.log('1. Checking AI internal knowledge...');
      try {
        aiSummary = await this.getAdapter('ollama').generateSummary(topic);
        console.log('   AI Summary:', aiSummary.substring(0, 100) + '...');
      } catch (e) {
        console.warn('   Failed to get AI summary:', e.message);
      }
    }

    // If AI-only mode, generate directly from AI knowledge
    if (knowledgeSource === 'ai-only') {
      console.log('2. Generating flashcards from AI knowledge (ai-only mode)...');
      try {
        let cards = await this.getAdapter('ollama').generateFlashcards(topic, count);
        cards = await this.validateAndRepairFlashcards(cards, count, topic, this.getAdapter('ollama'));
        cards = this.enforceCardCount(cards, count, topic);
        return { cards };
      } catch (e) {
        console.error('   Failed to generate from AI knowledge:', e.message);
        throw new Error(`Failed to generate flashcards from AI knowledge: ${e.message}`);
      }
    }

    // Step 2: Generate Search Query (for web-only or ai-web)
    console.log('2. Generating refined search query...');
    let searchQuery = topic;
    try {
      searchQuery = await this.getAdapter('ollama').generateSearchQuery(topic, parentTopic);
      console.log(`   Refined Query: "${searchQuery}"`);
    } catch (e) {
      console.warn('   Failed to refine query, using original topic.');
    }

    console.log('3. Searching web for top sources...');
    const searchResults = await this.searchAdapter.search(searchQuery);
    console.log(`   Found ${searchResults.length} results.`);

    // Step 3: Filter & Select Top Sources
    // Filter for unique domains to ensure "different websites"
    const uniqueDomains = new Set();
    const diverseSources = searchResults.filter(result => {
      try {
        const hostname = new URL(result.link).hostname;
        if (uniqueDomains.has(hostname)) {
          return false;
        }
        uniqueDomains.add(hostname);
        return true;
      } catch (e) {
        return false;
      }
    });

    const topSources = diverseSources.slice(0, 5);
    console.log(`   Selected top ${topSources.length} unique sources for scraping.`);

    // Step 4: Scrape Content Concurrently
    let scrapedContent = '';
    if (topSources.length > 0) {
      console.log('4. Scraping sources concurrently...');
      const urls = topSources.map(r => r.link);
      scrapedContent = await this.scrapeMultipleSources(urls);
      console.log(`   Total scraped content: ${scrapedContent.length} chars.`);
    } else {
      console.log('   No sources to scrape.');
    }

    // Step 5: Synthesize & Generate
    console.log('5. Synthesizing context and generating flashcards...');
    let combinedContext = '';
    if (aiSummary) {
      combinedContext += `AI KNOWLEDGE SUMMARY:\n${aiSummary}\n\n`;
    }
    if (scrapedContent) {
      combinedContext += `WEB CONTENT:\n${scrapedContent}\n\n`;
    }

    let cards: Flashcard[] = [];
    if (combinedContext) {
      // Use the text-based generation with our rich context
      cards = await this.getAdapter('ollama').generateFlashcardsFromText(combinedContext, topic, count);
    } else {
      // Fallback if absolutely no context (unlikely)
      console.log('   No context available, falling back to basic generation.');
      cards = await this.getAdapter('ollama').generateFlashcards(topic, count);
    }

    cards = await this.validateAndRepairFlashcards(cards, count, topic, this.getAdapter('ollama'));
    cards = this.enforceCardCount(cards, count, topic);
    return { cards };
  }

  private async generateDeepDiveFlashcards(topic: string, count: number): Promise<{ cards: Flashcard[], recommendedTopics?: string[] }> {
    console.log(`\n=== Starting DEEP DIVE Knowledge Retrieval for: "${topic}" ===`);

    // 1. Generate Sub-topics
    console.log('1. Identifying advanced sub-topics...');
    let subTopics: string[] = [];
    try {
      subTopics = await this.getAdapter('ollama').generateSubTopics(topic);
      console.log(`   Identified ${subTopics.length} sub-topics:`, subTopics.join(', '));
    } catch (e) {
      console.warn('   Failed to generate sub-topics, falling back to standard mode.');
      return this.generateFlashcards(topic, count, 'standard');
    }

    if (subTopics.length === 0) {
      return this.generateFlashcards(topic, count, 'standard');
    }

    // 2. Select ONLY the first sub-topic for immediate processing
    const currentSubTopic = subTopics[0];
    const remainingTopics = subTopics.slice(1);
    console.log(`2. Processing PRIMARY sub-topic: "${currentSubTopic}"`);
    console.log(`   (Remaining ${remainingTopics.length} topics will be recommended)`);

    // 3. Research the single sub-topic
    let combinedContext = '';
    try {
      // Refine Query
      const query = await this.getAdapter('ollama').generateSearchQuery(currentSubTopic, topic); // Pass parent topic context
      console.log(`   Refined Query: "${query}"`);

      // Search
      const results = await this.searchAdapter.search(query);

      // Take top 3 unique sources (increased from 2 since we only do 1 topic)
      const uniqueDomains = new Set();
      const topSources = results.filter(r => {
        try {
          const h = new URL(r.link).hostname;
          if (uniqueDomains.has(h)) return false;
          uniqueDomains.add(h);
          return true;
        } catch { return false; }
      }).slice(0, 3);

      // Scrape
      const urls = topSources.map(r => r.link);
      const content = await this.scrapeMultipleSources(urls);

      combinedContext = `DEEP DIVE TOPIC: ${currentSubTopic} (Parent: ${topic})\n${content}\n---\n`;
    } catch (e) {
      console.warn(`   x Failed to research sub-topic "${currentSubTopic}": ${e.message}`);
    }

    // 4. Generate Flashcards
    console.log('3. Generating advanced flashcards from aggregated context...');
    const cards = await this.getAdapter('ollama').generateFlashcardsFromText(combinedContext, currentSubTopic, count);

    return {
      cards,
      recommendedTopics: remainingTopics
    };
  }

  private async scrapeMultipleSources(urls: string[]): Promise<string> {
    const scrapePromises = urls.map(async (url) => {
      try {
        console.log(`   - Scraping: ${url}`);
        const res = await axios.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          },
          timeout: 4000 // 4s timeout per site
        });

        const $ = cheerio.load(res.data);
        $('script').remove();
        $('style').remove();
        $('nav').remove();
        $('footer').remove();
        $('header').remove();

        // Get text and clean it up
        let text = $('body').text().replace(/\s+/g, ' ').trim();

        // Limit per site to avoid overwhelming context window
        return `SOURCE (${url}):\n${text.substring(0, 2000)}\n---\n`;
      } catch (e) {
        console.warn(`   x Failed to scrape ${url}: ${e.message}`);
        return '';
      }
    });

    const results = await Promise.all(scrapePromises);
    return results.join('\n');
  }

  async processFile(file: Buffer, filename: string, mimeType: string, topic: string): Promise<Flashcard[]> {
    let text = '';

    if (mimeType === 'application/pdf') {
      const data = await pdfParse(file);
      text = data.text;
    } else if (mimeType.startsWith('image/')) {
      const result = await Tesseract.recognize(file);
      text = result.data.text;
    } else {
      text = file.toString('utf-8');
    }

    return this.getAdapter('ollama').generateFlashcardsFromText(text, topic, 10, { filename });
  }

  async getBriefAnswer(question: string, context: string): Promise<string> {
    return this.getAdapter('ollama').generateBriefAnswer(question, context);
  }

  async generateQuiz(
    topic: string,
    count: number,
    flashcards?: Flashcard[],
    preferredRuntime: 'ollama' | 'webllm' = 'ollama'
  ): Promise<QuizQuestion[]> {
    const order = preferredRuntime === 'webllm'
      ? ['webllm', 'ollama']
      : ['ollama', 'webllm'];

    const tryAdapters = async (fn: (adapter: any) => Promise<QuizQuestion[]>) => {
      for (const runtime of order) {
        try {
          const adapter = this.getAdapter(runtime);
          if (adapter && typeof adapter === 'object') {
            return await fn(adapter);
          }
        } catch (err: any) {
          console.warn(`[StudyService] ${runtime} quiz generation failed:`, err?.message);
        }
      }
      return null;
    };

    // 1) Flashcard-based quiz
    if (flashcards && flashcards.length > 0) {
      console.log('Generating quiz from', flashcards.length, 'flashcards');

      // fast local quiz first
      const localQuiz = this.generateQuizFallbackFromFlashcards(flashcards, count);
      if (localQuiz.length > 0) return localQuiz;

      const result = await tryAdapters((adapter) => adapter.generateQuizFromFlashcards(flashcards, count));
      if (result) return result;

      console.warn('[StudyService] All adapters failed; returning local fallback quiz.');
      return this.generateQuizFallbackFromFlashcards(flashcards, count);
    }

    // 2) Topic-based quiz
    const result = await tryAdapters((adapter) => adapter.generateAdvancedQuiz({ topic, wrongAnswers: [] }, 'harder'));
    if (result) return result;

    console.warn('[StudyService] All adapters failed for topic quiz; returning lightweight fallback.');
    return this.generateQuizFallbackFromTopic(topic, count);
  }

  async generateAdvancedQuiz(previousResults: any, mode: 'harder' | 'remedial'): Promise<QuizQuestion[]> {
    return this.getAdapter('ollama').generateAdvancedQuiz(previousResults, mode);
  }

  async saveQuizResult(result: QuizResult): Promise<string> {
    await this.storageAdapter.saveQuizResult(result);
    return result.id;
  }

  async getQuizHistory(): Promise<QuizResult[]> {
    return this.storageAdapter.getQuizHistory();
  }

  async saveDeck(deck: Deck): Promise<void> {
    await this.storageAdapter.saveDeck(deck);
  }

  async getDeckHistory(): Promise<Deck[]> {
    return this.storageAdapter.getDeckHistory();
  }
  /**
   * Local fallback: build simple MCQs from flashcards without LLM.
   */
  private generateQuizFallbackFromFlashcards(flashcards: Flashcard[], count: number): QuizQuestion[] {
    const pool = flashcards.slice();
    const questions: QuizQuestion[] = [];
    const take = Math.min(count || 5, pool.length);

    const shuffle = <T>(arr: T[]) => arr.sort(() => Math.random() - 0.5);

    for (let i = 0; i < take; i++) {
      const card = pool[i % pool.length];
      const distractors = shuffle(pool.filter((c) => c.id !== card.id)).slice(0, 3).map((c) => c.back);
      const options = shuffle([card.back, ...distractors]);

      questions.push({
        id: `fallback-${card.id || i}`,
        question: card.front?.endsWith('?') ? card.front : `${card.front}?`,
        options,
        correctAnswer: card.back,
        explanation: 'Based on your existing flashcard content.'
      });
    }

    return questions;
  }

  /**
   * Local fallback: generic topic questions when LLM is unavailable.
   */
  private generateQuizFallbackFromTopic(topic: string, count: number): QuizQuestion[] {
    const questions: QuizQuestion[] = [];
    const take = Math.max(count || 5, 3);
    for (let i = 0; i < take; i++) {
      questions.push({
        id: `fallback-topic-${i}`,
        question: `What is a key fact about ${topic}?`,
        options: [
          `${topic} is an important concept in its field.`,
          `${topic} is a random string.`,
          `${topic} refers to a historical place.`,
          `${topic} is unrelated to learning.`
        ],
        correctAnswer: `${topic} is an important concept in its field.`,
        explanation: 'Fallback question generated without AI service.'
      });
    }
    return questions;
  }

  private isCardValid(card: Flashcard): boolean {
    if (!card) return false;
    const q = (card.front || (card as any).question || '').trim();
    const a = (card.back || (card as any).answer || '').trim();
    if (!q || !a) return false;
    const noise = /json.dumps|JSON_START|function|def\s|#|```|class\s|import\s/;
    return !noise.test(q + a) && q.length >= 4 && a.length >= 3;
  }

  private normalizeCards(raw: any[]): Flashcard[] {
    return (raw || []).map((c, i) => ({
      id: c.id || `card-${Date.now()}-${i}`,
      front: (c.front || c.question || '').trim(),
      back: (c.back || c.answer || '').trim(),
      topic: (c as any).topic
    }));
  }

  private async validateAndRepairFlashcards(cards: Flashcard[], count: number, topic: string, adapter: any): Promise<Flashcard[]> {
    const desired = Math.max(1, count || 1);
    let normalized = this.normalizeCards(cards).filter(c => this.isCardValid(c));
    if (normalized.length >= desired) return normalized;

    if (adapter?.generateFlashcardsFromText) {
      try {
        const prompt = `Fix and return EXACTLY ${desired} flashcards in JSON. Each object must have 'question' and 'answer'. Topic: ${topic}. Here is possibly malformed data:\n${JSON.stringify(cards, null, 2)}`;
        const repaired = await adapter.generateFlashcardsFromText(prompt, topic, desired);
        normalized = this.normalizeCards(repaired).filter(c => this.isCardValid(c));
        if (normalized.length >= desired) return normalized;
      } catch (e) {
        console.warn('[StudyService] Repair via adapter failed:', (e as any)?.message);
      }
    }

    return normalized;
  }

  /** Ensure flashcard count matches user request, padding simple Q/A when too few are returned. */
  private enforceCardCount(cards: Flashcard[], count: number, topic: string): Flashcard[] {
    const desired = Math.max(1, count || 1);
    let trimmed = cards.slice(0, desired);

    if (trimmed.length < desired) {
      const needed = desired - trimmed.length;
      for (let i = 0; i < needed; i++) {
        trimmed.push({
          id: `fallback-${Date.now()}-${i}`,
          front: `What is a key fact about ${topic}?`,
          back: `${topic} is an important concept to understand.`,
          topic
        } as Flashcard);
      }
    }

    return trimmed;
  }


}
