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

  async generateFlashcards(topic: string, count: number): Promise<Flashcard[]> {
    // 1. Search web for content
    console.log('Searching for topic:', topic);
    const searchResults = await this.searchAdapter.search(topic);
    console.log('Search results:', searchResults.length, 'results found');
    let context = '';

    if (searchResults.length > 0) {
      // Simple scraping of top result (simplified from original)
      try {
        console.log('Attempting to scrape:', searchResults[0].link);
        const res = await axios.get(searchResults[0].link);
        const $ = cheerio.load(res.data);
        $('script').remove();
        $('style').remove();
        context = $('body').text().substring(0, 5000);
        console.log('Successfully scraped', context.length, 'characters');
      } catch (e) {
        console.error('Scraping failed, falling back to AI knowledge');
      }
    } else {
      console.log('No search results, using AI knowledge only');
    }

    // 2. Generate cards using AI
    if (context) {
      console.log('Generating from scraped context');
      return this.aiAdapter.generateFlashcardsFromText(context, topic, count);
    }
    console.log('Generating from AI knowledge only');
    return this.aiAdapter.generateFlashcards(topic, count);
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
