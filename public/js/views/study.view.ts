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
    eventBus.on('deck:updated', (stats) => this.updateStats(stats));
    eventBus.on('deck:updated', (stats) => this.updateStats(stats));
    eventBus.on('card:changed', (card) => this.renderCard(card));
    eventBus.on('deck:finished', () => this.showCompletion());
  }

  bindEvents() {
    // Button controls - map to actual HTML buttons
    const reviseBtn = this.getElement('#revise-btn');
    const nextBtn = this.getElement('#next-btn');

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

  renderCard(card) {
    if (!this.elements.stack) return;

    this.elements.stack.innerHTML = '';

    if (!card) {
      this.elements.stack.innerHTML = `
        <div class="text-center p-8 text-gray-500">
          <p class="text-xl mb-4">All caught up!</p>
          <button onclick="document.querySelector('[data-tab=\\'generate\\']').click()" class="text-primary hover:underline">
            Generate more cards
          </button>
        </div>
      `;
      return;
    }

    const cardEl = document.createElement('div');
    // Removed 'perspective-1000' from here, it should be on the container if needed, or handled by CSS
    // Actually, perspective should be on the parent of the 3D object.
    // Let's put perspective on the cardEl itself.
    cardEl.className = 'flashcard w-full h-96 relative cursor-pointer perspective-1000';

    // Using specific classes for 3D transform to avoid Tailwind conflicts
    cardEl.innerHTML = `
      <div class="flashcard-inner w-full h-full relative transform-style-3d transition-transform duration-500 shadow-xl rounded-2xl">
        
        <!-- Front (Question) -->
        <div class="flashcard-front absolute w-full h-full backface-hidden bg-white rounded-2xl p-8 flex flex-col items-center justify-center border-2 border-gray-100">
          <div class="text-xs uppercase tracking-widest text-gray-400 mb-4 font-semibold">Question</div>
          <div class="text-2xl font-bold text-gray-800 text-center leading-relaxed whitespace-pre-line">${card.front}</div>
          <div class="absolute bottom-6 text-gray-400 text-sm flex items-center gap-2">
            <span class="material-icons text-sm">touch_app</span> Tap to flip
          </div>
        </div>

        <!-- Back (Answer) -->
        <!-- Removed 'transform' and 'rotate-y-180' from class list to avoid Tailwind conflict. 
             The rotation is now handled purely by the .rotate-y-180 CSS class which sets transform: rotateY(180deg) -->
        <div class="flashcard-back absolute w-full h-full backface-hidden bg-gradient-to-br from-gray-900 to-gray-800 text-white rounded-2xl p-8 flex flex-col items-center justify-center rotate-y-180">
          <div class="text-xs uppercase tracking-widest text-gray-400 mb-4 font-semibold">Answer</div>
          <div class="text-xl font-medium text-center leading-relaxed whitespace-pre-line">${card.back}</div>
        </div>
      </div>
    `;

    // Add click to flip
    cardEl.addEventListener('click', () => {
      this.flipCard();
    });

    this.elements.stack.appendChild(cardEl);
  }

  flipCard() {
    const cardInner = document.querySelector('.flashcard-inner');
    if (cardInner) {
      // Toggle the 'is-flipped' class which we will define in CSS to rotate 180deg
      cardInner.classList.toggle('is-flipped');
    }
  }

  updateStats(stats) {
    if (this.elements.leftCount) this.elements.leftCount.textContent = stats.left;
    if (this.elements.rightCount) this.elements.rightCount.textContent = stats.right;
    if (this.elements.remaining) this.elements.remaining.textContent = `${stats.remaining} cards remaining`;
    if (this.elements.progressBar) this.elements.progressBar.style.width = `${stats.progress}%`;

    if (this.elements.planOutput) {
      this.elements.planOutput.innerHTML = studyPlanService.generatePlan(stats);
    }
  }
  showCompletion() {
    if (!this.elements.stack) return;

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
                <button id="harder-btn" class="w-full bg-primary text-white px-6 py-3 rounded-lg hover:bg-primary-dark transition-all transform hover:scale-105 flex items-center justify-center gap-2 shadow-lg">
                    <span class="material-icons">psychology</span>
                    Move to Harder Flashcards
                </button>
                
                <button id="review-btn" class="w-full bg-white text-gray-700 border-2 border-gray-200 px-6 py-3 rounded-lg hover:border-primary hover:text-primary transition-all flex items-center justify-center gap-2">
                    <span class="material-icons">refresh</span>
                    Select Flashcards to Learn Again
                </button>
            </div>
        `;

    this.elements.stack.appendChild(completionCard);

    // Bind events for new buttons
    const harderBtn = completionCard.querySelector('#harder-btn');
    const reviewBtn = completionCard.querySelector('#review-btn');

    if (harderBtn) {
      harderBtn.addEventListener('click', () => {
        eventBus.emit('deck:harder', null);
      });
    }

    if (reviewBtn) {
      reviewBtn.addEventListener('click', () => {
        eventBus.emit('deck:review', null);
      });
    }
  }
}
