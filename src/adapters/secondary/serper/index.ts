import axios from 'axios';
import type { SearchResult, SearchServicePort } from '../../../core/ports/interfaces.js';
import type { CacheService } from '../../../core/services/CacheService.js';

export class SerperAdapter implements SearchServicePort {
  private apiKey: string;
  private cache?: CacheService<SearchResult[]>;

  constructor(cache?: CacheService<SearchResult[]>) {
    this.apiKey = process.env.SERPER_API_KEY || '';
    this.cache = cache;

    if (!this.apiKey) {
      console.warn('⚠️  SERPER_API_KEY not found in environment variables');
      console.warn('⚠️  Web scraping will be disabled. Add SERPER_API_KEY to .env file');
    } else {
      console.log('✅ SERPER_API_KEY loaded successfully');
    }
  }

  async search(query: string): Promise<SearchResult[]> {
    if (!this.apiKey) {
      console.warn('Serper API key not configured, skipping web search');
      return [];
    }

    // Check cache first
    const cacheKey = `serper:${query}`;
    if (this.cache) {
      const cached = this.cache.get(cacheKey);
      if (cached !== undefined) {
        return cached;
      }
    }

    try {
      console.log('Searching with Serper for:', query);
      const response = await axios.post(
        'https://google.serper.dev/search',
        { q: query },
        { headers: { 'X-API-KEY': this.apiKey, 'Content-Type': 'application/json' } }
      );
      const results: SearchResult[] = (response.data.organic || []).map((item: any) => ({
        title: item.title ?? '',
        link: item.link ?? '',
        snippet: item.snippet ?? ''
      }));
      console.log('Serper returned', results.length, 'results');

      // Store in cache
      if (this.cache) {
        this.cache.set(cacheKey, results);
      }

      return results;
    } catch (error) {
      console.error('Search failed:', error);
      return [];
    }
  }
}
