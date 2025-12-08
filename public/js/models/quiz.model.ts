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

  timeLimit: number = 0;
  remainingTime: number = 0;
  timerInterval: any = null;

  startQuiz(questions, mode = 'standard', topic = 'General', timeLimit = 0) {
    this.questions = questions;
    this.mode = mode;
    this.currentIndex = 0;
    this.answers = {};
    this.currentTopic = topic;
    this.timeLimit = timeLimit;
    this.stopTimer(); // Clear any existing timer

    eventBus.emit('quiz:started', this.getCurrentQuestion());

    // Start timer if applicable
    if (this.timeLimit > 0) {
      this.startTimer();
    }
  }

  startTimer() {
    this.stopTimer();
    this.remainingTime = this.timeLimit;
    eventBus.emit('quiz:timer-tick', this.remainingTime);

    this.timerInterval = setInterval(() => {
      this.remainingTime--;
      eventBus.emit('quiz:timer-tick', this.remainingTime);

      if (this.remainingTime <= 0) {
        this.handleTimeout();
      }
    }, 1000);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  handleTimeout() {
    this.stopTimer();
    // Mark as unanswered/timeout
    const currentQ = this.getCurrentQuestion();
    if (currentQ) {
      this.answers[currentQ.id] = null; // null indicates timeout/skipped
    }

    if (this.currentIndex < this.questions.length - 1) {
      this.nextQuestion();
    } else {
      this.submitQuiz();
    }
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
    this.stopTimer();
    if (this.currentIndex < this.questions.length - 1) {
      this.currentIndex++;
      eventBus.emit('quiz:question-changed', this.getCurrentQuestion());
      if (this.timeLimit > 0) {
        this.startTimer();
      }
      return true;
    }
    return false;
  }

  prevQuestion() {
    // Timer behavior on prev? Usually strict quizzes don't allow going back, or timer continues.
    // For now, let's stop timer when going back to avoid confusion, or reset it?
    // User req: "if user does not answer in given time... move to next". 
    // Implies strict forward flow. But if they manually go back?
    // Let's pause timer or just reset it for that question?
    // Resetting gives infinite time. 
    // Let's just restart timer for the previous question to be fair (or harsh).
    this.stopTimer();
    if (this.currentIndex > 0) {
      this.currentIndex--;
      eventBus.emit('quiz:question-changed', this.getCurrentQuestion());
      if (this.timeLimit > 0) {
        this.startTimer();
      }
      return true;
    }
    return false;
  }

  async submitQuiz(topic?: string) {
    this.stopTimer();
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
