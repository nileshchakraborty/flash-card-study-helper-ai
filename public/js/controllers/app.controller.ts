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
  constructor() {
    this.generatorView = new GeneratorView();
    this.studyView = new StudyView();
    this.quizView = new QuizView();

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
    eventBus.on('deck:harder', async () => {
      const topic = deckModel.currentTopic;
      if (!topic) {
        alert('No topic found to generate harder cards.');
        return;
      }

      // Show loading
      this.generatorView.showLoading();

      try {
        console.log('Generating harder flashcards for:', topic);
        const data = await apiService.post('/generate', {
          topic: `${topic} (Advanced Concepts)`,
          count: 10
        });

        if (data.cards && data.cards.length > 0) {
          eventBus.emit('deck:loaded', data.cards);

          // Save to history
          await apiService.post('/decks', {
            topic: `${topic} (Advanced)`,
            cards: data.cards
          });
        } else {
          alert('Failed to generate harder cards. Please try again.');
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
}
