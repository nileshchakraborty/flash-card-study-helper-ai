import { GeneratorView } from '../views/generator.view.js';
import { StudyView } from '../views/study.view.js';
import { QuizView } from '../views/quiz.view.js';
import { deckModel } from '../models/deck.model.js';
import { quizModel } from '../models/quiz.model.js';
import { apiService } from '../services/api.service.js';
import { eventBus } from '../utils/event-bus.js';
import { settingsService } from '../services/settings.service.js';
import { storageService } from '../services/storage.service.js';

type DeckHistoryEntry = {
  id: string;
  topic: string;
  cards: Array<{ id: string; front: string; back: string; topic?: string }>;
  timestamp: number;
};

type QuizPrefetched = {
  id: string;
  topic: string;
  questions: Array<{ id: string; question: string; options: string[]; correctAnswer: string; explanation?: string }>;
  source: 'flashcards' | 'topic';
  createdAt: number;
};

type DeckCard = { id: string; front: string; back: string; topic?: string };
type QuizStartEvent = { count: number; topic?: string; timer?: number };
type QuizStartPrefetchedEvent = { quizId: string };
// type HarderEvent = { difficulty?: 'deep-dive' | 'basics' }; (Unused)
// type QuizResultPayload = { cards: DeckCard[]; recommendedTopics?: string[] }; (Unused)

export class AppController {
  private generatorView: GeneratorView;
  private studyView: StudyView;
  private quizView: QuizView;
  private deckHistory: DeckHistoryEntry[] = [];
  private currentDeck: any = null;

  constructor() {
    this.generatorView = new GeneratorView();
    this.studyView = new StudyView();
    this.quizView = new QuizView();
    this.deckHistory = [];
    this.currentDeck = null;

    this.init();
  }

  init() {
    this.setupTabSwitching();
    this.setupGlobalEvents();

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

    // Load deck history from API
    try {
      const history: any = await apiService.getDecks();
      this.deckHistory = history.map((d: any) => ({
        ...d,
        timestamp: typeof d.timestamp === 'string' ? new Date(d.timestamp).getTime() : d.timestamp
      }));
      if (this.deckHistory) {
        this.renderDeckHistory();
      }
    } catch (e) {
      console.warn('Failed to load deck history:', e);
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
    const tabButtons = document.querySelectorAll('.nav-tab');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetTab = (btn as HTMLElement).dataset.tab;

        // Update buttons
        tabButtons.forEach((b) => {
          b.classList.remove('active');
          // Start with transparent/gray but active class handles color
          b.classList.remove('text-indigo-600');
        });
        btn.classList.add('active');

        // Update content
        tabContents.forEach((content) => {
          content.classList.add('hidden');
          if (content.id === `${targetTab}-tab`) {
            content.classList.remove('hidden');
          }
        });

        // Specific view resets if needed
        if (targetTab === 'create') {
          // Ensure generator view is in clean state if needed
        }
      });
    });
  }

  setupGlobalEvents() {
    // Handle deck loaded event (from generator or history)
    eventBus.on('deck:loaded', (cards: DeckCard[]) => {
      console.log('AppController received deck:loaded event with', cards?.length, 'cards');
      deckModel.setCards(cards);
      storageService.storeFlashcards(cards || []);
      // Kick off quiz pre-generation for the current deck
      this.prefetchQuizFromCards(cards);
      // Switch to study tab
      this.switchTab('study');
    });

    // Handle quiz start request
    eventBus.on('quiz:request-start', async ({ count, topic, timer }: QuizStartEvent) => {
      // Logic from before...
      const prefetched = quizModel.listPrefetched().find((q: QuizPrefetched) => q.topic === (topic || deckModel.currentTopic));
      if (prefetched && prefetched.questions?.length) {
        // If it was prefetched, we might not have the timer setting stored in it unless we add it to prefetched type.
        // But the user just requested it with specific settings. 
        // Ideally we should regenerate or just apply the timer to the existing questions.
        // Let's apply the requested timer.
        quizModel.startQuiz(prefetched.questions, 'standard', prefetched.topic, timer || 0);
        this.switchTab('quiz');
        this.quizView.showQuestionUI();
        this.quizView.renderQuestion(prefetched.questions[0]);
        return;
      }

      this.quizView.showLoading();

      try {
        let response;
        const cards = deckModel.cards;

        if (topic && topic.trim() && (topic !== deckModel.currentTopic || cards.length === 0)) {
          if (!apiService.isAuthenticated()) {
            const login = confirm('Generating quizzes from new topics requires a free account. Would you like to log in?');
            if (login) window.location.href = '/api/auth/google';
            this.quizView.hideLoading();
            return;
          }

          const flashcardResponse: any = await apiService.generateFlashcards({
            topic: topic,
            count: count,
            mode: 'standard',
            knowledgeSource: 'ai-web'
          });

          if (flashcardResponse.jobId) {
            const jobResult: any = await apiService.waitForJobResult(flashcardResponse.jobId, {
              maxWaitMs: 150000,
              pollIntervalMs: 2000,
              onProgress: (p: number) => this.quizView.updateLoadingProgress(p, 'Generating quiz questions...')
            });
            const generatedCards = jobResult?.cards;
            if (generatedCards && generatedCards.length > 0) {
              const rt = settingsService.getPreferredRuntime();
              const quizResponse = await apiService.post('/quiz', {
                cards: generatedCards,
                count: count,
                topic: topic,
                preferredRuntime: rt
              });
              const questions = quizResponse?.questions || quizResponse?.data?.questions;
              if (questions && questions.length > 0) {
                quizModel.startQuiz(questions, 'standard', topic, timer || 0);
              } else { throw new Error('Invalid quiz response from server'); }
            } else { throw new Error('Failed to generate flashcards for quiz'); }
          } else if (flashcardResponse.cards) {
            const quizResponse = await apiService.post('/quiz', {
              cards: flashcardResponse.cards,
              count: count,
              topic: topic,
              preferredRuntime: settingsService.getPreferredRuntime()
            });
            const questions = quizResponse?.questions || quizResponse?.data?.questions;
            if (questions && questions.length > 0) {
              quizModel.startQuiz(questions, 'standard', topic, timer || 0);
            } else { throw new Error('Invalid quiz response from server'); }
          } else {
            throw new Error('Failed to generate flashcards for quiz');
          }
        } else if (cards.length > 0) {
          const quizTopic = topic || deckModel.currentTopic || 'General';
          response = await apiService.post('/quiz', {
            cards: cards,
            count: count,
            topic: quizTopic,
            preferredRuntime: settingsService.getPreferredRuntime()
          });

          const questions = response?.questions || response?.data?.questions;
          if (questions && questions.length > 0) {
            quizModel.startQuiz(questions, 'standard', quizTopic, timer || 0);
          } else {
            throw new Error('Invalid quiz response from server');
          }
        } else {
          alert('No cards available to generate quiz from. Please create flashcards first or enter a topic.');
          return;
        }
        this.switchTab('quiz');
      } catch (error: any) {
        console.error("Quiz generation failed", error);
        alert(`Failed to start quiz: ${error.message || 'Unknown error'}`);
      } finally {
        this.quizView.hideLoading();
      }
    });

    // Handle start with specific cards (from selection)
    eventBus.on('quiz:start-with-cards', async (cards: DeckCard[]) => {
      this.quizView.showLoading();
      try {
        const topic = cards[0]?.topic || 'General';
        const count = cards.length;
        const rt = settingsService.getPreferredRuntime();

        const response: any = await apiService.post('/quiz', {
          cards: cards,
          count: count,
          topic: topic,
          preferredRuntime: rt
        });

        if (response.questions) {
          quizModel.startQuiz(response.questions, 'standard', topic);
          this.switchTab('quiz');
        } else {
          throw new Error('Invalid quiz response');
        }
      } catch (error) {
        console.error('Quiz start failed:', error);
        alert('Failed to start quiz.');
      } finally {
        this.quizView.hideLoading();
      }
    });

    // Handle quiz retry
    eventBus.on('quiz:retry', () => {
      if (quizModel.questions.length > 0) {
        quizModel.startQuiz(quizModel.questions, quizModel.mode);
      }
    });

    // Start a prefetched quiz
    eventBus.on('quiz:start-prefetched', async ({ quizId }: QuizStartPrefetchedEvent) => {
      let quiz: any = null;
      const prefetched = typeof quizModel.listPrefetched === 'function' ? quizModel.listPrefetched().find((q: QuizPrefetched) => q.id === quizId) : null;
      const stored = storageService.getQuiz ? storageService.getQuiz(quizId) : null;
      quiz = prefetched || stored;

      if (!quiz || !quiz.questions || quiz.questions.length === 0) {
        try {
          const apiQuiz = await apiService.getQuiz(quizId);
          if (apiQuiz?.success && apiQuiz.quiz) {
            quiz = apiQuiz.quiz;
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
          }
        } catch (e) { }
      }

      if (quiz && quiz.questions?.length) {
        quizModel.startQuiz(quiz.questions, 'standard', quiz.topic || 'Quiz');
        this.switchTab('quiz');
        this.quizView.showQuestionUI();
        this.quizView.renderQuestion(quiz.questions[0]);
      } else {
        alert('Quiz data not found. Please regenerate the quiz.');
      }
    });

    // Handle deck harder (Deep Dive)
    eventBus.on('deck:harder', async (data: any) => {
      const topic = deckModel.currentTopic;
      if (!topic) { alert('No topic found.'); return; }
      const difficulty = data?.difficulty || 'basics';
      const enhancedTopic = difficulty === 'deep-dive' ? `${topic} (Advanced Deep Dive)` : `${topic} (Fundamentals)`;

      if (!apiService.isAuthenticated()) {
        if (confirm('Deep Dive requires login. Login now?')) window.location.href = '/api/auth/google';
        return;
      }
      this.generatorView.showLoading();

      try {
        const data: any = await apiService.generateFlashcards({
          topic: difficulty === 'deep-dive' ? topic : enhancedTopic,
          count: 10,
          mode: difficulty === 'deep-dive' ? 'deep-dive' : 'standard',
          parentTopic: (window as any).currentParentTopic
        });

        let cards = data.cards;
        if ((!cards || cards.length === 0) && data.jobId) {
          const jobResult: any = await apiService.waitForJobResult(data.jobId, {
            maxWaitMs: 180000,
            pollIntervalMs: 2000,
            onProgress: (p: number) => this.generatorView.updateLoadingProgress(p, 'Generating harder flashcards...')
          });
          cards = jobResult?.cards || [];
        }

        if (cards && cards.length > 0) {
          const deck = { id: Date.now().toString(), topic: topic, cards: cards, timestamp: Date.now() };
          this.deckHistory.unshift(deck);
          this.renderDeckHistory();
          await apiService.createDeck(deck);

          this.currentDeck = deck;
          deckModel.setCards(deck.cards);
          this.studyView.renderCard(deckModel.getCurrentCard());
          this.studyView.updateStats(deckModel.getStats());
          this.switchTab('study');
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

    // Handle harder quiz request (from quiz result popup)
    eventBus.on('quiz:requestHarder', async (data: any) => {
      try {
        let previousResults = data.previousResults;
        if (!previousResults && quizModel.questions.length > 0) {
          previousResults = {
            topic: deckModel.currentTopic || 'General Knowledge',
            questions: quizModel.questions,
            userAnswers: quizModel.answers,
            correctAnswers: quizModel.questions.map(q => q.correctAnswer)
          };
        }
        if (!previousResults) { alert('No quiz history found.'); return; }

        const response = await apiService.post('/quiz/generate-advanced', { previousResults, mode: data.mode || 'harder' });
        if (response?.quiz) {
          quizModel.startQuiz(response.quiz.questions, 'harder', response.quiz.topic);
          this.quizView.showQuestionUI();
          this.quizView.renderQuestion(response.quiz.questions[0]);
          this.switchTab('quiz');
        } else {
          alert('Failed to generate harder quiz.');
        }
      } catch (error) {
        console.error('Quiz harder error:', error);
        alert('Failed to generate harder quiz.');
      }
    });

    // Handle quiz revise (from quiz result popup)
    eventBus.on('quiz:revise', () => {
      if (deckModel.cards.length > 0) {
        deckModel.setCards(deckModel.cards);
        this.switchTab('study');
      } else {
        this.switchTab('create');
      }
    });

    // Handle deck review
    eventBus.on('deck:review', () => {
      if (deckModel.cards.length > 0) {
        deckModel.setCards(deckModel.cards);
        this.switchTab('study');
      } else {
        this.switchTab('create');
      }
    });
  } // End setupGlobalEvents

  async prefetchQuizFromCards(cards: DeckCard[]) {
    if (!cards || cards.length === 0) return;
    const firstCard = cards[0];
    const topic = firstCard?.topic || 'General';
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
      console.warn('Prefetch quiz failed');
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
    // Prefer triggering the existing click handler to keep any per-tab logic
    const tabBtn = document.querySelector<HTMLElement>(`.nav-tab[data-tab="${tabId}"]`);
    if (tabBtn) {
      tabBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      return;
    }

    // Fallback: toggle classes manually if button not found (defensive)
    const tabButtons = document.querySelectorAll('.nav-tab');
    const tabContents = document.querySelectorAll('.tab-content');
    tabButtons.forEach((btn) => {
      const isTarget = (btn as HTMLElement).dataset.tab === tabId;
      btn.classList.toggle('active', isTarget);
      btn.classList.toggle('text-indigo-600', isTarget);
    });
    tabContents.forEach((content) => {
      const isTarget = content.id === `${tabId}-tab`;
      content.classList.toggle('hidden', !isTarget);
    });
  }
} // End AppController
