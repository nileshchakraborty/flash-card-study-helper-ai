import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { StudyView } from '../../../../public/js/views/study.view.js';
import { deckModel } from '../../../../public/js/models/deck.model.js';

// No mock needed for module, we spy on the instance
// jest.mock(...) removed

describe('StudyView', () => {
    let studyView: StudyView;

    beforeEach(() => {
        // Spy on deckModel methods
        jest.spyOn(deckModel, 'recordSwipe').mockImplementation(async () => { });
        jest.spyOn(deckModel, 'nextCard').mockImplementation(() => true);
        jest.spyOn(deckModel, 'getCurrentCard').mockImplementation(() => null);
        jest.spyOn(deckModel, 'getStats').mockImplementation(() => ({
            total: 10,
            mastered: 0,
            review: 0,
            remaining: 10,
            left: 0,
            right: 0,
            progress: 0
        }));

        // Setup DOm
        document.body.innerHTML = `
      <div id="card-stack"></div>
      <div id="cards-remaining"></div>
      <div id="left-count"></div>
      <div id="right-count"></div>
      <div id="plan-output"></div>
      <button id="revise-btn"></button>
      <button id="next-btn"></button>
      <button id="study-quiz-btn"></button>
    `;

        studyView = new StudyView();
        // Manually spy/expose handleSwipe if it's protected? 
        // It's public in the file or we can trigger events.
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Swipe Gestures', () => {
        it('should trigger right swipe (Mastered) when swiped right > 50px', () => {
            // Create a dummy card element
            // @ts-ignore - Accessing private/protected method for testing if needed, or stick to public
            // StudyView.setupSwipeHandlers is presumably called inside renderCard.
            // But we can call handleSwipe directly if exposed, OR simulate events.

            // Let's assume handleSwipe is public or we cast to any
            (studyView as any).handleSwipe(100, 200); // 100px difference right

            expect(deckModel.recordSwipe).toHaveBeenCalledWith('right');
            expect(deckModel.nextCard).toHaveBeenCalled();
        });

        it('should trigger left swipe (Review) when swiped left > 50px', () => {
            (studyView as any).handleSwipe(200, 100); // -100px difference left

            expect(deckModel.recordSwipe).toHaveBeenCalledWith('left');
            // nextCard is NOT called on left swipe in the implementation seen previously?
            // Let's verify implementation: 
            // "if (swipeDistance > 0) { ... nextCard(); } else { ... recordSwipe('left'); }"
            // It seems Review does NOT auto-advance? Or maybe it should?
            // Based on code reading: it only calls recordSwipe 'left'.
        });

        it('should ignore small swipes', () => {
            (studyView as any).handleSwipe(100, 110); // 10px diff

            expect(deckModel.recordSwipe).not.toHaveBeenCalled();
        });
    });
});
