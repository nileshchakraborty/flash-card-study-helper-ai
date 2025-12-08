import { graphqlService } from './graphql.service';
import { cacheService } from './cache.service';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';
type RequestOptions = {
  method?: HttpMethod;
  headers?: Record<string, string>;
  body?: string;
};

type DeckPayload = {
  topic: string;
  cards: Array<{ front: string; back: string; id?: string; topic?: string }>;
};

type DeckResponse = {
  id: string;
  topic: string;
  cards: Array<{ id: string; front: string; back: string; topic: string }>;
  timestamp: string | number;
};

type QuizSummary = {
  id: string;
  topic: string;
  questionCount: number;
  source: string;
  createdAt: string | number;
};

type QuizDetail = {
  id: string;
  topic: string;
  questions: Array<{ id: string; question: string; options: string[]; correctAnswer: string; explanation?: string | null }>;
  mode: string;
  createdAt: string | number;
};

type QuizHistoryEntry = { quizId: string; score: number; total: number; timestamp: string | number };

type JobStatus = {
  id: string;
  status: string;
  progress?: number;
  result?: unknown;
  error?: string | null;
};

type CreateQuizParams = {
  topic?: string;
  count?: number;
  flashcardIds?: string[];
  flashcards?: Array<{ id: string; front: string; back: string; topic?: string }>;
  preferredRuntime?: string;
};

export class ApiService {
  private baseUrl: string;
  private useGraphQL: boolean;

  constructor(baseUrl = '/api') {
    this.baseUrl = baseUrl;

    // Feature flag: check localStorage first, then environment
    const localStorageFlag = localStorage.getItem('USE_GRAPHQL');
    if (localStorageFlag !== null) {
      this.useGraphQL = localStorageFlag === 'true';
    } else {
      // Default to false for now (REST), can be changed to true later
      this.useGraphQL = false;
    }

    console.log(`[API] Using ${this.useGraphQL ? 'GraphQL' : 'REST'} API`);
  }

  /**
   * Toggle between REST and GraphQL
   */
  setUseGraphQL(use: boolean) {
    this.useGraphQL = use;
    localStorage.setItem('USE_GRAPHQL', use.toString());
    console.log(`[API] Switched to ${use ? 'GraphQL' : 'REST'} API`);
  }

  /**
   * Check if using GraphQL
   */
  isUsingGraphQL(): boolean {
    return this.useGraphQL;
  }

  async request(endpoint: string, options: RequestOptions = {}) {
    // Check for token in URL (from OAuth redirect)
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');
    if (tokenFromUrl) {
      localStorage.setItem('authToken', tokenFromUrl);
      // Update GraphQL headers too
      graphqlService.updateHeaders();
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    const token = localStorage.getItem('authToken');

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Simple incremental retry to reduce transient "Failed to fetch" errors
    const maxAttempts = 4;
    let attempt = 0;
    let lastError: unknown;

    while (attempt < maxAttempts) {
      try {
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
          headers,
          ...options,
        });

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Unauthorized: Session expired, please log in again');
          }
          throw new Error(`API Error: ${response.statusText}`);
        }

        return await response.json();
      } catch (error: unknown) {
        lastError = error;
        attempt += 1;

        // Exponential backoff with jitter (0.5s, 1s, 2s, 4s-ish)
        const delay = Math.min(4000, 500 * 2 ** (attempt - 1)) + Math.random() * 200;
        if (attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
      }
    }

    console.error('API Request Failed after retries:', lastError);
    throw lastError || new Error('API request failed');
  }

  async get(endpoint: string) {
    return this.request(endpoint, { method: 'GET' });
  }

  isAuthenticated() {
    return !!localStorage.getItem('authToken');
  }

  async post(endpoint: string, data: unknown) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Upload configuration file or document
   */
  async uploadFile(file: File, topic: string) {
    const MAX_DIRECT = 5 * 1024 * 1024; // 5MB
    if (file.size <= MAX_DIRECT) {
      return this.uploadSingle(file, topic);
    }
    return this.uploadChunked(file, topic);
  }

  private async uploadSingle(file: File, topic: string) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('topic', topic);

    const response = await fetch(`${this.baseUrl}/upload`, {
      method: 'POST',
      headers: this.authHeaders(),
      body: formData
    });
    return this.handleJsonResponse(response);
  }

  private async uploadChunked(file: File, topic: string) {
    const chunkSize = 5 * 1024 * 1024; // 5MB chunks for smoother uploads
    const total = Math.ceil(file.size / chunkSize);
    const uploadId = `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    for (let index = 0; index < total; index++) {
      const start = index * chunkSize;
      const end = Math.min(file.size, start + chunkSize);
      const blob = file.slice(start, end);

      const formData = new FormData();
      formData.append('chunk', blob, file.name);
      formData.append('uploadId', uploadId);
      formData.append('index', index.toString());
      formData.append('total', total.toString());
      formData.append('filename', file.name);
      formData.append('mimeType', file.type || 'application/octet-stream');
      formData.append('topic', topic);

      const response = await fetch(`${this.baseUrl}/upload/chunk`, {
        method: 'POST',
        headers: this.authHeaders(),
        body: formData
      });

      const payload = await this.handleJsonResponse(response);
      if (payload.status === 'partial') {
        continue;
      }
      // Final response carries cards
      return payload;
    }
    throw new Error('Chunked upload did not return a final response.');
  }

  private authHeaders(): Record<string, string> {
    const token = localStorage.getItem('authToken');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }

  private async handleJsonResponse(response: Response) {
    if (!response.ok) {
      let errorMsg = `Upload failed (HTTP ${response.status})`;
      try {
        const err = await response.json();
        errorMsg = err.error || err.message || errorMsg;
      } catch { /* ignore */ }
      throw new Error(errorMsg);
    }
    const payload = await response.json();
    return payload?.data ?? payload;
  }

  /**
   * Generate from raw content (text or URLs)
   */
  async generateFromContent(payload: { type: 'text' | 'url', content: string | string[], topic: string }) {
    return this.post('/generate/from-content', payload);
  }

  async saveDeck(deck: any) {
    return this.post('/decks', deck);
  }

  // Hybrid methods with GraphQL support

  /**
   * Get all decks - supports both REST and GraphQL
   */
  async getDecks(): Promise<DeckResponse[]> {
    const cacheKey = 'decks-list';
    const cached = await cacheService.get<DeckResponse[]>(cacheKey);
    if (cached) return cached;

    let result: any;
    if (this.useGraphQL) {
      try {
        result = await graphqlService.getDecks();
      } catch (error) {
        console.warn('[API] GraphQL getDecks failed, falling back to REST', error);
        result = await this.get('/decks');
      }
    } else {
      result = await this.get('/decks');
    }

    if (result && result.history) {
      result = result.history;
    }

    await cacheService.set(cacheKey, result);
    return result as DeckResponse[];
  }

  /**
   * Create a deck - supports both REST and GraphQL
   */
  async createDeck(deck: DeckPayload): Promise<DeckResponse> {
    let result: DeckResponse;
    if (this.useGraphQL) {
      try {
        result = await graphqlService.createDeck(deck);
      } catch (error) {
        console.warn('[API] GraphQL createDeck failed, falling back to REST', error);
        result = await this.post('/decks', deck) as DeckResponse;
      }
    } else {
      result = await this.post('/decks', deck) as DeckResponse;
    }

    await cacheService.invalidatePattern('decks-list');
    return result;
  }

  /**
   * Get quiz history - supports both REST and GraphQL
   */
  async getQuizHistory(): Promise<QuizHistoryEntry[]> {
    const cacheKey = 'quiz-history';
    const cached = await cacheService.get<QuizHistoryEntry[]>(cacheKey);
    if (cached) return cached;

    let result: QuizHistoryEntry[];
    if (this.useGraphQL) {
      try {
        result = await graphqlService.getQuizHistory();
      } catch (error) {
        console.warn('[API] GraphQL getQuizHistory failed, falling back to REST', error);
        result = await this.get('/quiz/history') as QuizHistoryEntry[];
      }
    } else {
      result = await this.get('/quiz/history') as QuizHistoryEntry[];
    }

    await cacheService.set(cacheKey, result);
    return result;
  }

  /**
   * Get all quizzes - supports both REST and GraphQL
   */
  async getAllQuizzes(): Promise<{ success: boolean; quizzes: QuizSummary[] }> {
    const cacheKey = 'quizzes-list';
    const cached = await cacheService.get<{ success: boolean; quizzes: QuizSummary[] }>(cacheKey);
    if (cached) return cached;

    let result: { success: boolean; quizzes: QuizSummary[] };
    if (this.useGraphQL) {
      try {
        const quizzes = await graphqlService.getAllQuizzes();
        result = { success: true, quizzes };
      } catch (error) {
        console.warn('[API] GraphQL getAllQuizzes failed, falling back to REST', error);
        result = await this.get('/quiz/list/all') as { success: boolean; quizzes: QuizSummary[] };
      }
    } else {
      result = await this.get('/quiz/list/all') as { success: boolean; quizzes: QuizSummary[] };
    }

    await cacheService.set(cacheKey, result);
    return result;
  }

  /**
   * Get quiz by ID - supports both REST and GraphQL
   */
  async getQuiz(id: string): Promise<{ success: boolean; quiz: QuizDetail | null }> {
    const cacheKey = `quiz-${id}`;
    const cached = await cacheService.get<{ success: boolean; quiz: QuizDetail | null }>(cacheKey);
    if (cached) return cached;

    let result: { success: boolean; quiz: QuizDetail | null };
    if (this.useGraphQL) {
      try {
        const quiz = await graphqlService.getQuiz(id);
        result = { success: true, quiz };
      } catch (error) {
        console.warn('[API] GraphQL getQuiz failed, falling back to REST', error);
        result = await this.get(`/quiz/${id}`) as { success: boolean; quiz: QuizDetail | null };
      }
    } else {
      result = await this.get(`/quiz/${id}`) as { success: boolean; quiz: QuizDetail | null };
    }

    await cacheService.set(cacheKey, result);
    return result;
  }

  /**
   * Create quiz - supports both REST and GraphQL
   * Unified method for topic or flashcards
   */
  async createQuiz(params: CreateQuizParams): Promise<{ success?: boolean; quiz?: QuizSummary; quizId?: string }> {
    const result = await this._createQuizInternal(params);
    await cacheService.invalidatePattern('quizzes-list');
    return result;
  }

  private async _createQuizInternal(params: CreateQuizParams): Promise<{ success?: boolean; quiz?: QuizSummary; quizId?: string }> {
    if (this.useGraphQL) {
      try {
        const input = {
          topic: params.topic,
          count: params.count,
          cards: params.flashcardIds ? params.flashcards : undefined // Need to map IDs to objects if needed
        };
        // Note: GraphQL createQuiz expects cards as objects, but REST uses IDs.
        // For now, if flashcardIds are passed, we might need to fetch them or change logic.
        // But createQuiz resolver handles "cards" input.
        // If we only have IDs, we might need to stick to REST or update GraphQL to accept IDs.
        // The schema has `cards: [FlashcardInput!]`.

        // If params has flashcardIds, we can't easily use GraphQL createQuiz unless we have the card data.
        // However, the frontend usually has the card data when calling this.

        // Let's assume for now we fallback to REST if flashcardIds are present but no card objects,
        // OR we update the caller to pass card objects.

        // Actually, let's just use REST for flashcard-based quiz for now if GraphQL input is complex,
        // but for topic-based it's easy.

        if (params.topic && !params.flashcardIds) {
          const quiz = await graphqlService.createQuiz({
            topic: params.topic,
            count: params.count
          });
          return { success: true, quiz };
        }

        // Fallback for flashcard-based quiz until we map data
        console.warn('[API] GraphQL createQuiz from flashcards not fully implemented, falling back to REST');
        return this.post('/quiz/create-from-flashcards', params);

      } catch (error) {
        console.warn('[API] GraphQL createQuiz failed, falling back to REST', error);
        if (params.flashcardIds) {
          return this.post('/quiz/create-from-flashcards', params);
        }
        return this.post('/quiz/create-from-topic', params);
      }
    }

    if (params.flashcardIds) {
      return this.post('/quiz/create-from-flashcards', params);
    }
    return this.post('/quiz/create-from-topic', params);
  }

  /**
   * Submit quiz - supports both REST and GraphQL
   * Handles the difference between server-side scoring (GraphQL) and client-side (REST legacy)
   */
  async submitQuiz(quizId: string, data: { answers?: Record<string, string> | Array<{ questionId: string; answer: string }>; results?: Array<{ cardId?: string; id?: string; userAnswer: string }> }) {
    const result = await this._submitQuizInternal(quizId, data);
    await cacheService.invalidatePattern('quiz-history');
    return result;
  }

  private async _submitQuizInternal(quizId: string, data: { answers?: Record<string, string> | Array<{ questionId: string; answer: string }>; results?: Array<{ cardId?: string; id?: string; userAnswer: string }> }) {
    if (this.useGraphQL) {
      try {
        // GraphQL expects answers array: { questionId, answer }
        // data might be the full result object from client-side calculation
        // We need to extract answers if possible, or change caller.

        // If data has 'answers' map/record, convert to array
        let answers: Array<{ questionId: string; answer: string }> = [];
        if (data.answers && !Array.isArray(data.answers)) {
          answers = Object.entries(data.answers).map(([qId, ans]) => ({
            questionId: qId,
            answer: ans
          }));
        } else if (Array.isArray(data.answers)) {
          answers = data.answers as Array<{ questionId: string; answer: string }>;
        } else if (data.results && Array.isArray(data.results)) {
          // Extract from QuizModel results
          answers = data.results.map(r => ({
            questionId: r.cardId || r.id, // Use cardId or id as questionId
            answer: r.userAnswer
          }));
        }

        if (answers.length > 0) {
          const result = await graphqlService.submitQuizAnswers(quizId, answers);
          return { success: true, ...result };
        }

        // If no answers to submit (e.g. just saving history), fallback?
      } catch (error) {
        console.warn('[API] GraphQL submitQuiz failed, falling back to REST', error);
        return this.post('/quiz/history', data);
      }
    }
    // REST legacy: save client-calculated result
    return this.post('/quiz/history', data);
  }

  /**
   * Generate flashcards - supports both REST and GraphQL
   */
  async generateFlashcards(params: { topic: string; count: number; mode?: string; knowledgeSource?: string; parentTopic?: string }) {
    if (this.useGraphQL) {
      try {
        const input = {
          topic: params.topic,
          count: params.count,
          mode: params.mode,
          knowledgeSource: params.knowledgeSource,
          parentTopic: params.parentTopic
        };

        const result = await graphqlService.generateFlashcards(input);

        // GraphQL returns { cards, jobId, recommendedTopics }
        // Convert to REST-compatible format
        return {
          cards: result.cards,
          jobId: result.jobId,
          recommendedTopics: result.recommendedTopics,
          success: true
        };
      } catch (error) {
        console.warn('[API] GraphQL generateFlashcards failed, falling back to REST', error);
        return this.post('/generate', params);
      }
    }
    return this.post('/generate', params);
  }

  /**
   * Get job status - supports both REST and GraphQL
   */
  async getJobStatus(jobId: string): Promise<JobStatus | null> {
    if (this.useGraphQL) {
      try {
        const job = await graphqlService.getJobStatus(jobId);
        // Convert to REST-compatible format
        return {
          id: job.id,
          status: job.status,
          result: job.result,
          error: job.error,
          progress: job.progress
        };
      } catch (error) {
        console.warn('[API] GraphQL getJobStatus failed, falling back to REST', error);
        return this.get(`/jobs/${jobId}`) as Promise<JobStatus>;
      }
    }
    return this.get(`/jobs/${jobId}`) as Promise<JobStatus>;
  }

  /**
   * Polls a background job until completion or timeout.
   * Returns the job result (e.g., { cards, recommendedTopics }).
   */
  async waitForJobResult(jobId: string, options: { maxWaitMs?: number; pollIntervalMs?: number; onProgress?: (progress: number) => void } = {}) {
    const { maxWaitMs = 120000, pollIntervalMs = 2000, onProgress } = options;
    const start = Date.now();

    let lastStatus: JobStatus | null = null;
    const expectedPolls = Math.max(1, Math.ceil(maxWaitMs / pollIntervalMs));
    let attempt = 0;

    while (Date.now() - start < maxWaitMs) {
      attempt += 1;
      lastStatus = await this.getJobStatus(jobId);
      const status = (lastStatus?.status || '').toString().toLowerCase();

      if (typeof onProgress === 'function') {
        if (typeof lastStatus?.progress === 'number') {
          onProgress(lastStatus.progress);
        } else {
          const elapsed = Date.now() - start;
          const timeProgress = Math.min(95, Math.round((elapsed / maxWaitMs) * 90) + 5);
          const attemptProgress = Math.min(95, Math.round((attempt / expectedPolls) * 90) + 5);
          onProgress(Math.max(5, Math.min(95, Math.max(timeProgress, attemptProgress))));
        }
      }

      if (status === 'completed' || status === 'succeeded') {
        if (typeof onProgress === 'function') onProgress(100);
        return lastStatus?.result;
      }

      if (status === 'failed') {
        throw new Error(lastStatus?.error || 'Job failed to complete');
      }

      if (status === 'not_found') {
        throw new Error('Job not found');
      }

      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }

    if (typeof onProgress === 'function') onProgress(100);
    throw new Error(`Job ${jobId} timed out after ${Math.round(maxWaitMs / 1000)}s`);
  }

  /**
   * Health check - GraphQL or REST
   */
  async healthCheck() {
    if (this.useGraphQL) {
      try {
        return await graphqlService.healthCheck();
      } catch (error) {
        console.warn('[API] GraphQL health check failed, falling back to REST', error);
        return this.get('/health');
      }
    }
    return this.get('/health');
  }
}

export const apiService = new ApiService();
