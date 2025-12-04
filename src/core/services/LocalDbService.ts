import fs from 'fs';
import path from 'path';
import { logger } from './LoggerService.js';

type FlashcardRow = {
  id?: string;
  user_id?: string | null;
  topic?: string | null;
  cards?: unknown;
  cards_json?: unknown;
  created_at?: number;
};

type QuizRow = {
  id: string;
  user_id?: string | null;
  topic?: string | null;
  questions?: unknown;
  questions_json?: unknown;
  score?: number;
  created_at?: number;
};

type QuizAttemptRow = {
  id: string;
  quiz_id: string;
  user_id?: string | null;
  result?: unknown;
  result_json?: unknown;
  created_at?: number;
};

/**
 * Lightweight SQLite-backed (or in-memory) storage for local/dev mode.
 * If better-sqlite3 is unavailable, falls back to in-memory Maps.
 */
export class LocalDbService {
  private db: any = null;
  private inMemory = false;
  private flashcards: FlashcardRow[] = [];
  private quizzes: QuizRow[] = [];
  private quizAttempts: QuizAttemptRow[] = [];

  constructor(private dbPath = path.join(process.cwd(), '.data', 'local.db')) {}

  async initialize(): Promise<void> {
    try {
      // Optional dependency; if missing we fall back to in-memory
      // Dynamic import keeps it optional for cloud builds
      // @ts-ignore - optional dependency not installed in all environments
      const sqlite: any = (await import('better-sqlite3')).default;
      fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });
      this.db = new sqlite.default(this.dbPath);
      this.db.pragma('journal_mode = WAL');
      this.bootstrap();
      logger.info('🗄️  Local SQLite initialized at ' + this.dbPath);
    } catch (err: any) {
      this.inMemory = true;
      logger.warn('SQLite not available, falling back to in-memory storage:', err?.message || err);
    }
  }

  private bootstrap() {
    if (!this.db) return;
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS flashcards (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        topic TEXT,
        cards_json TEXT,
        created_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS quizzes (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        topic TEXT,
        questions_json TEXT,
        score INTEGER,
        created_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS quiz_attempts (
        id TEXT PRIMARY KEY,
        quiz_id TEXT,
        user_id TEXT,
        result_json TEXT,
        created_at INTEGER
      );
    `);
  }

  isAvailable() {
    return true;
  }

  // ---- Flashcards ----
  async getFlashcards(): Promise<{ data: FlashcardRow[] | null; error: string | null }> {
    if (this.inMemory) return { data: this.flashcards, error: null };
    const stmt = this.db.prepare('SELECT * FROM flashcards');
    return { data: stmt.all() as FlashcardRow[], error: null };
  }

  async createFlashcard(flashcard: FlashcardRow): Promise<{ data: FlashcardRow; error: string | null }> {
    const record: FlashcardRow = { ...flashcard, id: flashcard.id ?? `fc-${Date.now()}`, created_at: Date.now() };
    if (this.inMemory) {
      this.flashcards.push(record);
      return { data: record, error: null };
    }
    const stmt = this.db.prepare('INSERT OR REPLACE INTO flashcards (id, user_id, topic, cards_json, created_at) VALUES (@id, @user_id, @topic, @cards_json, @created_at)');
    stmt.run({
      id: record.id,
      user_id: record.user_id || null,
      topic: record.topic || null,
      cards_json: JSON.stringify(record.cards ?? record.cards_json ?? {}),
      created_at: record.created_at,
    });
    return { data: record, error: null };
  }

  async updateFlashcard(id: string, updates: Partial<FlashcardRow>): Promise<{ data: FlashcardRow | null; error: string | null }> {
    if (this.inMemory) {
      const idx = this.flashcards.findIndex(f => f.id === id);
      if (idx >= 0) this.flashcards[idx] = { ...this.flashcards[idx], ...updates };
      return { data: this.flashcards[idx] ?? null, error: null };
    }
    const current = this.db.prepare('SELECT * FROM flashcards WHERE id = ?').get(id) as FlashcardRow | null;
    if (!current) return { data: null, error: 'not found' };
    const merged = { ...current, ...updates, id: current.id ?? id } as FlashcardRow;
    this.db.prepare('UPDATE flashcards SET topic=@topic, cards_json=@cards_json WHERE id=@id').run({
      id,
      topic: merged.topic,
      cards_json: JSON.stringify(merged.cards ?? merged.cards_json ?? {}),
    });
    return { data: merged, error: null };
  }

  async deleteFlashcard(id: string): Promise<{ data: null; error: string | null }> {
    if (this.inMemory) {
      this.flashcards = this.flashcards.filter(f => f.id !== id);
      return { data: null, error: null };
    }
    this.db.prepare('DELETE FROM flashcards WHERE id = ?').run(id);
    return { data: null, error: null };
  }

  // ---- Quizzes ----
  async getQuizzes(): Promise<{ data: QuizRow[] | null; error: string | null }> {
    if (this.inMemory) return { data: this.quizzes, error: null };
    const stmt = this.db.prepare('SELECT * FROM quizzes');
    return { data: stmt.all() as QuizRow[], error: null };
  }

  async createQuiz(quiz: QuizRow): Promise<{ data: QuizRow; error: string | null }> {
    const record: QuizRow = { ...quiz, id: quiz.id ?? `quiz-${Date.now()}`, created_at: Date.now() };
    if (this.inMemory) {
      this.quizzes.push(record);
      return { data: record, error: null };
    }
    const stmt = this.db.prepare('INSERT OR REPLACE INTO quizzes (id, user_id, topic, questions_json, score, created_at) VALUES (@id, @user_id, @topic, @questions_json, @score, @created_at)');
    stmt.run({
      id: record.id,
      user_id: record.user_id || null,
      topic: record.topic || null,
      questions_json: JSON.stringify(record.questions ?? record.questions_json ?? {}),
      score: record.score || 0,
      created_at: record.created_at,
    });
    return { data: record, error: null };
  }

  async getQuiz(id: string): Promise<{ data: QuizRow | null; error: string | null }> {
    if (this.inMemory) return { data: this.quizzes.find(q => q.id === id) || null, error: null };
    const row = this.db.prepare('SELECT * FROM quizzes WHERE id = ?').get(id) as QuizRow | undefined;
    return { data: row || null, error: null };
  }

  async createQuizAttempt(attempt: QuizAttemptRow): Promise<{ data: QuizAttemptRow; error: string | null }> {
    const record: QuizAttemptRow = { ...attempt, id: attempt.id ?? `qa-${Date.now()}`, created_at: Date.now() };
    if (this.inMemory) {
      this.quizAttempts.push(record);
      return { data: record, error: null };
    }
    this.db.prepare('INSERT OR REPLACE INTO quiz_attempts (id, quiz_id, user_id, result_json, created_at) VALUES (@id, @quiz_id, @user_id, @result_json, @created_at)').run({
      id: record.id,
      quiz_id: record.quiz_id,
      user_id: record.user_id || null,
      result_json: JSON.stringify(record.result ?? record.result_json ?? {}),
      created_at: record.created_at,
    });
    return { data: record, error: null };
  }

  async getQuizAttempts(quizId: string): Promise<{ data: QuizAttemptRow[]; error: string | null }> {
    if (this.inMemory) return { data: this.quizAttempts.filter(q => q.quiz_id === quizId), error: null };
    const rows = this.db.prepare('SELECT * FROM quiz_attempts WHERE quiz_id = ?').all(quizId) as QuizAttemptRow[];
    return { data: rows, error: null };
  }
}
