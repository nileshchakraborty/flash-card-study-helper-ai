/**
 * WebLLMService - Backend service for managing WebLLM sessions
 * 
 * Since WebLLM requires browser WebGPU, this service manages:
 * - Session lifecycle
 * - Business logic orchestration
 * - Caching and queue management
 * - WebSocket communication with clients
 */

import { EventEmitter } from 'events';
import type { Flashcard } from '../domain/models.js';
import type { CacheService } from './CacheService.js';
import { LoggerService } from './LoggerService.js';

export interface WebLLMSession {
  id: string;
  userId?: string;
  modelId: string;
  status: 'initializing' | 'ready' | 'generating' | 'error' | 'closed';
  createdAt: number;
  lastActivity: number;
  wsConnection?: any; // WebSocket connection
}

export interface WebLLMGenerationRequest {
  type: 'generate' | 'summary' | 'search-query' | 'flashcards' | 'quiz';
  prompt: string;
  options?: {
    count?: number;
    topic?: string;
    context?: string;
    flashcards?: Flashcard[];
  };
}

export interface WebLLMGenerationResponse {
  type: 'progress' | 'result' | 'error';
  progress?: number;
  message?: string;
  data?: any;
  error?: string;
}

export class WebLLMService extends EventEmitter {
  private sessions: Map<string, WebLLMSession> = new Map();
  private logger: LoggerService;
  private cache?: CacheService<any>;
  private sessionTimeout: number = 30 * 60 * 1000; // 30 minutes

  constructor(cache?: CacheService<any>) {
    super();
    this.cache = cache;
    this.logger = new LoggerService();
    this.startSessionCleanup();
  }

  /**
   * Create a new WebLLM session
   */
  createSession(modelId: string, userId?: string): WebLLMSession {
    const sessionId = `webllm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const session: WebLLMSession = {
      id: sessionId,
      userId,
      modelId,
      status: 'initializing',
      createdAt: Date.now(),
      lastActivity: Date.now()
    };

    this.sessions.set(sessionId, session);
    this.logger.info('WebLLM session created', { sessionId, modelId, userId });

    // Auto-cleanup after timeout
    setTimeout(() => {
      if (this.sessions.has(sessionId)) {
        this.closeSession(sessionId);
      }
    }, this.sessionTimeout);

    return session;
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): WebLLMSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Update session status
   */
  updateSession(sessionId: string, updates: Partial<WebLLMSession>): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    Object.assign(session, updates);
    session.lastActivity = Date.now();
    return true;
  }

  /**
   * Attach WebSocket connection to session
   */
  attachWebSocket(sessionId: string, ws: any): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.wsConnection = ws;
    session.status = 'ready';

    ws.on('close', () => {
      this.closeSession(sessionId);
    });

    ws.on('error', (error: Error) => {
      this.logger.error('WebSocket error', { sessionId, error: error.message });
      this.updateSession(sessionId, { status: 'error' });
    });

    this.logger.info('WebSocket attached to session', { sessionId });
    return true;
  }

  /**
   * Handle generation request from client
   */
  async handleGenerationRequest(
    sessionId: string,
    request: WebLLMGenerationRequest
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.wsConnection) {
      throw new Error('Session not found or not connected');
    }

    if (session.status !== 'ready') {
      throw new Error(`Session not ready: ${session.status}`);
    }

    session.status = 'generating';
    this.updateSession(sessionId, { status: 'generating' });

    try {
      // Send progress updates
      this.sendToClient(sessionId, {
        type: 'progress',
        progress: 0,
        message: 'Starting generation...'
      });

      // Handle different generation types
      switch (request.type) {
        case 'flashcards':
          await this.handleFlashcardGeneration(sessionId, request);
          break;
        case 'summary':
          await this.handleSummaryGeneration(sessionId, request);
          break;
        case 'search-query':
          await this.handleSearchQueryGeneration(sessionId, request);
          break;
        case 'quiz':
          await this.handleQuizGeneration(sessionId, request);
          break;
        default:
          throw new Error(`Unknown generation type: ${request.type}`);
      }
    } catch (error: any) {
      this.logger.error('Generation error', { sessionId, error: error.message });
      this.sendToClient(sessionId, {
        type: 'error',
        error: error.message
      });
      this.updateSession(sessionId, { status: 'error' });
    } finally {
      this.updateSession(sessionId, { status: 'ready' });
    }
  }

  /**
   * Handle flashcard generation
   */
  private async handleFlashcardGeneration(
    sessionId: string,
    request: WebLLMGenerationRequest
  ): Promise<void> {
    const { prompt, options } = request;
    const count = options?.count || 10;
    const topic = options?.topic || prompt;

    // Check cache
    const cacheKey = `webllm:flashcards:${topic}:${count}`;
    if (this.cache) {
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        this.sendToClient(sessionId, {
          type: 'result',
          data: { cards: cached, cached: true }
        });
        return;
      }
    }

    // Send to client for WebLLM processing
    // Client will process and send back results
    this.sendToClient(sessionId, {
      type: 'progress',
      progress: 50,
      message: 'Generating flashcards with WebLLM...'
    });

    // Wait for client response (handled via WebSocket message)
    // The actual generation happens client-side, we just orchestrate
  }

  /**
   * Handle summary generation
   */
  private async handleSummaryGeneration(
    sessionId: string,
    request: WebLLMGenerationRequest
  ): Promise<void> {
    const { prompt } = request;
    const cacheKey = `webllm:summary:${prompt.substring(0, 50)}`;

    if (this.cache) {
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        this.sendToClient(sessionId, {
          type: 'result',
          data: { summary: cached, cached: true }
        });
        return;
      }
    }

    this.sendToClient(sessionId, {
      type: 'progress',
      progress: 50,
      message: 'Generating summary with WebLLM...'
    });
  }

  /**
   * Handle search query generation
   */
  private async handleSearchQueryGeneration(
    sessionId: string,
    request: WebLLMGenerationRequest
  ): Promise<void> {
    const { prompt } = request;
    const cacheKey = `webllm:query:${prompt}`;

    if (this.cache) {
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        this.sendToClient(sessionId, {
          type: 'result',
          data: { query: cached, cached: true }
        });
        return;
      }
    }

    this.sendToClient(sessionId, {
      type: 'progress',
      progress: 50,
      message: 'Generating search query with WebLLM...'
    });
  }

  /**
   * Handle quiz generation
   */
  private async handleQuizGeneration(
    sessionId: string,
    request: WebLLMGenerationRequest
  ): Promise<void> {
    const { options: _options } = request;
    // const _flashcards = options?.flashcards || [];

    this.sendToClient(sessionId, {
      type: 'progress',
      progress: 50,
      message: 'Generating quiz with WebLLM...'
    });
  }

  /**
   * Handle client response (results from WebLLM)
   */
  async handleClientResponse(sessionId: string, response: any): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Cache results if applicable
    if (response.data && response.cacheKey) {
      this.cache?.set(response.cacheKey, response.data);
    }

    // Update session
    this.updateSession(sessionId, { status: 'ready' });
  }

  /**
   * Send message to client via WebSocket
   */
  private sendToClient(sessionId: string, message: WebLLMGenerationResponse): void {
    const session = this.sessions.get(sessionId);
    if (!session?.wsConnection) return;

    try {
      session.wsConnection.send(JSON.stringify(message));
    } catch (error: any) {
      this.logger.error('Failed to send message to client', { sessionId, error: error.message });
    }
  }

  /**
   * Close session
   */
  closeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    if (session.wsConnection) {
      try {
        session.wsConnection.close();
      } catch (error) {
        // Ignore
      }
    }

    this.sessions.delete(sessionId);
    this.logger.info('WebLLM session closed', { sessionId });
    this.emit('session-closed', sessionId);
  }

  /**
   * Start session cleanup timer
   */
  private startSessionCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [sessionId, session] of this.sessions.entries()) {
        if (now - session.lastActivity > this.sessionTimeout) {
          this.logger.info('Cleaning up inactive session', { sessionId });
          this.closeSession(sessionId);
        }
      }
    }, 5 * 60 * 1000); // Check every 5 minutes
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): WebLLMSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Get session statistics
   */
  getStats(): {
    totalSessions: number;
    activeSessions: number;
    sessionsByStatus: Record<string, number>;
  } {
    const sessions = Array.from(this.sessions.values());
    const statusCounts: Record<string, number> = {};

    sessions.forEach(s => {
      statusCounts[s.status] = (statusCounts[s.status] || 0) + 1;
    });

    return {
      totalSessions: sessions.length,
      activeSessions: sessions.filter(s => s.status === 'ready' || s.status === 'generating').length,
      sessionsByStatus: statusCounts
    };
  }
}

