import axios from 'axios';
import type {SearchServicePort} from '../../../core/ports/interfaces.js';

export class SerperAdapter implements SearchServicePort {
  private apiKey: string;
  
  constructor() {
    this.apiKey = process.env.SERPER_API_KEY || '';
    if (!this.apiKey) {
      console.warn('⚠️  SERPER_API_KEY not found in environment variables');
      console.warn('⚠️  Web scraping will be disabled. Add SERPER_API_KEY to .env file');
    } else {
      console.log('✅ SERPER_API_KEY loaded successfully');
    }
  }
  
  async search(query: string): Promise<any[]> {
    if (!this.apiKey) {
      console.warn('Serper API key not configured, skipping web search');
      return [];
    }
    
    try {
      console.log('Searching with Serper for:', query);
      const response = await axios.post(
        'https://google.serper.dev/search',
        {q: query},
        {headers: {'X-API-KEY': this.apiKey, 'Content-Type': 'application/json'}}
      );
      console.log('Serper returned', response.data.organic?.length || 0, 'results');
      return response.data.organic || [];
    } catch (error) {
      console.error('Search failed:', error);
      return [];
    }
  }
}
