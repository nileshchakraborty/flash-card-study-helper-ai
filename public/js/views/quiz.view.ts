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
    // Quiz form submission
    const quizForm = this.getElement('#quiz-form');
    if (quizForm) {
      this.bind(quizForm, 'submit', async (e) => {
        e.preventDefault();
        const countInput = this.getElement('#quiz-size') as HTMLInputElement;
        const topicInput = this.getElement('#quiz-topic-input') as HTMLInputElement;
        const timerInput = this.getElement('#quiz-timer') as HTMLSelectElement;
        
        const count = parseInt(countInput?.value || '5');
        const topic = topicInput?.value || 'General';
        const timer = parseInt(timerInput?.value || '0');
        
        // Store timer setting
        (window as any).quizTimer = timer;
        
        eventBus.emit('quiz:request-start', { count, topic, timer });
      });
    }

    // Quiz from cards button
    const quizFromCardsBtn = this.getElement('#quiz-from-cards');
    if (quizFromCardsBtn) {
      this.bind(quizFromCardsBtn, 'click', () => {
        // Hide web options, show form
        if (this.elements.webOptions) {
          this.elements.webOptions.classList.add('hidden');
        }
        const topicInput = this.getElement('#quiz-topic-input') as HTMLInputElement;
        if (topicInput) {
          topicInput.value = '';
        }
        // Import deckModel to get current topic
        import('../models/deck.model.js').then(({ deckModel }) => {
          if (topicInput && deckModel.currentTopic) {
            topicInput.value = deckModel.currentTopic;
          }
        });
      });
    }

    // Quiz from web button
    if (this.elements.webQuizBtn) {
      this.bind(this.elements.webQuizBtn, 'click', () => {
        if (this.elements.webOptions) {
          this.elements.webOptions.classList.toggle('hidden');
        }
      });
    }

    // Legacy start button (if exists)
    if (this.elements.startBtn) {
      this.bind(this.elements.startBtn, 'click', async () => {
        const countInput = this.getElement('#quiz-count') as HTMLInputElement;
        const count = parseInt(countInput?.value || '5');
        const topic = 'General';
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
  }

  showQuestionUI() {
    this.hide(this.elements.setup);
    this.hide(this.elements.results);
    this.show(this.elements.questions);
  }

  showResultsUI(result) {
    this.hide(this.elements.setup);
    this.hide(this.elements.questions);
    this.show(this.elements.results);

    const percentage = Math.round((result.score / result.total) * 100);
    const resultsHTML = `
      <div class="text-center mb-6">
        <h2 class="text-2xl font-bold text-gray-900 mb-2">Quiz Results</h2>
        <div class="text-4xl font-bold ${percentage >= 70 ? 'text-green-600' : 'text-orange-500'} mb-2">
          ${result.score}/${result.total}
        </div>
        <div class="text-lg text-gray-600">${percentage}% Correct</div>
      </div>
      <div class="space-y-4" id="quiz-answers">
        ${result.results.map((res: any, idx: number) => `
          <div class="p-4 rounded-lg border-2 ${res.correct ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}">
            <div class="flex items-center justify-between mb-2">
              <span class="font-semibold text-gray-900">Question ${idx + 1}</span>
              <span class="text-sm font-medium ${res.correct ? 'text-green-700' : 'text-red-700'}">
                ${res.correct ? '✓ Correct' : '✗ Incorrect'}
              </span>
            </div>
            <div class="text-gray-800 mb-2"><strong>Q:</strong> ${res.question}</div>
            <div class="text-sm text-gray-600 mb-1"><strong>Correct Answer:</strong> ${res.correctAnswer || res.expected}</div>
            ${!res.correct ? `<div class="text-sm text-red-600"><strong>Your Answer:</strong> ${res.userAnswer || '(No answer provided)'}</div>` : ''}
          </div>
        `).join('')}
      </div>
    `;
    
    if (this.elements.results) {
      this.elements.results.innerHTML = resultsHTML;
    }
  }

  renderQuestion(question) {
    if (!question) return;

    // Find or create question text element
    const questionText = this.getElement('#quiz-content') || this.elements.questionText;
    if (questionText) {
      // Clear existing content
      questionText.innerHTML = '';
      
      // Create question element
      const questionDiv = document.createElement('div');
      questionDiv.className = 'mb-6';
      questionDiv.innerHTML = `
        <h3 class="text-xl font-semibold text-gray-900 mb-4">${question.question}</h3>
        <div class="space-y-3" id="quiz-options-container"></div>
      `;
      questionText.appendChild(questionDiv);
      
      const optionsContainer = questionText.querySelector('#quiz-options-container');
      
      // Render options
      if (optionsContainer && question.options) {
        question.options.forEach((option, index) => {
          const btn = document.createElement('button');
          const isSelected = quizModel.answers[question.id] === option;
          btn.className = `w-full text-left p-4 rounded-lg border-2 transition-all ${
            isSelected 
              ? 'border-primary bg-primary/10 text-primary' 
              : 'border-gray-200 hover:border-gray-300 bg-white'
          }`;
          btn.textContent = option;
          btn.onclick = () => {
            quizModel.answerQuestion(question.id, option);
            this.renderQuestion(question); // Re-render to update selection
          };
          optionsContainer.appendChild(btn);
        });
      }
    }

    // Update navigation buttons
    if (this.elements.prevBtn) {
      this.elements.prevBtn.disabled = quizModel.currentIndex === 0;
    }

    if (quizModel.currentIndex === quizModel.questions.length - 1) {
      if (this.elements.nextBtn) this.hide(this.elements.nextBtn);
      if (this.elements.submitBtn) this.show(this.elements.submitBtn);
    } else {
      if (this.elements.nextBtn) this.show(this.elements.nextBtn);
      if (this.elements.submitBtn) this.hide(this.elements.submitBtn);
    }

    // Update question counter
    const currentQuestionEl = this.getElement('#current-question');
    const totalQuestionsEl = this.getElement('#total-questions');
    if (currentQuestionEl) {
      currentQuestionEl.textContent = String(quizModel.currentIndex + 1);
    }
    if (totalQuestionsEl) {
      totalQuestionsEl.textContent = String(quizModel.questions.length);
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

  showLoading() {
    const loadingOverlay = this.getElement('#loading-overlay');
    if (loadingOverlay) {
      loadingOverlay.classList.remove('hidden');
    }
  }

  hideLoading() {
    const loadingOverlay = this.getElement('#loading-overlay');
    if (loadingOverlay) {
      loadingOverlay.classList.add('hidden');
    }
  }
}
