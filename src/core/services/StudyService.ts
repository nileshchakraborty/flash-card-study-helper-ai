import type { StudyUseCase, AIServicePort, SearchServicePort, StoragePort } from '../ports/interfaces.js';
import type { Flashcard, QuizQuestion, QuizResult, Deck } from '../domain/models.js';
import type { KnowledgeSource, Runtime, QuizMode } from '../domain/types.js';
import { MetricsService } from './MetricsService.js';
import { CacheService } from './CacheService.js';
import { FlashcardGenerationGraph } from '../workflows/FlashcardGenerationGraph.js';
// @ts-ignore
import pdfParse from 'pdf-parse';
// @ts-ignore
import Tesseract from 'tesseract.js';
import * as cheerio from 'cheerio';
import axios from 'axios';

export class StudyService implements StudyUseCase {
  // @ts-ignore - Will be used when graph is wired into generation flow
  private flashcardGraph: FlashcardGenerationGraph;

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
    private metricsService?: MetricsService,
    private webContextCache?: CacheService<string>
  ) {
    // Initialize FlashcardGenerationGraph with Ollama adapter for resilient generation
    this.flashcardGraph = new FlashcardGenerationGraph(
      this.getAdapter('ollama') as any // Cast as adapter type flexibility
    );
  }

  /**
   * Generate flashcards for a topic using the configured AI/runtime pipeline.
   * Returns the requested count (or padded fallbacks) and optional recommendations.
   */
  async generateFlashcards(
    topic: string,
    count: number,
    mode: QuizMode = 'standard',
    knowledgeSource: KnowledgeSource = 'ai-web',
    runtime: Runtime = 'ollama',
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

      // Trigger async recommendations generation (fire-and-forget)
      this.generateRecommendationsAsync(topic).catch(err => {
        console.warn('[StudyService] Failed to generate recommendations:', err);
      });

      return { ...result, cards: adjustedCards };
    } catch (error: any) {
      // Fallback: if Ollama is unreachable (e.g., ENOTFOUND), retry once with WebLLM runtime
      const message = (error as Error)?.message || '';
      const isDns = /ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(message);
      if (runtime === 'ollama' && isDns && this.getAdapter('webllm')) {
        console.warn('⚠️ Ollama unreachable, falling back to WebLLM runtime');
        try {
          const webResult = await this.doGenerateFlashcards(topic, desiredCount, mode, knowledgeSource, this.getAdapter('webllm'), parentTopic);
          const validated = await this.validateAndRepairFlashcards(webResult.cards, desiredCount, topic, this.getAdapter('webllm'));
          const adjustedCards = this.enforceCardCount(validated, desiredCount, topic);
          if (this.metricsService) {
            this.metricsService.recordGeneration({
              runtime: 'webllm',
              knowledgeSource,
              mode,
              topic,
              cardCount: Math.min(desiredCount, adjustedCards.length),
              duration: Date.now() - startTime,
              success: true
            });
          }
          return { ...webResult, cards: adjustedCards };
        } catch (fallbackError: any) {
          // if fallback also fails, keep original error for clarity
          console.error('WebLLM fallback failed:', fallbackError?.message || fallbackError);
        }
      }

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
    mode: QuizMode,
    knowledgeSource: KnowledgeSource,
    _aiAdapter: AIServicePort,
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
        console.warn('   Failed to get AI summary:', (e as Error).message);
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
        console.error('   Failed to generate from AI knowledge:', (e as Error).message);
        throw new Error(`Failed to generate flashcards from AI knowledge: ${(e as Error).message}`);
      }
    }

    // Step 2: Get web context (cache-first)
    // At this point, we know it's either 'web-only' or 'ai-web' mode
    const scrapedContent = await this.getCachedOrFreshWebContext(topic, parentTopic);

    // Step 3: Synthesize & Generate
    console.log('3. Synthesizing context and generating flashcards...');
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
      console.warn(`   x Failed to research sub-topic "${currentSubTopic}": ${(e as Error).message}`);
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
        console.warn(`   x Failed to scrape ${url}: ${(e as any).message}`);
        return '';
      }
    });

    const results = await Promise.all(scrapePromises);
    return results.join('\n');
  }

  /**
   * Cache-first web context retrieval
   * Checks cache first, performs fresh search if miss
   */
  private async getCachedOrFreshWebContext(topic: string, parentTopic?: string): Promise<string> {
    const cacheKey = `web-context:${topic}`;

    //Check cache first
    if (this.webContextCache) {
      const cached = this.webContextCache.get(cacheKey);
      if (cached) {
        console.log(`[Cache Hit] Using cached web context for: ${topic}`);
        return cached;
      }
    }

    // Cache miss - perform fresh search
    console.log(`[Cache Miss] Fetching fresh web context for: ${topic}`);

    // Step 1: Generate search query
    let searchQuery = topic;
    try {
      searchQuery = await this.getAdapter('ollama').generateSearchQuery(topic, parentTopic);
      console.log(`   Refined Query: "${searchQuery}"`);
    } catch (e) {
      console.warn('   Failed to refine query, using original topic.');
    }

    // Step 2: Search web
    const searchResults = await this.searchAdapter.search(searchQuery);
    console.log(`   Found ${searchResults.length} results.`);

    // Step 3: Filter for unique domains
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

    // Step 4: Scrape content
    let webContext = '';
    if (topSources.length > 0) {
      const urls = topSources.map(r => r.link);
      webContext = await this.scrapeMultipleSources(urls);
      console.log(`   Total scraped content: ${webContext.length} chars.`);
    }

    // Store in cache
    if (this.webContextCache && webContext) {
      this.webContextCache.set(cacheKey, webContext);
    }

    return webContext;
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

  /**
   * Build a quiz either from existing flashcards or directly from a topic.
   * Respects a preferred runtime order and falls back to local generation when needed.
   */
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

    const qualityGate = (questions: QuizQuestion[] | null): QuizQuestion[] | null => {
      if (!questions || questions.length === 0) return null;
      // Basic quality checks: require question and correctAnswer populated
      const valid = questions.filter(q => q?.question && q?.correctAnswer);
      if (valid.length < Math.max(1, Math.floor((questions.length || 1) * 0.5))) {
        return null;
      }
      return valid;
    };

    // 1) Flashcard-based quiz
    if (flashcards && flashcards.length > 0) {
      console.log('Generating quiz from', flashcards.length, 'flashcards');

      // Try primary
      const primaryResult = await tryAdapters((adapter) => adapter.generateQuizFromFlashcards(flashcards, count).then(qualityGate));
      if (primaryResult) return primaryResult;

      // Quality failed or generation failed; try secondary for validation
      const secondaryResult = await tryAdapters((adapter) => adapter.generateQuizFromFlashcards(flashcards, count).then(qualityGate));
      if (secondaryResult) return secondaryResult;

      console.warn('[StudyService] All adapters failed; returning local fallback quiz.');
      return this.generateQuizFallbackFromFlashcards(flashcards, count);
    }

    // 2) Topic-based quiz
    const primaryResult = await tryAdapters((adapter) => adapter.generateAdvancedQuiz({ topic, wrongAnswers: [] }, 'harder').then(qualityGate));
    if (primaryResult) return primaryResult;

    const secondaryResult = await tryAdapters((adapter) => adapter.generateAdvancedQuiz({ topic, wrongAnswers: [] }, 'harder').then(qualityGate));
    if (secondaryResult) return secondaryResult;

    console.warn('[StudyService] All adapters failed for topic quiz; returning lightweight fallback.');
    return this.generateQuizFallbackFromTopic(topic, count);
  }

  async generateAdvancedQuiz(previousResults: any, mode: 'harder' | 'remedial'): Promise<QuizQuestion[]> {
    console.log('[StudyService.generateAdvancedQuiz] START');
    console.log('[StudyService.generateAdvancedQuiz] Mode:', mode);
    console.log('[StudyService.generateAdvancedQuiz] Previous results:', JSON.stringify(previousResults, null, 2));

    let context = '';

    // For "Harder" mode, get web context (cache-first)
    if (mode === 'harder' && previousResults.topic) {
      try {
        console.log(`[StudyService] Getting web context for advanced quiz on: ${previousResults.topic}`);
        context = await this.getCachedOrFreshWebContext(previousResults.topic);
        console.log(`[StudyService] Web context retrieved, length: ${context.length} chars`);
        console.log('[StudyService] Added web context to advanced quiz generation.');
      } catch (e) {
        console.error('[StudyService] Web context retrieval ERROR:', e);
        console.warn('[StudyService] Web context retrieval failed for advanced quiz, proceeding without context:', e);
      }
    } else {
      console.log(`[StudyService] Skipping web context - mode: ${mode}, has topic: ${!!previousResults.topic}`);
    }

    console.log('[StudyService] Calling adapter.generateAdvancedQuiz with context length:', context.length);
    const result = await this.getAdapter('ollama').generateAdvancedQuiz(previousResults, mode, context);
    console.log('[StudyService.generateAdvancedQuiz] COMPLETE - Generated', result.length, 'questions');

    return result;
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
      const otherCards = pool.filter((c) => c.id !== card?.id);
      let distractors = shuffle(otherCards).slice(0, 3).map((c) => c.back);

      // Ensure 4 options by padding with generic distractors if needed
      const genericDistractors = [
        "None of the above",
        "All of the above",
        "Depends on the context",
        "Not applicable"
      ];

      let added = 0;
      while (distractors.length < 3 && added < genericDistractors.length) {
        const generic = genericDistractors[added];
        if (generic && !distractors.includes(generic)) {
          distractors.push(generic);
        }
        added++;
      }

      const options = shuffle([card?.back || '', ...distractors]);

      questions.push({
        id: `fallback-${card?.id || i}`,
        question: card?.front?.endsWith('?') ? card.front : `${card?.front}?`,
        options,
        correctAnswer: card?.back || '',
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

  /**
   * Generate recommendations asynchronously (fire-and-forget)
   * Generates recommended quiz topics and learning paths based on web context
   */
  private async generateRecommendationsAsync(topic: string): Promise<void> {
    try {
      console.log(`[StudyService] Generating async recommendations for: ${topic}`);

      // Get web context for the topic (will use cache if available)
      const webContext = await this.getCachedOrFreshWebContext(topic);

      // Generate recommendations using AI
      const prompt = `Based on the following content about "${topic}", suggest:
1. Three related quiz topics that would help deepen understanding
2. Three recommended learning paths or next topics to study

Content:
${webContext.substring(0, 3000)}

Respond in JSON format:
{
  "recommendedQuizzes": ["topic1", "topic2", "topic3"],
  "recommendedLearning": ["path1", "path2", "path3"]
}`;

      const response = await this.getAdapter('ollama').generateBriefAnswer(
        'Generate recommendations',
        prompt
      );

      // Parse the AI response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const recommendations = JSON.parse(jsonMatch[0]);

        // Store in cache
        if (this.webContextCache) {
          this.webContextCache.set(
            `recommendations:${topic}`,
            JSON.stringify(recommendations)
          );
          console.log(`[StudyService] Cached recommendations for: ${topic}`);
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.warn(`[StudyService] Recommendation generation failed for ${topic}:`, message);
    }
  }


}
