// @ts-nocheck
import { BaseView } from './base.view.js';
import { eventBus } from '../utils/event-bus.js';
import { quizModel } from '../models/quiz.model.js';
import { apiService } from '../services/api.service.js';

export class QuizView extends BaseView {
  constructor() {
    super();
    this.elements = {
      setup: this.getElement('#quiz-setup'),
      questions: this.getElement('#quiz-questions'),
      results: this.getElement('#quiz-results'),
      questionText: this.getElement('#question-text'),
      optionsContainer: this.getElement('#options-container'),
      prevBtn: this.getElement('#prev-question'),
      nextBtn: this.getElement('#next-question'),
      submitBtn: this.getElement('#submit-quiz'),
      historyList: this.getElement('#quiz-history-list'),
      startBtn: this.getElement('#start-quiz-btn'),
      webQuizBtn: this.getElement('#quiz-from-web'),
      webOptions: this.getElement('#web-quiz-options'),
      popup: this.getElement('#quiz-completion-popup'),
      popupScore: this.getElement('#popup-score'),
      popupMessage: this.getElement('#popup-message'),
      closePopupBtn: this.getElement('#btn-close-popup')
    };

    this.init();
  }

  init() {
    this.bindEvents();
    this.loadHistory();

    eventBus.on('quiz:started', (question) => {
      this.showQuestionUI();
      this.renderQuestion(question);
    });

    eventBus.on('quiz:question-changed', (question) => {
      this.renderQuestion(question);
    });

    eventBus.on('quiz:completed', (result) => {
      this.showResultsUI(result);
      this.showPopup(result);
    });

    eventBus.on('quiz:history-updated', (history) => {
      this.renderHistory(history);
    });
  }

  bindEvents() {
    if (this.elements.startBtn) {
      this.bind(this.elements.startBtn, 'click', async () => {
        const count = document.getElementById('quiz-count').value;
        const topic = 'General'; // Or from deck
        // For simplicity, we'll generate from current deck or API
        // Ideally, this should be handled by controller or model
        eventBus.emit('quiz:request-start', { count, topic });
      });
    }

    if (this.elements.prevBtn) {
      this.bind(this.elements.prevBtn, 'click', () => quizModel.prevQuestion());
    }

    if (this.elements.nextBtn) {
      this.bind(this.elements.nextBtn, 'click', () => quizModel.nextQuestion());
    }

    if (this.elements.submitBtn) {
      this.bind(this.elements.submitBtn, 'click', () => quizModel.submitQuiz());
    }

    if (this.elements.closePopupBtn) {
      this.bind(this.elements.closePopupBtn, 'click', () => this.hide(this.elements.popup));
    }

    if (this.elements.webQuizBtn) {
      this.bind(this.elements.webQuizBtn, 'click', () => {
        this.elements.webOptions.classList.toggle('hidden');
      });
    }
  }

  showQuestionUI() {
    this.hide(this.elements.setup);
    this.hide(this.elements.results);
    this.show(this.elements.questions);
  }

  showResultsUI(result) {
    this.hide(this.elements.questions);
    this.show(this.elements.results);

    const scoreEl = this.getElement('#quiz-score');
    if (scoreEl) scoreEl.textContent = `${result.score}/${result.total}`;

    const answersDiv = this.getElement('#quiz-answers');
    if (answersDiv) {
      answersDiv.innerHTML = '';
      result.results.forEach((res, idx) => {
        const div = document.createElement('div');
        div.className = `quiz-answer-item ${res.correct ? 'correct' : 'incorrect'}`;
        div.innerHTML = `
          <div class="answer-header">
            <span class="answer-number">Question ${idx + 1}</span>
            <span class="answer-status">${res.correct ? '✓ Correct' : '✗ Incorrect'}</span>
          </div>
          <div class="answer-question"><strong>Q:</strong> ${res.question}</div>
          <div class="answer-expected"><strong>Expected:</strong> ${res.expected}</div>
          <div class="answer-given"><strong>Your Answer:</strong> ${res.userAnswer || '(No answer provided)'}</div>
        `;
        answersDiv.appendChild(div);
      });
    }
  }

  renderQuestion(question) {
    if (!question) return;

    this.elements.questionText.textContent = question.question;
    this.elements.optionsContainer.innerHTML = '';

    question.options.forEach((option, index) => {
      const btn = document.createElement('button');
      btn.className = `quiz-option ${quizModel.answers[question.id] === option ? 'selected' : ''}`;
      btn.textContent = option;
      btn.onclick = () => {
        quizModel.answerQuestion(question.id, option);
        this.renderQuestion(question); // Re-render to update selection
      };
      this.elements.optionsContainer.appendChild(btn);
    });

    // Update buttons state
    this.elements.prevBtn.disabled = quizModel.currentIndex === 0;

    if (quizModel.currentIndex === quizModel.questions.length - 1) {
      this.hide(this.elements.nextBtn);
      this.show(this.elements.submitBtn);
    } else {
      this.show(this.elements.nextBtn);
      this.hide(this.elements.submitBtn);
    }
  }

  renderHistory(history) {
    if (!this.elements.historyList) return;

    if (history.length === 0) {
      this.elements.historyList.innerHTML = '<div class="text-gray-500 text-sm italic">No quiz history found.</div>';
      return;
    }

    this.elements.historyList.innerHTML = history.map(quiz => `
      <div class="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex justify-between items-center">
        <div>
          <h4 class="font-semibold text-gray-800">${quiz.topic}</h4>
          <p class="text-xs text-gray-500">${new Date(quiz.timestamp).toLocaleDateString()} • Score: ${quiz.score}/${quiz.total}</p>
        </div>
        <div class="text-lg font-bold ${quiz.score / quiz.total >= 0.7 ? 'text-green-600' : 'text-orange-500'}">
          ${Math.round((quiz.score / quiz.total) * 100)}%
        </div>
      </div>
    `).join('');
  }

  showPopup(result) {
    this.elements.popupScore.textContent = `${result.score}/${result.total}`;
    const percentage = (result.score / result.total) * 100;
    const passed = percentage >= 70;

    let message = '';
    let actionButtons = '';

    if (percentage === 100) {
      message = "Perfect score! You're a master of this topic.";
      actionButtons = `
                <button id="btn-quiz-harder" class="w-full bg-primary text-white px-6 py-3 rounded-lg hover:bg-primary-dark transition-all mb-3 flex items-center justify-center gap-2">
                    <span class="material-icons">psychology</span>
                    Try Harder Questions Quiz
                </button>
                <button id="btn-quiz-retry" class="w-full bg-white text-gray-700 border-2 border-gray-200 px-6 py-3 rounded-lg hover:border-primary hover:text-primary transition-all flex items-center justify-center gap-2">
                    <span class="material-icons">refresh</span>
                    Retry Quiz
                </button>
            `;
    } else if (percentage < 80) {
      message = "Keep practicing! Review the flashcards to improve.";
      actionButtons = `
                <button id="btn-quiz-retry" class="w-full bg-white text-gray-700 border-2 border-gray-200 px-6 py-3 rounded-lg hover:border-primary hover:text-primary transition-all mb-3 flex items-center justify-center gap-2">
                    <span class="material-icons">refresh</span>
                    Retry Quiz
                </button>
                <button id="btn-quiz-revise" class="w-full bg-primary text-white px-6 py-3 rounded-lg hover:bg-primary-dark transition-all flex items-center justify-center gap-2">
                    <span class="material-icons">school</span>
                    Revise Flashcards
                </button>
            `;
    } else {
      // 80-99%
      message = "Great job! You're doing well.";
      actionButtons = `
                <button id="btn-quiz-harder" class="w-full bg-primary text-white px-6 py-3 rounded-lg hover:bg-primary-dark transition-all mb-3 flex items-center justify-center gap-2">
                    <span class="material-icons">psychology</span>
                    Try Harder Questions Quiz
                </button>
                <button id="btn-quiz-retry" class="w-full bg-white text-gray-700 border-2 border-gray-200 px-6 py-3 rounded-lg hover:border-primary hover:text-primary transition-all flex items-center justify-center gap-2">
                    <span class="material-icons">refresh</span>
                    Retry Quiz
                </button>
            `;
    }

    this.elements.popupMessage.textContent = message;

    // Inject buttons into a container in the popup
    // We need to find or create a container for actions
    let actionsContainer = this.elements.popup.querySelector('.quiz-actions');
    if (!actionsContainer) {
      actionsContainer = document.createElement('div');
      actionsContainer.className = 'quiz-actions mt-6';
      this.elements.popup.querySelector('.bg-white').appendChild(actionsContainer);
    }
    actionsContainer.innerHTML = actionButtons;

    // Bind events
    const retryBtn = actionsContainer.querySelector('#btn-quiz-retry');
    const harderBtn = actionsContainer.querySelector('#btn-quiz-harder');
    const reviseBtn = actionsContainer.querySelector('#btn-quiz-revise');

    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        this.hide(this.elements.popup);
        eventBus.emit('quiz:retry', null);
      });
    }

    if (harderBtn) {
      harderBtn.addEventListener('click', () => {
        this.hide(this.elements.popup);
        eventBus.emit('quiz:harder', null);
      });
    }

    if (reviseBtn) {
      reviseBtn.addEventListener('click', () => {
        this.hide(this.elements.popup);
        eventBus.emit('quiz:revise', null);
      });
    }

    this.show(this.elements.popup);
  }

  async loadHistory() {
    await quizModel.loadHistory();
  }
}
