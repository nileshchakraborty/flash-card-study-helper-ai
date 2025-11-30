// @ts-nocheck
import { graphqlService } from './graphql.service';

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

  async request(endpoint, options = {}) {
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

    try {
      const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        headers,
        ...options,
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API Request Failed:', error);
      throw error;
    }
  }

  async get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  }

  isAuthenticated() {
    return !!localStorage.getItem('authToken');
  }

  async post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Hybrid methods with GraphQL support

  /**
   * Get all decks - supports both REST and GraphQL
   */
  async getDecks() {
    if (this.useGraphQL) {
      try {
        return await graphqlService.getDecks();
      } catch (error) {
        console.warn('[API] GraphQL getDecks failed, falling back to REST', error);
        return this.get('/decks');
      }
    }
    return this.get('/decks');
  }

  /**
   * Create a deck - supports both REST and GraphQL
   */
  async createDeck(deck) {
    if (this.useGraphQL) {
      try {
        return await graphqlService.createDeck(deck);
      } catch (error) {
        console.warn('[API] GraphQL createDeck failed, falling back to REST', error);
        return this.post('/decks', deck);
      }
    }
    return this.post('/decks', deck);
  }

  /**
   * Get quiz history - supports both REST and GraphQL
   */
  async getQuizHistory() {
    if (this.useGraphQL) {
      try {
        return await graphqlService.getQuizHistory();
      } catch (error) {
        console.warn('[API] GraphQL getQuizHistory failed, falling back to REST', error);
        return this.get('/quiz/history');
      }
    }
    return this.get('/quiz/history');
  }

  /**
   * Get all quizzes - supports both REST and GraphQL
   */
  async getAllQuizzes() {
    if (this.useGraphQL) {
      try {
        const quizzes = await graphqlService.getAllQuizzes();
        return { success: true, quizzes };
      } catch (error) {
        console.warn('[API] GraphQL getAllQuizzes failed, falling back to REST', error);
        return this.get('/quiz/list/all');
      }
    }
    return this.get('/quiz/list/all');
  }

  /**
   * Get quiz by ID - supports both REST and GraphQL
   */
  async getQuiz(id) {
    if (this.useGraphQL) {
      try {
        const quiz = await graphqlService.getQuiz(id);
        return { success: true, quiz };
      } catch (error) {
        console.warn('[API] GraphQL getQuiz failed, falling back to REST', error);
        return this.get(`/quiz/${id}`);
      }
    }
    return this.get(`/quiz/${id}`);
  }

  /**
   * Create quiz - supports both REST and GraphQL
   * Unified method for topic or flashcards
   */
  async createQuiz(params) {
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
  async submitQuiz(quizId, data) {
    if (this.useGraphQL) {
      try {
        // GraphQL expects answers array: { questionId, answer }
        // data might be the full result object from client-side calculation
        // We need to extract answers if possible, or change caller.

        // If data has 'answers' map/record, convert to array
        let answers = [];
        if (data.answers && !Array.isArray(data.answers)) {
          answers = Object.entries(data.answers).map(([qId, ans]) => ({
            questionId: qId,
            answer: ans
          }));
        } else if (Array.isArray(data.answers)) {
          answers = data.answers;
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
        return this.post('/api/quiz/history', data);
      }
    }
    // REST legacy: save client-calculated result
    return this.post('/api/quiz/history', data);
  }

  /**
   * Generate flashcards - supports both REST and GraphQL
   */
  async generateFlashcards(params) {
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
  async getJobStatus(jobId) {
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
        return this.get(`/jobs/${jobId}`);
      }
    }
    return this.get(`/jobs/${jobId}`);
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
