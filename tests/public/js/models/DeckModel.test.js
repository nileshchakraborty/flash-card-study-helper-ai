import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { DeckModel } from '../../../../public/js/models/deck.model.js';
import { apiService } from '../../../../public/js/services/api.service.js';
import { eventBus } from '../../../../public/js/utils/event-bus.js';
jest.mock('../../../../public/js/utils/event-bus.js');
jest.mock('../../../../public/js/services/api.service.js');
describe('DeckModel', () => {
    let deckModel;
    let apiPostSpy;
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(eventBus, 'emit');
        apiPostSpy = jest.spyOn(apiService, 'post');
        deckModel = new DeckModel();
    });
    describe('nextCard', () => {
        it('should increment index and emit card:changed', () => {
            deckModel.setCards([
                { id: '1', front: 'F1', back: 'B1' },
                { id: '2', front: 'F2', back: 'B2' }
            ]);
            const result = deckModel.nextCard();
            expect(result).toBe(true);
            expect(deckModel.currentIndex).toBe(1);
            // Check that card:changed was called with the new current card (card 2)
            expect(eventBus.emit).toHaveBeenCalledWith('card:changed', expect.objectContaining({ id: '2' }));
        });
        it('should emit deck:finished when at end', () => {
            deckModel.setCards([{ id: '1', front: 'F1', back: 'B1' }]);
            const result = deckModel.nextCard();
            expect(result).toBe(false);
            // When at the end, deck:finished should be emitted
            expect(eventBus.emit).toHaveBeenCalledWith('deck:finished', expect.any(Object));
        });
    });
    describe('recordSwipe', () => {
        it('should move card to back on left swipe (revise)', async () => {
            apiPostSpy.mockResolvedValue({});
            deckModel.setCards([
                { id: '1', front: 'Front 1', back: 'Back 1' },
                { id: '2', front: 'Front 2', back: 'Back 2' }
            ]);
            await deckModel.recordSwipe('left');
            // Card 1 should be moved to end
            expect(deckModel.cards[0].id).toBe('2');
            expect(deckModel.cards[1].id).toBe('1');
            // card:changed should be emitted with the new current card
            expect(eventBus.emit).toHaveBeenCalledWith('card:changed', expect.objectContaining({ id: '2' }));
        });
    });
});
//# sourceMappingURL=DeckModel.test.js.map