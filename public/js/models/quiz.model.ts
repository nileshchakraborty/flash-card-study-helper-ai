// @ts-nocheck
import { apiService } from '../services/api.service.js';
import { eventBus } from '../utils/event-bus.js';

export class QuizModel {
  questions: any[] = [];
  currentIndex: number = 0;
  answers: Record<string, any> = {};
  history: any[] = [];
  prefetched: Array<{ id: string; topic: string; questions: any[]; source: 'flashcards' | 'topic'; createdAt: number }> = [];
  mode: string = 'standard'; // standard, web, advanced
  currentTopic: string = 'General';

  constructor() {
    // Properties are now initialized directly on the class
  }

  startQuiz(questions, mode = 'standard', topic = 'General') {
    this.questions = questions;
    this.mode = mode;
    this.currentIndex = 0;
    this.answers = {};
    this.currentTopic = topic;
    eventBus.emit('quiz:started', this.getCurrentQuestion());
  }

  getCurrentQuestion() {
    return this.questions[this.currentIndex];
  }

  addPrefetchedQuiz(entry: { id: string; topic: string; questions: any[]; source: 'flashcards' | 'topic'; createdAt?: number }) {
    const createdAt = entry.createdAt ?? Date.now();
    // Replace if same topic/source existing
    this.prefetched = this.prefetched.filter(q => !(q.topic === entry.topic && q.source === entry.source));
    this.prefetched.unshift({ ...entry, createdAt });
    eventBus.emit('quiz:available-updated', this.prefetched);
  }

  listPrefetched() {
    return this.prefetched;
  }

  answerQuestion(questionId, back) {
    this.answers[questionId] = back;
  }

  nextQuestion() {
    if (this.currentIndex < this.questions.length - 1) {
      this.currentIndex++;
      eventBus.emit('quiz:question-changed', this.getCurrentQuestion());
      return true;
    }
    return false;
  }

  prevQuestion() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      eventBus.emit('quiz:question-changed', this.getCurrentQuestion());
      return true;
    }
    return false;
  }

  async submitQuiz(topic?: string) {
    const quizTopic = topic || this.currentTopic || 'General';
    let score = 0;
    const results = this.questions.map(q => {
      const userAnswer = this.answers[q.id];
      const isCorrect = userAnswer === q.correctAnswer;
      if (isCorrect) score++;
      return {
        cardId: q.id || q.cardId,
        question: q.question,
        userAnswer,
        correctAnswer: q.correctAnswer,
        correct: isCorrect,
        expected: q.correctAnswer || q.expected // Ensure expected is passed for UI
      };
    });

    const quizResult = {
      score,
      total: this.questions.length,
      topic: quizTopic,
      results,
      timestamp: Date.now()
    };

    try {
      // Use hybrid submitQuiz method
      // We pass the full result object, apiService handles adaptation for GraphQL
      const response = await apiService.submitQuiz(quizResult.id || this.currentTopic, quizResult);

      if (response && (response.id || response.quizId)) {
        quizResult.id = response.id || response.quizId; // Add ID from server
      }
      this.history.unshift(quizResult); // Add to local history
      eventBus.emit('quiz:completed', quizResult);
      eventBus.emit('quiz:history-updated', this.history);
    } catch (error) {
      console.error('Failed to save quiz result:', error);
      // Still emit events even if save fails
      this.history.unshift(quizResult);
      eventBus.emit('quiz:completed', quizResult);
      eventBus.emit('quiz:history-updated', this.history);
    }

    return quizResult;
  }

  async loadHistory() {
    try {
      const data = await apiService.get('/quiz/history');
      if (data.history) {
        this.history = data.history;
        eventBus.emit('quiz:history-updated', this.history);
      }
    } catch (error) {
      console.error('Failed to load quiz history:', error);
    }
  }
}

export const quizModel = new QuizModel();
