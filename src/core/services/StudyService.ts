import type { StudyUseCase, AIServicePort, SearchServicePort, StoragePort } from '../ports/interfaces.js';
import type { Flashcard, QuizQuestion, QuizResult, Deck } from '../domain/models.js';
// @ts-ignore
import pdfParse from 'pdf-parse';
// @ts-ignore
import Tesseract from 'tesseract.js';
import * as cheerio from 'cheerio';
import axios from 'axios';

export class StudyService implements StudyUseCase {
  constructor(
    private aiAdapter: AIServicePort,
    private searchAdapter: SearchServicePort,
    private storageAdapter: StoragePort
  ) { }

  async generateFlashcards(topic: string, count: number, mode: 'standard' | 'deep-dive' = 'standard', parentTopic?: string): Promise<{ cards: Flashcard[], recommendedTopics?: string[] }> {
    if (mode === 'deep-dive') {
      return this.generateDeepDiveFlashcards(topic, count);
    }

    console.log(`\n=== Starting Knowledge Retrieval for: "${topic}" ===`);

    // Step 1: Check AI Internal Knowledge
    console.log('1. Checking AI internal knowledge...');
    let aiSummary = '';
    try {
      aiSummary = await this.aiAdapter.generateSummary(topic);
      console.log('   AI Summary:', aiSummary.substring(0, 100) + '...');
    } catch (e) {
      console.warn('   Failed to get AI summary, proceeding without it.');
    }

    // Step 2: Search Web
    console.log('2. Generating refined search query...');
    let searchQuery = topic;
    try {
      searchQuery = await this.aiAdapter.generateSearchQuery(topic, parentTopic);
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
      cards = await this.aiAdapter.generateFlashcardsFromText(combinedContext, topic, count);
    } else {
      // Fallback if absolutely no context (unlikely)
      console.log('   No context available, falling back to basic generation.');
      cards = await this.aiAdapter.generateFlashcards(topic, count);
    }

    return { cards };
  }

  private async generateDeepDiveFlashcards(topic: string, count: number): Promise<{ cards: Flashcard[], recommendedTopics?: string[] }> {
    console.log(`\n=== Starting DEEP DIVE Knowledge Retrieval for: "${topic}" ===`);

    // 1. Generate Sub-topics
    console.log('1. Identifying advanced sub-topics...');
    let subTopics: string[] = [];
    try {
      subTopics = await this.aiAdapter.generateSubTopics(topic);
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
      const query = await this.aiAdapter.generateSearchQuery(currentSubTopic, topic); // Pass parent topic context
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
    const cards = await this.aiAdapter.generateFlashcardsFromText(combinedContext, currentSubTopic, count);

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

    return this.aiAdapter.generateFlashcardsFromText(text, topic, 10, { filename });
  }

  async getBriefAnswer(question: string, context: string): Promise<string> {
    return this.aiAdapter.generateBriefAnswer(question, context);
  }

  async generateQuiz(topic: string, count: number, flashcards?: Flashcard[]): Promise<QuizQuestion[]> {
    if (flashcards && flashcards.length > 0) {
      console.log('Generating quiz from', flashcards.length, 'flashcards');
      return this.aiAdapter.generateQuizFromFlashcards(flashcards, count);
    }

    // Fallback to topic-based generation if no flashcards provided
    return this.aiAdapter.generateAdvancedQuiz({ topic, wrongAnswers: [] }, 'harder');
  }

  async generateAdvancedQuiz(previousResults: any, mode: 'harder' | 'remedial'): Promise<QuizQuestion[]> {
    return this.aiAdapter.generateAdvancedQuiz(previousResults, mode);
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
}
