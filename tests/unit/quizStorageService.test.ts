import { QuizStorageService } from '../../src/core/services/QuizStorageService.js';

const sampleQuiz = {
  id: 'quiz-1',
  topic: 'TS',
  source: 'flashcards' as const,
  createdAt: Date.now(),
  questions: [
    { id: 'q1', question: 'What is TS?', options: ['Lang'], correctAnswer: 'Lang' },
    { id: 'q2', question: 'Types?', options: ['Static'], correctAnswer: 'Static' }
  ]
};

describe('QuizStorageService', () => {
  let storage: QuizStorageService;

  beforeEach(() => {
    storage = new QuizStorageService();
  });

  it('stores and retrieves a quiz', () => {
    storage.storeQuiz(sampleQuiz as any);
    const retrieved = storage.getQuiz('quiz-1');
    expect(retrieved?.id).toBe('quiz-1');
    expect(retrieved?.questions).toHaveLength(2);
  });

  it('creates quiz with generated question ids', () => {
    const quiz = storage.createQuiz({
      topic: 'JS',
      source: 'topic',
      questions: [
        { question: 'Q1', options: ['A'], correctAnswer: 'A' }
      ] as any
    });

    expect(quiz.id).toBeDefined();
    expect(quiz.questions[0].id).toContain('-q-0');
  });

  it('stores attempts and returns stats', () => {
    storage.storeQuiz(sampleQuiz as any);
    storage.storeAttempt({
      id: 'attempt-1',
      quizId: 'quiz-1',
      timestamp: Date.now(),
      answers: { q1: 'Lang' },
      score: 1,
      total: 2
    });

    const attempts = storage.getAttempts('quiz-1');
    expect(attempts).toHaveLength(1);
    const stats = storage.getStats();
    expect(stats.totalAttempts).toBe(1);
  });

  it('exposes listing, filtering, and deletion', () => {
    storage.storeQuiz({ ...sampleQuiz, id: 'quiz-2', topic: 'Topic A' } as any);
    storage.storeQuiz({ ...sampleQuiz, id: 'quiz-3', topic: 'Topic B' } as any);

    expect(storage.getAllQuizzes()).toHaveLength(2);
    expect(storage.getQuizzesByTopic('Topic A')).toHaveLength(1);

    // Attempts survive and are removed with quiz
    storage.storeAttempt({ id: 'a1', quizId: 'quiz-2', timestamp: Date.now(), answers: {}, score: 0, total: 1 });
    expect(storage.getAllAttempts()).toHaveLength(1);
    storage.deleteQuiz('quiz-2');
    expect(storage.getQuiz('quiz-2')).toBeUndefined();
    expect(storage.getAttempts('quiz-2')).toHaveLength(0);
  });

  it('returns quiz with history and saves attempts via saveAttempt', () => {
    storage.storeQuiz(sampleQuiz as any);
    storage.saveAttempt('quiz-1', { answers: [1], score: 1, totalQuestions: 1 });
    const { quiz, attempts } = storage.getQuizWithHistory('quiz-1');
    expect(quiz?.id).toBe('quiz-1');
    expect(attempts).toHaveLength(1);
  });
});
