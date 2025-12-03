import { GraphQLClient } from 'graphql-request';

/**
 * GraphQL Service for making GraphQL queries and mutations
 * Uses graphql-request for lightweight client-side GraphQL
 */
class GraphQLService {
  private client: GraphQLClient;
  private endpoint: string;

  constructor(endpoint: string = '/graphql') {
    this.endpoint = endpoint;
    this.client = new GraphQLClient(this.endpoint, {
      headers: this.getHeaders()
    });
  }

  /**
   * Get authorization headers
   */
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    const token = localStorage.getItem('authToken');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  /**
   * Update client headers (e.g., after login)
   */
  updateHeaders(): void {
    this.client = new GraphQLClient(this.endpoint, {
      headers: this.getHeaders()
    });
  }

  /**
   * Execute a GraphQL query
   */
  async query<T = any>(query: string, variables?: any): Promise<T> {
    try {
      return await this.client.request<T>(query, variables);
    } catch (error: any) {
      console.error('GraphQL Query Error:', error);
      throw new Error(error.response?.errors?.[0]?.message || error.message);
    }
  }

  /**
   * Execute a GraphQL mutation
   */
  async mutate<T = any>(mutation: string, variables?: any): Promise<T> {
    try {
      return await this.client.request<T>(mutation, variables);
    } catch (error: any) {
      console.error('GraphQL Mutation Error:', error);
      throw new Error(error.response?.errors?.[0]?.message || error.message);
    }
  }

  /**
   * Health check query
   */
  async healthCheck(): Promise<any> {
    const query = `query { health }`;
    return this.query(query);
  }

  // Flashcard/Deck Queries

  /**
   * Get all decks
   */
  async getDecks(): Promise<any[]> {
    const query = `
      query {
        decks {
          id
          topic
          cards {
            id
            front
            back
            topic
          }
          timestamp
        }
      }
    `;
    const result = await this.query<{ decks: any[] }>(query);
    return result.decks;
  }

  /**
   * Get a specific deck by ID
   */
  async getDeck(id: string): Promise<any> {
    const query = `
      query GetDeck($id: ID!) {
        deck(id: $id) {
          id
          topic
          cards {
            id
            front
            back
            topic
          }
          timestamp
        }
      }
    `;
    const result = await this.query<{ deck: any }>(query, { id });
    return result.deck;
  }

  /**
   * Create a new deck
   */
  async createDeck(input: { topic: string; cards: any[] }): Promise<any> {
    const mutation = `
      mutation CreateDeck($input: DeckInput!) {
        createDeck(input: $input) {
          id
          topic
          cards {
            id
            front
            back
            topic
          }
          timestamp
        }
      }
    `;
    const result = await this.mutate<{ createDeck: any }>(mutation, { input });
    return result.createDeck;
  }

  /**
   * Delete a deck
   */
  async deleteDeck(id: string): Promise<boolean> {
    const mutation = `
      mutation DeleteDeck($id: ID!) {
        deleteDeck(id: $id)
      }
    `;
    const result = await this.mutate<{ deleteDeck: boolean }>(mutation, { id });
    return result.deleteDeck;
  }

  // Quiz Queries

  /**
   * Get quiz by ID
   */
  async getQuiz(id: string): Promise<any> {
    const query = `
      query GetQuiz($id: ID!) {
        quiz(id: $id) {
          id
          topic
          questions {
            id
            question
            options
            correctAnswer
            explanation
          }
          mode
          createdAt
        }
      }
    `;
    const result = await this.query<{ quiz: any }>(query, { id });
    return result.quiz;
  }

  /**
   * Get quiz history
   */
  async getQuizHistory(): Promise<any[]> {
    const query = `
      query {
        quizHistory {
          quizId
          score
          total
          timestamp
        }
      }
    `;
    const result = await this.query<{ quizHistory: any[] }>(query);
    return result.quizHistory;
  }

  /**
   * Get all quizzes
   */
  async getAllQuizzes(): Promise<any[]> {
    const query = `
      query {
        allQuizzes {
          id
          topic
          questions {
            id
          }
          createdAt
        }
      }
    `;
    const result = await this.query<{ allQuizzes: any[] }>(query);
    return result.allQuizzes;
  }

  /**
   * Create a quiz
   */
  async createQuiz(input: { topic?: string; cards?: any[]; count?: number }): Promise<any> {
    const mutation = `
      mutation CreateQuiz($input: QuizInput!) {
        createQuiz(input: $input) {
          id
          topic
          questions {
            id
            question
            options
            correctAnswer
          }
        }
      }
    `;
    const result = await this.mutate<{ createQuiz: any }>(mutation, { input });
    return result.createQuiz;
  }

  /**
   * Submit quiz answers
   */
  async submitQuizAnswers(quizId: string, answers: any[]): Promise<any> {
    const mutation = `
      mutation SubmitQuizAnswer($quizId: ID!, $answers: [QuizAnswerInput!]!) {
        submitQuizAnswer(quizId: $quizId, answers: $answers) {
          quizId
          score
          total
          timestamp
        }
      }
    `;
    const result = await this.mutate<{ submitQuizAnswer: any }>(mutation, { quizId, answers });
    return result.submitQuizAnswer;
  }

  // Flashcard Generation

  /**
   * Generate flashcards
   */
  async generateFlashcards(input: {
    topic: string;
    count?: number;
    mode?: string;
    knowledgeSource?: string;
    parentTopic?: string;
  }): Promise<any> {
    const mutation = `
      mutation GenerateFlashcards($input: GenerateInput!) {
        generateFlashcards(input: $input) {
          cards {
            id
            front
            back
            topic
          }
          jobId
          recommendedTopics
        }
      }
    `;
    const result = await this.mutate<{ generateFlashcards: any }>(mutation, { input });
    return result.generateFlashcards;
  }

  // Job Status

  /**
   * Get job status
   */
  async getJobStatus(id: string): Promise<any> {
    const query = `
      query GetJob($id: ID!) {
        job(id: $id) {
          id
          status
          result
          error
          progress
        }
      }
    `;
    const result = await this.query<{ job: any }>(query, { id });
    return result.job;
  }
}

// Export singleton instance
export const graphqlService = new GraphQLService();
export { GraphQLService };
