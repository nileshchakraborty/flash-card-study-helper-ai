// @ts-nocheck
import { BaseView } from './base.view.js';
import { eventBus } from '../utils/event-bus.js';
import { quizModel } from '../models/quiz.model.js';
import { apiService } from '../services/api.service.js';

export class QuizView extends BaseView {
  constructor() {
    super();
    this.elements = {
      setup: document.getElementById('quiz-setup'),
      questions: document.getElementById('quiz-questions'),
      results: document.getElementById('quiz-results'),
      historySection: document.getElementById('quiz-history-section'),
      historyList: document.getElementById('quiz-history-list'),
      quizForm: document.getElementById('quiz-form'),
      fromCardsBtn: document.getElementById('quiz-from-cards'),
      fromWebBtn: document.getElementById('quiz-from-web'),
      webQuizOptions: document.getElementById('web-quiz-options'),
      topicInput: document.getElementById('quiz-topic-input'),
      sizeInput: document.getElementById('quiz-size') as HTMLInputElement,
      timerSelect: document.getElementById('quiz-timer') as HTMLSelectElement,
      completionPopup: document.getElementById('quiz-completion-popup'),
      popupScore: document.getElementById('popup-score'),
      popupMessage: document.getElementById('popup-message'),
      btnTryHarder: document.getElementById('btn-try-harder'),
      btnRevise: document.getElementById('btn-revise'),
      btnNewQuiz: document.getElementById('btn-new-quiz'),
      closePopup: document.getElementById('close-quiz-popup'),
      // New elements
      fromFlashcardsBtn: document.getElementById('quiz-from-flashcards-btn'),
      fromTopicBtn: document.getElementById('quiz-from-topic-btn'),
      topicQuizForm: document.getElementById('topic-quiz-form'),
      createQuizTopicForm: document.getElementById('create-quiz-topic-form'),
      quizTopicInputNew: document.getElementById('quiz-topic-input-new') as HTMLInputElement,
      quizTopicCount: document.getElementById('quiz-topic-count') as HTMLInputElement,
      quizTopicTimer: document.getElementById('quiz-topic-timer') as HTMLSelectElement,
      cancelTopicQuiz: document.getElementById('cancel-topic-quiz'),
      availableQuizzesList: document.getElementById('available-quizzes-list'),
      statsSection: document.getElementById('quiz-stats-section'),
      statsTotal: document.getElementById('stats-total-quizzes'),
      statsAvg: document.getElementById('stats-avg-score'),
      statsPerfect: document.getElementById('stats-perfect-scores'),
      flashcardModal: document.getElementById('flashcard-selection-modal'),
      flashcardList: document.getElementById('flashcard-list'),
      selectedFlashcardCount: document.getElementById('selected-flashcard-count'),
      confirmFlashcardSelection: document.getElementById('confirm-flashcard-selection'),
      cancelFlashcardSelection: document.getElementById('cancel-flashcard-selection'),
      closeFlashcardModal: document.getElementById('close-flashcard-modal'),
      // Existing elements that need to be updated to DOM
      questionText: document.getElementById('question-text'),
      optionsContainer: document.getElementById('options-container'),
      prevBtn: document.getElementById('prev-question'),
      nextBtn: document.getElementById('next-question'),
      submitBtn: document.getElementById('submit-quiz'),
      startBtn: document.getElementById('start-quiz-btn'),
      webQuizBtn: document.getElementById('quiz-from-web'),
      webOptions: document.getElementById('web-quiz-options'),
      popup: document.getElementById('quiz-completion-popup'),
      closePopupBtn: document.getElementById('btn-close-popup')
    };

    this.init();
  }

  init() {
    this.bindEvents();
    this.loadHistory();
    this.showSetupState();

    eventBus.on('quiz:started', (question) => {
      this.showQuestionUI();
      this.renderQuestion(question);
    });

    eventBus.on('quiz:question-changed', (question) => {
      // Timer update handled by model tick, but we might want to reset styling
      const timerDisplay = document.getElementById('quiz-timer-display');
      if (timerDisplay) {
        timerDisplay.classList.remove('text-red-600', 'bg-red-50', 'animate-pulse');
        timerDisplay.classList.add('text-gray-600', 'bg-gray-100');
      }
      this.renderQuestion(question);
    });

    eventBus.on('quiz:completed', (result) => {
      const timerDisplay = document.getElementById('quiz-timer-display');
      if (timerDisplay) timerDisplay.classList.add('hidden');
      this.showResultsUI(result);
      this.showPopup(result);
    });

    eventBus.on('quiz:history-updated', (history) => {
      this.renderHistory(history);
    });

    eventBus.on('quiz:available-updated', (quizzes) => {
      this.renderAvailableQuizzes(quizzes);
    });

    eventBus.on('quiz:timer-tick', (remainingTime) => {
      this.updateTimerDisplay(remainingTime);
    });
  }

  showSetupState() {
    // Default state when no quiz has started yet
    this.hide(this.elements.questions);
    this.hide(this.elements.results);
    this.show(this.elements.setup);
  }

  updateTimerDisplay(remainingTime: number) {
    const timerDisplay = document.getElementById('quiz-timer-display');
    if (!timerDisplay) return;

    if (remainingTime > 0) {
      timerDisplay.classList.remove('hidden');
      timerDisplay.classList.add('flex'); // Ensure flex for icon+text
      const min = Math.floor(remainingTime / 60);
      const sec = remainingTime % 60;
      const timeStr = `${min}:${sec < 10 ? '0' : ''}${sec}`;

      const timeSpan = timerDisplay.querySelector('.time-left');
      if (timeSpan) timeSpan.textContent = timeStr;

      // Color indication
      if (remainingTime <= 10) {
        timerDisplay.classList.add('text-red-600', 'bg-red-50');
        timerDisplay.classList.remove('text-gray-600', 'bg-gray-100');
        timerDisplay.classList.add('animate-pulse');
      } else {
        timerDisplay.classList.remove('text-red-600', 'bg-red-50', 'animate-pulse');
        timerDisplay.classList.add('text-gray-600', 'bg-gray-100');
      }
    } else {
      timerDisplay.classList.add('hidden');
      timerDisplay.classList.remove('flex');
    }
  }

  // NEW METHODS FOR ENHANCED QUIZ SYSTEM

  /**
   * Render flashcard selection modal
   */
  renderFlashcardSelectionModal(flashcards: any[], selectedIds: Set<string> = new Set()) {
    if (!this.elements.flashcardList || !this.elements.flashcardModal) return;

    if (!flashcards || flashcards.length === 0) {
      this.elements.flashcardList.innerHTML = `
        <div class="col-span-2 text-center text-gray-500 py-8">
          <span class="material-icons text-5xl mb-2 opacity-50">inbox</span>
          <p>No flashcards available.</p>
          <p class="text-sm mt-2">Create some flashcards first!</p>
        </div>
      `;
      return;
    }

    this.elements.flashcardList.innerHTML = flashcards.map(fc => `
      <div 
        class="flashcard-item p-4 border-2 rounded-xl cursor-pointer transition-all hover:shadow-lg ${selectedIds.has(fc.id)
        ? 'border-purple-500 bg-purple-50'
        : 'border-gray-200 hover:border-purple-200'
      }"
        data-flashcard-id="${fc.id}">
        <div class="flex items-start justify-between mb-2">
          <div class="flex-1">
            <div class="font-semibold text-gray-900 mb-1">${this.escapeHtml(fc.front)}</div>
            <div class="text-sm text-gray-600">${this.escapeHtml(fc.back)}</div>
          </div>
          <div class="ml-3">
            <span class="material-icons text-purple-500 ${selectedIds.has(fc.id) ? '' : 'opacity-0'}">
              check_circle
            </span>
          </div>
        </div>
        ${fc.topic ? `<div class="text-xs text-gray-500 mt-1">${this.escapeHtml(fc.topic)}</div>` : ''}
      </div>
    `).join('');

    // Update count
    if (this.elements.selectedFlashcardCount) {
      this.elements.selectedFlashcardCount.textContent = `${selectedIds.size} selected`;
    }

    // Update button state
    if (this.elements.confirmFlashcardSelection) {
      this.elements.confirmFlashcardSelection.disabled = selectedIds.size === 0;
    }

    // Show modal
    this.elements.flashcardModal.classList.remove('hidden');
  }

  /**
   * Hide flashcard selection modal
   */
  hideFlashcardSelectionModal() {
    if (this.elements.flashcardModal) {
      this.elements.flashcardModal.classList.add('hidden');
    }
  }

  /**
   * Render available quizzes list
   */
  renderAvailableQuizzes(quizzes: any[]) {
    if (!this.elements.availableQuizzesList) return;

    if (!quizzes || quizzes.length === 0) {
      this.elements.availableQuizzesList.innerHTML = `
        <div class="text-gray-500 text-sm italic flex items-center justify-between">
          <span>No quizzes created yet.</span>
          <button class="text-indigo-600 hover:text-indigo-800 font-semibold" id="available-create-btn">Create Quiz</button>
        </div>
      `;
      const btn = document.getElementById('available-create-btn');
      if (btn) btn.addEventListener('click', () => {
        const tabBtn = document.querySelector('[data-tab="create-quiz"]') as HTMLElement;
        tabBtn?.click();
      });
      return;
    }

    this.elements.availableQuizzesList.innerHTML = quizzes.map(quiz => `
      <button type="button"
        class="quiz-item w-full text-left p-4 border-2 border-gray-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50/70 transition-all cursor-pointer group flex items-center justify-between"
        data-quiz-id="${quiz.id}">
        <div class="flex-1">
          <div class="font-semibold text-gray-900 mb-1">${this.escapeHtml(quiz.topic)}</div>
          <div class="text-sm text-gray-600">
            ${(quiz.questions?.length || 0)} questions • 
            ${quiz.source === 'flashcards' ? '📚 From Flashcards' : '🌐 From Topic'}
          </div>
          <div class="text-xs text-gray-500 mt-1">
            Created ${this.formatTimeAgo(quiz.createdAt)}
          </div>
        </div>
        <span class="material-icons text-4xl text-indigo-600 group-hover:text-indigo-800">play_circle_filled</span>
      </button>
    `).join('');

    // Delegate click handling to the container to avoid missing bindings
    this.elements.availableQuizzesList.onclick = (e: Event) => {
      const target = (e.target as HTMLElement);
      const container = target.closest('.quiz-item') as HTMLElement | null;
      const quizId = container?.dataset.quizId;

      console.log('[QuizView] available quiz click', {
        target: target.tagName,
        quizId,
        hasContainer: !!container
      });

      if (!quizId) return;
      eventBus.emit('quiz:start-prefetched', { quizId });
    };
  }

  /**
   * Show topic quiz form
   */
  showTopicQuizForm() {
    if (this.elements.topicQuizForm) {
      this.elements.topicQuizForm.classList.remove('hidden');
    }
  }

  /**
   * Hide topic quiz form
   */
  hideTopicQuizForm() {
    if (this.elements.topicQuizForm) {
      this.elements.topicQuizForm.classList.add('hidden');
      // Reset form
      if (this.elements.createQuizTopicForm) {
        (this.elements.createQuizTopicForm as HTMLFormElement).reset();
      }
    }
  }

  /**
   * Escape HTML to prevent XSS
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Format time ago
   */
  private formatTimeAgo(timestamp: number): string {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);

    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  bindEvents() {
    // Quiz form submission
    if (this.elements.createQuizTopicForm) {
      this.bind(this.elements.createQuizTopicForm, 'submit', async (e) => {
        e.preventDefault();
        const topicInput = this.getElement('#quiz-topic-input-new') as HTMLInputElement;
        const countInput = this.getElement('#quiz-topic-count') as HTMLInputElement;
        const timerInput = this.getElement('#quiz-topic-timer') as HTMLSelectElement;

        const count = parseInt(countInput?.value || '5');
        const topic = topicInput?.value || 'General';
        const timer = parseInt(timerInput?.value || '0');

        (window as any).quizTimer = timer;
        eventBus.emit('quiz:request-start', { count, topic, timer });
      });
    }

    // From Flashcards Button
    if (this.elements.fromFlashcardsBtn) {
      this.bind(this.elements.fromFlashcardsBtn, 'click', async () => {
        import('../models/deck.model.js').then(({ deckModel }) => {
          this.currentFlashcards = deckModel.cards || [];
          this.selectedFlashcardIds = new Set(this.currentFlashcards.map(c => c.id));
          this.renderFlashcardSelectionModal(this.currentFlashcards, this.selectedFlashcardIds);
        });
      });
    }

    // Flashcard Modal Bindings
    if (this.elements.cancelFlashcardSelection) {
      this.bind(this.elements.cancelFlashcardSelection, 'click', () => this.hideFlashcardSelectionModal());
    }
    if (this.elements.closeFlashcardModal) {
      this.bind(this.elements.closeFlashcardModal, 'click', () => this.hideFlashcardSelectionModal());
    }

    // Flashcard Selection Toggle
    if (this.elements.flashcardList) {
      this.bind(this.elements.flashcardList, 'click', (e) => {
        const item = (e.target as HTMLElement).closest('.flashcard-item');
        if (item) {
          const id = (item as HTMLElement).dataset.flashcardId;
          if (id) {
            if (this.selectedFlashcardIds.has(id)) {
              this.selectedFlashcardIds.delete(id);
            } else {
              this.selectedFlashcardIds.add(id);
            }
            this.renderFlashcardSelectionModal(this.currentFlashcards, this.selectedFlashcardIds);
          }
        }
      });
    }

    // Confirm Selection
    if (this.elements.confirmFlashcardSelection) {
      this.bind(this.elements.confirmFlashcardSelection, 'click', () => {
        const selectedCards = this.currentFlashcards.filter(c => this.selectedFlashcardIds.has(c.id));
        if (selectedCards.length > 0) {
          this.hideFlashcardSelectionModal();
          // Start quiz with selected cards
          import('../services/settings.service.js').then(async ({ settingsService }) => {
            // We need to generate quiz from these cards first (or just pass them as raw questions?)
            // AppController handles quiz:request-start usually.
            // But here we have specific cards. 
            // We'll mimic AppController's logic or emit a special event.
            // For now, let's use quiz:request-start with a special payload or handle it here?
            // AppController listens to quiz:request-start with count/topic.
            // It also has logic for "from cards".

            // Alternative: Emit custom event 'quiz:start-from-selection'
            // But simpler: use AppController's prefetch logic or similar.
            // Actually, looking at AppController, it handles 'quiz:request-start' and uses deckModel.cards if topic matches.

            // Let's emit a new event 'quiz:start-with-cards' that AppController listens to?
            // Or just call API here?

            // Let's just do it directly here for now to ensure it works, then refactor.
            // Actually, AppController logic is complex.
            eventBus.emit('quiz:start-with-cards', selectedCards);
          });
        }
      });
    }

    // From Topic Button - Show form
    if (this.elements.fromTopicBtn) {
      this.bind(this.elements.fromTopicBtn, 'click', () => {
        this.showTopicQuizForm();
      });
    }

    // Cancel Topic Quiz
    if (this.elements.cancelTopicQuiz) {
      this.bind(this.elements.cancelTopicQuiz, 'click', () => {
        this.hideTopicQuizForm();
      });
    }

    // From Deck Button (Direct Start)
    const fromDeckBtn = this.getElement('#quiz-from-deck-btn');
    if (fromDeckBtn) {
      this.bind(fromDeckBtn, 'click', () => {
        // Import model dynamically or assume global
        import('../models/deck.model.js').then(({ deckModel }) => {
          if (deckModel.cards.length > 0) {
            eventBus.emit('quiz:request-start', { count: deckModel.cards.length, topic: deckModel.currentTopic });
          } else {
            alert('No cards in current deck.');
          }
        });
      });
    }

    // Legacy support or misc
    if (this.elements.webQuizBtn) {
      this.bind(this.elements.webQuizBtn, 'click', () => {
        if (this.elements.webOptions) {
          this.elements.webOptions.classList.toggle('hidden');
        }
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

    // Try Harder Quiz button
    if (this.elements.btnTryHarder) {
      this.bind(this.elements.btnTryHarder, 'click', () => {
        this.hide(this.elements.popup);
        eventBus.emit('quiz:requestHarder', {});
      });
    }
  }

  showQuestionUI() {
    console.log('[QuizView] showQuestionUI called');
    console.log('[QuizView] setup element:', this.elements.setup);
    console.log('[QuizView] questions element:', this.elements.questions);

    // Setup is in a different tab, so we don't need to hide it explicitly.
    // Tab switching handles visibility.
    this.hide(this.elements.results);
    this.show(this.elements.questions);
    this.hide(this.elements.setup);

    console.log('[QuizView] setup classes:', this.elements.setup?.className);
    console.log('[QuizView] questions classes:', this.elements.questions?.className);
  }

  showResultsUI(result) {
    this.hide(this.elements.setup);
    this.hide(this.elements.questions);
    this.show(this.elements.results);

    // Show stats and history when results are shown
    if (this.elements.statsSection) this.show(this.elements.statsSection);
    if (this.elements.historySection) this.show(this.elements.historySection);

    // Refresh the stats content since we just finished a quiz
    // We can assume the model has reloaded history or we need to trigger it
    // But renderStats is called by 'quiz:history-updated'. 
    // Usually model.submitQuiz() triggers history reload/update.

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
          btn.className = `w-full text-left p-4 rounded-lg border-2 transition-all ${isSelected
            ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-md'
            : 'border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50'
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

    // Render Stats
    this.renderStats(history);

    if (history.length === 0) {
      this.elements.historyList.innerHTML = '<div class="text-gray-500 text-sm italic">No quiz history found.</div>';
      return;
    }

    this.elements.historyList.innerHTML = history.map((quiz, index) => `
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden transition-all duration-300">
        <div class="p-4 flex justify-between items-center cursor-pointer hover:bg-gray-50" onclick="document.getElementById('history-details-${index}').classList.toggle('hidden')">
          <div>
            <h4 class="font-semibold text-gray-800">${quiz.topic}</h4>
            <p class="text-xs text-gray-500">${new Date(quiz.timestamp).toLocaleDateString()} • ${new Date(quiz.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
          <div class="flex items-center gap-4">
             <div class="text-right">
                <div class="text-sm font-medium text-gray-900">Score: ${quiz.score}/${quiz.total}</div>
                <div class="text-xs font-bold ${quiz.score / quiz.total >= 0.7 ? 'text-green-600' : 'text-orange-500'}">
                  ${Math.round((quiz.score / quiz.total) * 100)}%
                </div>
             </div>
             <span class="material-icons text-gray-400">expand_more</span>
          </div>
        </div>
        <div id="history-details-${index}" class="hidden border-t border-gray-100 bg-gray-50 p-4 space-y-3">
            ${quiz.results.map((r, i) => `
                <div class="text-sm">
                    <div class="font-medium text-gray-900 mb-1">${i + 1}. ${r.question}</div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div class="${r.correct ? 'text-green-700 bg-green-50' : 'text-red-700 bg-red-50'} p-2 rounded border ${r.correct ? 'border-green-200' : 'border-red-200'}">
                            <span class="font-semibold">Your Answer:</span> ${r.userAnswer || 'Skipped'}
                        </div>
                        <div class="text-gray-700 bg-white p-2 rounded border border-gray-200">
                            <span class="font-semibold">Correct Answer:</span> ${r.expected || r.correctAnswer}
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
      </div>
    `).join('');
  }

  renderStats(history) {
    if (!this.elements.statsSection || history.length === 0) {
      if (this.elements.statsSection) this.hide(this.elements.statsSection);
      return;
    }

    // this.show(this.elements.statsSection); // Do not show automatically on load

    const totalQuizzes = history.length;
    const totalScore = history.reduce((acc, curr) => acc + (curr.score / curr.total), 0);
    const avgScore = Math.round((totalScore / totalQuizzes) * 100);
    const perfectScores = history.filter(q => q.score === q.total).length;

    if (this.elements.statsTotal) this.elements.statsTotal.textContent = totalQuizzes.toString();
    if (this.elements.statsAvg) this.elements.statsAvg.textContent = `${avgScore}%`;
    if (this.elements.statsPerfect) this.elements.statsPerfect.textContent = perfectScores.toString();
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
                <button id="btn-quiz-review" class="w-full bg-indigo-600 text-white border-2 border-indigo-600 px-6 py-3 rounded-lg hover:bg-indigo-700 hover:border-indigo-700 transition-all mb-3 flex items-center justify-center gap-2 shadow-lg">
                    <span class="material-icons">visibility</span>
                    Review Quiz
                </button>
                <button id="btn-quiz-harder" class="btn-primary w-full px-6 py-3 rounded-lg hover:shadow-lg transition-all mb-3 flex items-center justify-center gap-2">
                    <span class="material-icons">psychology</span>
                    Try Harder Questions Quiz
                </button>
                <button id="btn-quiz-retry" class="w-full bg-white text-gray-700 border-2 border-gray-200 px-6 py-3 rounded-lg hover:border-indigo-600 hover:text-indigo-600 transition-all flex items-center justify-center gap-2">
                    <span class="material-icons">refresh</span>
                    Retry Quiz
                </button>
            `;
    } else if (percentage < 80) {
      message = "Keep practicing! Review the flashcards to improve.";
      actionButtons = `
                <button id="btn-quiz-review" class="w-full bg-indigo-600 text-white border-2 border-indigo-600 px-6 py-3 rounded-lg hover:bg-indigo-700 hover:border-indigo-700 transition-all mb-3 flex items-center justify-center gap-2 shadow-lg">
                    <span class="material-icons">visibility</span>
                    Review Quiz
                </button>
                <button id="btn-quiz-retry" class="w-full bg-white text-gray-700 border-2 border-gray-200 px-6 py-3 rounded-lg hover:border-indigo-600 hover:text-indigo-600 transition-all mb-3 flex items-center justify-center gap-2">
                    <span class="material-icons">refresh</span>
                    Retry Quiz
                </button>
                <button id="btn-quiz-revise" class="btn-primary w-full px-6 py-3 rounded-lg hover:shadow-lg transition-all flex items-center justify-center gap-2">
                    <span class="material-icons">school</span>
                    Revise Flashcards
                </button>
            `;
    } else {
      // 80-99%
      message = "Great job! You're doing well.";
      actionButtons = `
                <button id="btn-quiz-review" class="w-full bg-indigo-600 text-white border-2 border-indigo-600 px-6 py-3 rounded-lg hover:bg-indigo-700 hover:border-indigo-700 transition-all mb-3 flex items-center justify-center gap-2 shadow-lg">
                    <span class="material-icons">visibility</span>
                    Review Quiz
                </button>
                <button id="btn-quiz-harder" class="btn-primary w-full px-6 py-3 rounded-lg hover:shadow-lg transition-all mb-3 flex items-center justify-center gap-2">
                    <span class="material-icons">psychology</span>
                    Try Harder Questions Quiz
                </button>
                <button id="btn-quiz-retry" class="w-full bg-white text-gray-700 border-2 border-gray-200 px-6 py-3 rounded-lg hover:border-indigo-600 hover:text-indigo-600 transition-all flex items-center justify-center gap-2">
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
      this.elements.popup.firstElementChild.appendChild(actionsContainer);
    }
    actionsContainer.innerHTML = actionButtons;

    // Bind events
    const retryBtn = actionsContainer.querySelector('#btn-quiz-retry');
    const harderBtn = actionsContainer.querySelector('#btn-quiz-harder');
    const reviseBtn = actionsContainer.querySelector('#btn-quiz-revise');
    const reviewBtn = actionsContainer.querySelector('#btn-quiz-review');

    if (reviewBtn) {
      reviewBtn.addEventListener('click', () => {
        this.hide(this.elements.popup);
        // Results UI is already shown by showResultsUI
      });
    }

    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        this.hide(this.elements.popup);
        eventBus.emit('quiz:retry', null);
      });
    }

    if (harderBtn) {
      harderBtn.addEventListener('click', () => {
        this.hide(this.elements.popup);
        eventBus.emit('quiz:requestHarder', {});
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
    this.updateLoadingProgress(0, 'Preparing your quiz...');
  }

  hideLoading() {
    const loadingOverlay = this.getElement('#loading-overlay');
    if (loadingOverlay) {
      loadingOverlay.classList.add('hidden');
    }
  }

  updateLoadingProgress(progress?: number, message?: string) {
    const progressEl = document.getElementById('loading-progress');
    const progressBar = document.getElementById('loading-progress-bar') as HTMLElement | null;
    const parts = [];
    if (typeof progress === 'number') {
      const pct = Math.max(0, Math.min(100, Math.round(progress)));
      parts.push(`Progress: ${pct}% `);
      if (progressBar) progressBar.style.width = `${pct}% `;
    }
    if (message) parts.push(message);
    if (progressEl) progressEl.textContent = parts.join(' • ') || 'Working...';
  }
}
