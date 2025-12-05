import { storageService } from '../../public/js/services/storage.service.js';

describe('storageService (frontend)', () => {
  beforeEach(() => storageService.clear());

  it('stores and retrieves quizzes', () => {
    const quiz = { id: 'q1', topic: 'math', questions: [], source: 'topic', createdAt: Date.now() };
    storageService.storeQuiz(quiz);
    expect(storageService.getQuiz('q1')).toEqual(quiz);
    expect(storageService.getAllQuizzes()).toHaveLength(1);
  });

  it('stores quiz attempts per quiz', () => {
    storageService.storeQuiz({ id: 'q2', topic: 'geo', questions: [], source: 'topic', createdAt: Date.now() });
    storageService.storeQuizAttempt('q2', { score: 1, total: 2, timestamp: Date.now() } as any);
    expect(storageService.getQuizAttempts('q2')).toHaveLength(1);
    expect(storageService.getAllAttempts()).toHaveLength(1);
  });
});

