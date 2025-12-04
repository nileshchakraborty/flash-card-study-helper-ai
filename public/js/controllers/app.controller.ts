// @ts-nocheck
import { GeneratorView } from '../views/generator.view.js';
import { StudyView } from '../views/study.view.js';
import { QuizView } from '../views/quiz.view.js';
import { deckModel } from '../models/deck.model.js';
import { quizModel } from '../models/quiz.model.js';
import { apiService } from '../services/api.service.js';
import { eventBus } from '../utils/event-bus.js';
import { initializeQuizHandlers } from '../quiz-init.js';
import { settingsService } from '../services/settings.service.js';
import { storageService } from '../services/storage.service.js';

export class AppController {
  private generatorView: any;
  private studyView: any;
  private quizView: any;
  private deckHistory: any[] = [];

  constructor() {
    this.generatorView = new GeneratorView();
    this.studyView = new StudyView();
    this.quizView = new QuizView();
    this.deckHistory = [];

    this.init();
  }

  init() {
    this.setupTabSwitching();
    this.setupGlobalEvents();

    // Initialize quiz creation and management handlers
    initializeQuizHandlers(this.quizView);

    // Initial load
    this.loadInitialState();
  }

  async loadInitialState() {
    await deckModel.loadInitialDeck();

    // Seed available quizzes list with anything cached/prefetched
    if (typeof quizModel.listPrefetched === 'function') {
      this.quizView.renderAvailableQuizzes([
        ...storageService.getAllQuizzes(),
        ...quizModel.listPrefetched()
      ]);
    } else {
      this.quizView.renderAvailableQuizzes(storageService.getAllQuizzes());
    }

    // Always show Study tab first (with demo card if no cards exist)
    // The demo card will be shown automatically by DeckModel.getCurrentCard()
    if (deckModel.cards.length === 0) {
      // Trigger rendering of demo card
      eventBus.emit('card:changed', deckModel.getCurrentCard());
      eventBus.emit('deck:updated', deckModel.getStats());
    } else {
      // Has cards, render them
      deckModel.setCards(deckModel.cards);
    }
  }

  setupTabSwitching() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetTab = btn.dataset.tab;

        // Update buttons
        tabButtons.forEach((b) => {
          b.classList.remove('border-gray-900', 'text-gray-900');
          b.classList.add('border-transparent', 'text-gray-500');
        });
        btn.classList.remove('border-transparent', 'text-gray-500');
        btn.classList.add('border-gray-900', 'text-gray-900');

        // Update content
        tabContents.forEach((content) => {
          content.classList.add('hidden');
          if (content.id === `${targetTab}-tab`) {
            content.classList.remove('hidden');
          }
        });
      });
    });
  }

  setupGlobalEvents() {
    // Handle deck loaded event (from generator or history)
    eventBus.on('deck:loaded', (cards) => {
      console.log('AppController received deck:loaded event with', cards?.length, 'cards');
      deckModel.setCards(cards);
      storageService.storeFlashcards(cards || []);
      // Kick off quiz pre-generation for the current deck (guard listPrefetched availability)
      this.prefetchQuizFromCards(cards);
      // Switch to study tab
      const studyTab = document.querySelector('[data-tab="study"]');
      console.log('Switching to study tab:', studyTab);
      if (studyTab) {
        (studyTab as HTMLElement).click();
      }
    });

    // Handle quiz start request
    eventBus.on('quiz:request-start', async ({ count, topic, timer }) => {
      // If we already have a prefetched quiz for this topic, start instantly
      const prefetched = quizModel.listPrefetched().find(q => q.topic === (topic || deckModel.currentTopic));
      if (prefetched && prefetched.questions?.length) {
        quizModel.startQuiz(prefetched.questions, 'standard', prefetched.topic);
        this.switchTab('create-quiz');
        this.quizView.showQuestionUI();
        this.quizView.renderQuestion(prefetched.questions[0]);
        return;
      }

      this.quizView.showLoading();

      try {
        let response;
        const cards = deckModel.cards;

        // If topic is provided and different from current topic, generate from web
        // Otherwise use current deck cards
        if (topic && topic.trim() && (topic !== deckModel.currentTopic || cards.length === 0)) {
          // Generate quiz from web/topic using StudyService
          // First generate flashcards, then create quiz from them
          // Check authentication for backend generation
          if (!apiService.isAuthenticated()) {
            const login = confirm('Generating quizzes from new topics requires a free account. Would you like to log in?');
            if (login) {
              window.location.href = '/api/auth/google';
            }
            this.quizView.hideLoading();
            return;
          }


          const flashcardResponse = await apiService.generateFlashcards({
            topic: topic,
            count: count,
            mode: 'standard',
            knowledgeSource: 'ai-web'
          });

          // If async job, we need to poll for results
          if (flashcardResponse.jobId) {
            const jobResult = await apiService.waitForJobResult(flashcardResponse.jobId, {
              maxWaitMs: 150000,
              pollIntervalMs: 2000,
              onProgress: (p) => this.quizView.updateLoadingProgress(p, 'Generating quiz questions...')
            });

            const generatedCards = jobResult?.cards;

            if (generatedCards && generatedCards.length > 0) {
              const quizResponse = await apiService.post('/quiz', {
                cards: generatedCards,
                count: count,
                topic: topic,
                preferredRuntime: settingsService.getPreferredRuntime()
              });

              if (quizResponse.questions) {
                quizModel.startQuiz(quizResponse.questions, 'standard', topic);
              } else {
                throw new Error('Invalid quiz response from server');
              }
            } else {
              throw new Error('Failed to generate flashcards for quiz');
            }
          } else if (flashcardResponse.cards) {
            // Direct response with cards
            const quizResponse = await apiService.post('/quiz', {
              cards: flashcardResponse.cards,
              count: count,
              topic: topic,
              preferredRuntime: settingsService.getPreferredRuntime()
            });

            if (quizResponse.questions) {
              quizModel.startQuiz(quizResponse.questions, 'standard', topic);
            } else {
              throw new Error('Invalid quiz response from server');
            }
          } else {
            throw new Error('Failed to generate flashcards for quiz');
          }
        } else if (cards.length > 0) {
          // Generate from current deck
          const quizTopic = topic || deckModel.currentTopic || 'General';
          response = await apiService.post('/quiz', {
            cards: cards,
            count: count,
            topic: quizTopic,
            preferredRuntime: settingsService.getPreferredRuntime()
          });

          if (response.questions) {
            quizModel.startQuiz(response.questions, 'standard', quizTopic);
          } else {
            throw new Error('Invalid quiz response from server');
          }
        } else {
          alert('No cards available to generate quiz from. Please create flashcards first or enter a topic.');
          return;
        }

        // Show the actual quiz UI (lives under Create Quiz tab)
        this.switchTab('create-quiz');

      } catch (error: any) {
        console.error("Quiz generation failed", error);
        alert(`Failed to start quiz: ${error.message || 'Unknown error'}`);
      } finally {
        this.quizView.hideLoading();
      }
    });

    // Handle quiz retry
    eventBus.on('quiz:retry', () => {
      // Restart current quiz
      if (quizModel.questions.length > 0) {
        quizModel.startQuiz(quizModel.questions, quizModel.mode);
      }
    });

    // Start a prefetched quiz (from available list)
    eventBus.on('quiz:start-prefetched', async ({ quizId }) => {
      console.log('[Quiz] start-prefetched clicked', { quizId });
      let quiz: any = null;

      const prefetched = typeof quizModel.listPrefetched === 'function'
        ? quizModel.listPrefetched().find((q: any) => q.id === quizId)
        : null;
      const stored = storageService.getQuiz ? storageService.getQuiz(quizId) : null;
      quiz = prefetched || stored;
      console.log('[Quiz] prefetched/stored lookup', { hasPrefetched: !!prefetched, hasStored: !!stored, quizHasQuestions: !!quiz?.questions?.length });

      // If we don't have questions, try fetching from API
      if (!quiz || !quiz.questions || quiz.questions.length === 0) {
        try {
          console.log('[Quiz] fetching quiz from API', quizId);
          const apiQuiz = await apiService.getQuiz(quizId);
          if (apiQuiz?.success && apiQuiz.quiz) {
            quiz = apiQuiz.quiz;
            // Normalize shape if backend returns questions array without ids
            if (quiz.questions) {
              quiz.questions = quiz.questions.map((q: any, idx: number) => ({
                id: q.id || q.cardId || `${quiz.id}-q-${idx}`,
                question: q.question,
                options: q.options || [],
                correctAnswer: q.correctAnswer || q.answer || q.expected,
                explanation: q.explanation
              }));
            }
            if (storageService.storeQuiz) storageService.storeQuiz(apiQuiz.quiz);
            console.log('[Quiz] fetched quiz from API', { questionCount: quiz?.questions?.length });
          }
        } catch (err) {
          console.warn('Failed to fetch quiz from API:', err?.message || err);
        }
      }

      // Final guard: if quiz exists but still has no questions, surface detailed log
      if (quiz && (!quiz.questions || quiz.questions.length === 0)) {
        console.warn('[Quiz] quiz loaded without questions, cannot start', { quizId, quizKeys: Object.keys(quiz || {}) });
        alert('Quiz data is missing questions. Please refresh quizzes or regenerate.');
        return;
      }

      if (quiz && quiz.questions?.length) {
        console.log('[Quiz] starting quiz', { topic: quiz.topic, questionCount: quiz.questions.length });
        quizModel.startQuiz(quiz.questions, 'standard', quiz.topic || 'Quiz');
        this.switchTab('create-quiz');
        this.quizView.showQuestionUI();
        this.quizView.renderQuestion(quiz.questions[0]);
      } else {
        console.warn('[Quiz] quiz data missing; cannot start', { quizId });
        alert('Quiz data not found. Please regenerate the quiz.');
      }
    });

    // Handle harder quiz request
    eventBus.on('quiz:harder', async () => {
      // Generate new quiz with same cards but request harder questions
      // For now, we'll just trigger a new generation which will use the updated backend logic
      // Ideally we'd pass a "difficulty" flag, but our backend prompt already asks for mixed difficulty.
      // Let's just regenerate for now.
      const count = quizModel.questions.length;
      const topic = deckModel.currentTopic;

      eventBus.emit('quiz:request-start', { count, topic });
    });

    // Handle revise flashcards request
    eventBus.on('quiz:revise', () => {
      // Switch to study tab
      const studyTab = document.querySelector('[data-tab="study"]');
      if (studyTab) {
        (studyTab as HTMLElement).click();
      }
      // Reset deck to start
      if (deckModel.cards.length > 0) {
        deckModel.setCards(deckModel.cards);
      }
    });

    // Handle harder cards request
    eventBus.on('deck:harder', async (data) => {
      const topic = deckModel.currentTopic;
      if (!topic) {
        alert('No topic found to generate harder cards.');
        return;
      }

      const difficulty = data?.difficulty || 'basics';
      let topicSuffix = '';

      if (difficulty === 'deep-dive') {
        topicSuffix = ' (Advanced Deep Dive)';
      } else {
        topicSuffix = ' (Fundamentals)';
      }

      const enhancedTopic = `${topic}${topicSuffix}`;

      // Check authentication for Deep Dive
      if (!apiService.isAuthenticated()) {
        const login = confirm('Deep Dive features require a free account to save your progress and access advanced AI models. Would you like to log in with Google?');
        if (login) {
          window.location.href = '/api/auth/google';
        }
        return;
      }

      // Show loading
      this.generatorView.showLoading();

      try {
        console.log('Generating harder flashcards for:', enhancedTopic);
          const data = await apiService.generateFlashcards({
            topic: difficulty === 'deep-dive' ? topic : enhancedTopic,
            count: 10,
            mode: difficulty === 'deep-dive' ? 'deep-dive' : 'standard',
            parentTopic: (window as any).currentParentTopic
          });

        let cards = data.cards;
        let recommendedTopics = data.recommendedTopics;

        if ((!cards || cards.length === 0) && data.jobId) {
          const jobResult = await apiService.waitForJobResult(data.jobId, {
            maxWaitMs: 180000,
            pollIntervalMs: 2000,
            onProgress: (p) => this.generatorView.updateLoadingProgress(p, 'Generating harder flashcards...')
          });

          cards = jobResult?.cards || [];
          recommendedTopics = jobResult?.recommendedTopics || recommendedTopics;
        }

        if (cards && cards.length > 0) {
          // Save deck
          const deck = {
            id: Date.now().toString(),
            topic: topic,
            cards: cards,
            timestamp: Date.now()
          };

          // Add to history
          this.deckHistory.unshift(deck);
          this.renderDeckHistory();

          // Save to backend
          await apiService.post('/decks', deck);

          // Switch to study tab
          this.currentDeck = deck;
          deckModel.setCards(deck.cards);
          this.studyView.renderCard(deckModel.getCurrentCard());
          this.studyView.updateStats(deckModel.getStats());
          this.switchTab('study');

          // Handle Recommendations
          const recommendedContainer = document.getElementById('recommended-paths');
          const recommendedList = document.getElementById('recommended-list');

          if (recommendedTopics && recommendedTopics.length > 0) {
            if (recommendedContainer && recommendedList) {
              recommendedContainer.classList.remove('hidden');
              recommendedList.innerHTML = recommendedTopics.map((subTopic: string) => `
                    <button class="recommended-topic-btn w-full text-left p-4 rounded-lg border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all group" data-topic="${subTopic}" data-parent="${topic}">
                        <div class="flex items-center justify-between">
                            <span class="font-medium text-gray-700 group-hover:text-indigo-700">${subTopic}</span>
                            <span class="material-icons text-gray-400 group-hover:text-indigo-500 text-sm">arrow_forward</span>
                        </div>
                    </button>
                `).join('');

              // Add listeners
              recommendedList.querySelectorAll('.recommended-topic-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                  const target = e.currentTarget as HTMLElement;
                  const newTopic = target.dataset.topic;
                  const parent = target.dataset.parent;

                  // Set context and trigger generation
                  (window as any).currentParentTopic = parent;
                  const topicInput = document.getElementById('topic-input') as HTMLInputElement;
                  if (topicInput) {
                    topicInput.value = newTopic || '';
                    // Switch back to create tab if not already (though we are likely there)
                    this.switchTab('create');
                    // Trigger generation
                    const generateBtn = document.getElementById('generate-btn');
                    if (generateBtn) generateBtn.click();
                  }
                });
              });
            }
          } else {
            // Hide if no recommendations (unless we want to keep previous ones? No, clear them for new topic)
            if (recommendedContainer) recommendedContainer.classList.add('hidden');
            (window as any).currentParentTopic = null; // Reset context
          }

        } else {
          throw new Error('No flashcards generated');
        }
      } catch (error) {
        console.error('Generation error:', error);
        alert('Failed to generate harder cards.');
      } finally {
        this.generatorView.hideLoading();
      }
    });



    // Handle review request
    eventBus.on('deck:review', () => {
      // Restart the current deck
      if (deckModel.cards.length > 0) {
        deckModel.setCards(deckModel.cards);
      }
    });
  }

  /**
   * Pre-generate a quiz for a given set of cards and cache it for quick start.
   */
  async prefetchQuizFromCards(cards: any[]) {
    if (!cards || cards.length === 0) return;
    const topic = cards[0].topic || 'General';
    try {
      const response = await apiService.post('/quiz', {
        cards,
        count: Math.min(10, cards.length),
        topic,
        preferredRuntime: settingsService.getPreferredRuntime()
      });

      if (response?.questions?.length) {
        quizModel.addPrefetchedQuiz({
          id: response.id || `prefetch-${Date.now()}`,
          topic,
          questions: response.questions,
          source: 'flashcards'
        });
      }
    } catch (error) {
      console.warn('Prefetch quiz failed:', (error as Error).message);
    }
  }

  renderDeckHistory() {
    const historyList = document.getElementById('deck-history-list');
    if (!historyList) return;

    if (this.deckHistory.length === 0) {
      historyList.innerHTML = '<div class="text-gray-500 text-sm italic">No recent decks found.</div>';
      return;
    }

    historyList.innerHTML = this.deckHistory.map(deck => `
      <div class="bg-gray-50 p-4 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors cursor-pointer" onclick="window.loadDeck('${deck.id}')">
        <div class="font-medium text-gray-900 mb-1">${deck.topic}</div>
        <div class="text-sm text-gray-500">${deck.cards.length} cards • ${new Date(deck.timestamp).toLocaleDateString()}</div>
      </div>
    `).join('');

    // Expose loadDeck globally
    (window as any).loadDeck = (id: string) => {
      const deck = this.deckHistory.find(d => d.id === id);
      if (deck) {
        this.currentDeck = deck;
        deckModel.setCards(deck.cards);
        this.studyView.renderCard(deckModel.getCurrentCard());
        this.studyView.updateStats(deckModel.getStats());
        this.switchTab('study');
      }
    };
  }

  switchTab(tabId: string) {
    const tabBtn = document.querySelector(`[data-tab="${tabId}"]`);
    if (tabBtn) {
      (tabBtn as HTMLElement).click();
    }
  }
}
