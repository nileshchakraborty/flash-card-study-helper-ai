import { logger } from './LoggerService.js';

export interface VectorSearchResult {
  id: string;
  score: number;
  metadata: any;
}

/**
 * Lightweight in-memory vector-like search.
 * Uses a simple bag-of-words cosine similarity to avoid external costs.
 * Suitable for local/dev only; data is not persisted across runs.
 */
export class InMemoryVectorService {
  private store: Map<string, { text: string; metadata: any; tokens: Map<string, number> }>; 

  constructor() {
    this.store = new Map();
    logger.info('🧠 In-memory vector service initialized');
  }

  async initialize(): Promise<void> {
    // No-op for interface parity
    return;
  }

  async upsertFlashcard(flashcardId: string, text: string, metadata: Record<string, any>): Promise<void> {
    const tokens = this.tokenize(text);
    this.store.set(flashcardId, { text, metadata, tokens });
  }

  async searchSimilar(query: string, topK: number = 5): Promise<VectorSearchResult[]> {
    if (this.store.size === 0) return [];
    const qTokens = this.tokenize(query);

    const results: VectorSearchResult[] = [];
    for (const [id, item] of this.store.entries()) {
      const score = this.cosine(qTokens, item.tokens);
      results.push({ id, score, metadata: item.metadata });
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  async deleteFlashcard(flashcardId: string): Promise<void> {
    this.store.delete(flashcardId);
  }

  isAvailable(): boolean {
    return true;
  }

  // ---- helpers ----
  private tokenize(text: string): Map<string, number> {
    const tokens = new Map<string, number>();
    text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean).forEach((t) => {
      tokens.set(t, (tokens.get(t) || 0) + 1);
    });
    return tokens;
  }

  private cosine(a: Map<string, number>, b: Map<string, number>): number {
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (const [, v] of a) normA += v * v;
    for (const [, v] of b) normB += v * v;
    for (const [k, v] of a) {
      const bv = b.get(k);
      if (bv) dot += v * bv;
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}

