import { BaseView } from './base.view.js';
import { eventBus } from '../utils/event-bus.js';
import { deckModel } from '../models/deck.model.js';
import { studyPlanService } from '../services/study-plan.service.js';

export class StudyView extends BaseView {
  constructor() {
    super();
    this.elements = {
      stack: this.getElement('#card-stack'),
      leftCount: this.getElement('#left-count'),
      rightCount: this.getElement('#right-count'),
      remaining: this.getElement('#cards-remaining'),
      progressBar: this.getElement('#progress-bar'),
      planOutput: this.getElement('#plan-output')
    };

    this.init();
  }

  init() {
    this.bindEvents();

    // Listen for deck updates
    eventBus.on('deck:updated', (stats: any) => this.updateStats(stats));

    eventBus.on('card:changed', (card: any) => this.renderCard(card));
    eventBus.on('deck:finished', () => this.showCompletion());
  }

  bindEvents() {
    // Button controls - map to actual HTML buttons
    const reviseBtn = this.getElement('#revise-btn');
    const nextBtn = this.getElement('#next-btn');
    const quizBtn = this.getElement('#study-quiz-btn');

    if (reviseBtn) {
      this.bind(reviseBtn, 'click', () => {
        const card = deckModel.getCurrentCard();
        if (card && card.id !== 'demo') {
          deckModel.recordSwipe('left');
        }
      });
    }
    if (nextBtn) {
      this.bind(nextBtn, 'click', () => {
        const card = deckModel.getCurrentCard();
        if (card && card.id !== 'demo') {
          deckModel.recordSwipe('right');
          deckModel.nextCard();
        }
      });
    }
    if (quizBtn) {
      this.bind(quizBtn, 'click', () => {
        const card = deckModel.getCurrentCard();
        if (card && card.id !== 'demo') {
          // Start quiz with current cards
          eventBus.emit('quiz:request-start', { count: 5, topic: deckModel.currentTopic });
        }
      });
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (document.querySelector('#study-tab')?.classList.contains('hidden')) return;

      const card = deckModel.getCurrentCard();
      const isDemo = card && card.id === 'demo';

      if (e.code === 'Space') {
        e.preventDefault();
        this.flipCard();
      }
      if (e.code === 'ArrowLeft' && !isDemo) {
        deckModel.recordSwipe('left');
      }
      if (e.code === 'ArrowRight' && !isDemo) {
        deckModel.recordSwipe('right');
        deckModel.nextCard();
      }
    });
  }

  renderCard(card: any) {
    if (!this.elements.stack) return;

    // Ensure nav buttons are visible when rendering a card
    const reviseBtn = this.getElement('#revise-btn');
    const nextBtn = this.getElement('#next-btn');
    const quizBtn = this.getElement('#study-quiz-btn');

    if (reviseBtn) reviseBtn.classList.remove('hidden');
    if (nextBtn) nextBtn.classList.remove('hidden');
    if (quizBtn) quizBtn.classList.remove('hidden');

    this.elements.stack.innerHTML = '';

    if (!card) {
      this.showCompletion();
      return;
    }

    const cardEl = document.createElement('div');
    // Use 'card' class to trigger new 3D styles
    cardEl.className = 'card w-full h-96 relative';

    cardEl.innerHTML = `
      <div class="card-inner w-full h-full relative">
        
        <!-- Front (Question) -->
        <div class="card-front flex flex-col items-center justify-center p-8">
          <div class="text-xs uppercase tracking-widest text-gray-400 mb-4 font-semibold">Question</div>
          <div class="text-3xl font-bold text-gray-800 text-center leading-tight whitespace-pre-line">${card.front}</div>
          <div class="absolute bottom-6 text-indigo-400 text-sm flex items-center gap-2 animate-pulse-slow">
            <span class="material-icons text-sm">touch_app</span> Tap to flip
          </div>
        </div>

        <!-- Back (Answer) -->
        <div class="card-back flex flex-col items-center justify-center p-8 overflow-y-auto">
          <div class="text-xs uppercase tracking-widest text-indigo-400 mb-4 font-semibold">Answer</div>
          <div class="text-xl font-medium text-gray-700 text-center leading-relaxed whitespace-pre-line">${card.back}</div>
        </div>
      </div>
    `;

    // Add click to flip
    cardEl.addEventListener('click', () => {
      this.flipCard();
    });

    this.setupSwipeHandlers(cardEl);

    this.elements.stack.appendChild(cardEl);
  }

  flipCard() {
    const cardInner = document.querySelector('.card-inner');
    if (cardInner) {
      cardInner.classList.toggle('flipped');
    }
  }

  setupSwipeHandlers(cardEl: HTMLElement) {
    let touchStartX = 0;
    let touchEndX = 0;

    cardEl.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    cardEl.addEventListener('touchend', (e) => {
      touchEndX = e.changedTouches[0].screenX;
      this.handleSwipe(touchStartX, touchEndX);
    }, { passive: true });
  }

  handleSwipe(startX: number, endX: number) {
    const minSwipeDistance = 50;
    const swipeDistance = endX - startX;

    if (Math.abs(swipeDistance) > minSwipeDistance) {
      if (swipeDistance > 0) {
        // Right swipe (Got it)
        deckModel.recordSwipe('right');
        deckModel.nextCard();
      } else {
        // Left swipe (Review)
        deckModel.recordSwipe('left');
      }
    }
  }


  updateStats(stats: any) {
    if (this.elements.leftCount) this.elements.leftCount.textContent = stats.left;
    if (this.elements.rightCount) this.elements.rightCount.textContent = stats.right;
    if (this.elements.remaining) this.elements.remaining.textContent = stats.remaining.toString();
    if (this.elements.progressBar) this.elements.progressBar.style.width = `${stats.progress}%`;

    if (this.elements.planOutput) {
      this.elements.planOutput.innerHTML = studyPlanService.generatePlan(stats);
    }
  }
  showCompletion() {
    if (!this.elements.stack) return;

    // Hide nav buttons
    const reviseBtn = this.getElement('#revise-btn');
    const nextBtn = this.getElement('#next-btn');
    const quizBtn = this.getElement('#study-quiz-btn');

    if (reviseBtn) reviseBtn.classList.add('hidden');
    if (nextBtn) nextBtn.classList.add('hidden');
    if (quizBtn) quizBtn.classList.add('hidden');

    // Trigger confetti
    // @ts-ignore
    if (typeof confetti === 'function') {
      // @ts-ignore
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    }

    this.elements.stack.innerHTML = '';

    const completionCard = document.createElement('div');
    completionCard.className = 'bg-white rounded-2xl shadow-xl p-8 text-center w-full max-w-md mx-auto border border-gray-100';
    completionCard.innerHTML = `
            <div class="mb-6">
                <span class="material-icons text-6xl text-yellow-400">emoji_events</span>
            </div>
            <h2 class="text-2xl font-bold text-gray-900 mb-2">Congratulations!</h2>
            <p class="text-gray-600 mb-8">You've completed this deck.</p>
            
            <div class="space-y-4">
                <button id="revise-deck-btn" class="w-full bg-white text-gray-700 border-2 border-gray-200 px-6 py-3 rounded-lg hover:border-primary hover:text-primary transition-all flex items-center justify-center gap-2">
                    <span class="material-icons">refresh</span>
                    Revise Flashcards
                </button>

                <button id="take-quiz-btn" class="w-full bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-md">
                    <span class="material-icons">quiz</span>
                    Take Quiz
                </button>

                <div class="pt-4 border-t border-gray-100 mt-4">
                  <p class="text-sm text-gray-500 mb-3">Ready for a challenge?</p>
                  <button id="harder-btn" class="w-full bg-gray-800 text-white px-6 py-3 rounded-lg hover:bg-gray-900 transition-all transform hover:scale-105 flex items-center justify-center gap-2 shadow-lg">
                      <span class="material-icons">psychology</span>
                      Move to Harder Questions
                  </button>
              </div>
            </div>
        `;

    this.elements.stack.appendChild(completionCard);

    // Bind events for new buttons
    const harderBtn = completionCard.querySelector('#harder-btn');
    const reviseDeckBtn = completionCard.querySelector('#revise-deck-btn');
    const takeQuizBtn = completionCard.querySelector('#take-quiz-btn');

    if (harderBtn) {
      harderBtn.addEventListener('click', () => {
        eventBus.emit('deck:harder', { difficulty: 'deep-dive' });
      });
    }

    if (reviseDeckBtn) {
      reviseDeckBtn.addEventListener('click', () => {
        eventBus.emit('deck:review', null);
      });
    }

    if (takeQuizBtn) {
      takeQuizBtn.addEventListener('click', () => {
        eventBus.emit('quiz:request-start', { count: 5, topic: deckModel.currentTopic });
      });
    }
  }
}
