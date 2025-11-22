import { apiService } from '../services/api.service.js';
import { eventBus } from '../utils/event-bus.js';
export class DeckModel {
    cards = [];
    currentIndex = 0;
    leftSwipes = 0;
    rightSwipes = 0;
    demoCard;
    currentTopic = '';
    constructor() {
        // Demo card to show when there are no cards
        this.demoCard = {
            id: 'demo',
            front: '👋 Welcome to MindFlip AI!',
            back: `This is how flashcards work:

✨ Click the card to flip it
⬅️ Click "Revise" if you need more practice
➡️ Click "Next" when you know it
⌨️ Use Space to flip, Arrow keys to navigate

🎯 Ready to start? Go to "Create Cards" tab to generate your first deck!`
        };
    }
    setCards(cards) {
        this.cards = cards;
        this.currentIndex = 0;
        this.leftSwipes = 0;
        this.rightSwipes = 0;
        if (cards.length > 0 && cards[0].topic) {
            this.currentTopic = cards[0].topic;
        }
        eventBus.emit('deck:updated', this.getStats());
        eventBus.emit('card:changed', this.getCurrentCard());
    }
    getCurrentCard() {
        // Show demo card if no cards exist
        if (this.cards.length === 0) {
            return this.demoCard;
        }
        return this.cards[this.currentIndex] || null;
    }
    nextCard() {
        if (this.currentIndex >= this.cards.length - 1) {
            eventBus.emit('deck:finished', this.getStats());
            return false;
        }
        this.currentIndex++;
        eventBus.emit('card:changed', this.getCurrentCard());
        eventBus.emit('deck:updated', this.getStats());
        return true;
    }
    async recordSwipe(direction) {
        const card = this.getCurrentCard();
        if (!card)
            return;
        if (direction === 'left') {
            this.leftSwipes++;
            // Move current card to back of deck if there are other cards remaining
            // We check if there is more than 1 card including the current one
            if (this.cards.length > 1) {
                // Remove current card
                const [movedCard] = this.cards.splice(this.currentIndex, 1);
                // Add to end
                this.cards.push(movedCard);
                // currentIndex stays the same, but now points to the next card
                // We need to emit change events so UI updates immediately
                eventBus.emit('card:changed', this.getCurrentCard());
            }
        }
        else {
            this.rightSwipes++;
        }
        eventBus.emit('deck:updated', this.getStats());
        try {
            await apiService.post('/swipe', {
                cardId: card.id,
                direction,
                timestamp: Date.now()
            });
        }
        catch (error) {
            console.error('Failed to record swipe:', error);
        }
    }
    getStats() {
        return {
            total: this.cards.length,
            remaining: this.cards.length - this.currentIndex,
            left: this.leftSwipes,
            right: this.rightSwipes,
            progress: this.cards.length > 0 ? (this.currentIndex / this.cards.length) * 100 : 0
        };
    }
    async loadInitialDeck() {
        try {
            const data = await apiService.get('/flashcards');
            if (data.cards) {
                this.setCards(data.cards);
            }
        }
        catch (error) {
            console.error('Failed to load initial deck:', error);
        }
    }
}
export const deckModel = new DeckModel();
//# sourceMappingURL=deck.model.js.map