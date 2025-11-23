// @ts-nocheck
import { GeneratorView } from '../views/generator.view.js';
import { StudyView } from '../views/study.view.js';
import { QuizView } from '../views/quiz.view.js';
import { deckModel } from '../models/deck.model.js';
import { quizModel } from '../models/quiz.model.js';
import { apiService } from '../services/api.service.js';
import { eventBus } from '../utils/event-bus.js';

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

    // Initial load
    this.loadInitialState();
  }

  async loadInitialState() {
    await deckModel.loadInitialDeck();

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
      // Switch to study tab
      const studyTab = document.querySelector('[data-tab="study"]');
      console.log('Switching to study tab:', studyTab);
      if (studyTab) {
        (studyTab as HTMLElement).click();
      }
    });

    // Handle quiz start request
    // Handle quiz start request
    eventBus.on('quiz:request-start', async ({ count, topic }) => {
      // Logic to generate quiz
      // If generating from current deck:
      const cards = deckModel.cards;
      if (cards.length === 0) {
        alert('No cards available to generate quiz from.');
        return;
      }

      this.quizView.showLoading();

      // Simple local generation for now, or call API
      try {
        const response = await apiService.post('/quiz', {
          cards: cards, // Send all cards, backend will pick random subset or use all for context
          count: count,
          topic: topic || deckModel.currentTopic || 'General'
        });

        // If API returns questions directly (it should based on server.js)
        if (response.questions) {
          quizModel.startQuiz(response.questions);
        } else {
          console.error("Unexpected quiz response", response);
          alert("Failed to generate quiz questions");
        }

      } catch (error) {
        console.error("Quiz generation failed", error);
        alert("Failed to start quiz");
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

      // Show loading
      this.generatorView.showLoading();

      try {
        console.log('Generating harder flashcards for:', enhancedTopic);
        const data = await apiService.post('/generate', {
          topic: difficulty === 'deep-dive' ? topic : enhancedTopic,
          count: 10,
          mode: difficulty === 'deep-dive' ? 'deep-dive' : 'standard',
          parentTopic: (window as any).currentParentTopic
        });

        if (data.cards && data.cards.length > 0) {
          // Save deck
          const deck = {
            id: Date.now().toString(),
            topic: topic,
            cards: data.cards,
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

          if (data.recommendedTopics && data.recommendedTopics.length > 0) {
            if (recommendedContainer && recommendedList) {
              recommendedContainer.classList.remove('hidden');
              recommendedList.innerHTML = data.recommendedTopics.map((subTopic: string) => `
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
