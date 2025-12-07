
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { QuizView } from '../../../public/js/views/quiz.view.js';
import { BaseView } from '../../../public/js/views/base.view.js';
import { QuizModel } from '../../../public/js/models/quiz.model.js';

// Mock dependencies
jest.mock('../../../public/js/views/base.view');
jest.mock('../../../public/js/utils/event-bus', () => ({
    eventBus: {
        on: jest.fn(),
        emit: jest.fn(),
        off: jest.fn()
    }
}));
jest.mock('../../../public/js/models/quiz.model');
jest.mock('../../../public/js/services/api.service', () => ({
    apiService: {
        get: jest.fn(),
        post: jest.fn()
    }
}));
jest.mock('../../../public/js/services/cache.service', () => ({
    cacheService: {
        get: jest.fn(),
        set: jest.fn(),
        invalidatePattern: jest.fn()
    }
}));


describe('QuizView', () => {
    let quizView: any;
    let mockQuizModel;

    beforeEach(() => {
        // Setup DOM
        document.body.innerHTML = `
            <div id="app"></div>
            <div id="quiz-completion-popup" class="hidden">
                 <div class="result-score"></div>
                 <div class="result-message"></div>
                 <div class="quiz-actions"></div>
            </div>
            <div id="quiz-history-section" class="hidden"></div>
            <div id="quiz-stats-section" class="hidden"></div>
            <div id="quiz-results"></div>
            <div id="quiz-question-container"></div>
            <div id="quiz-progress"></div>
            <div id="quiz-timer"></div>
            <div id="quiz-controls"></div>
        `;

        mockQuizModel = new QuizModel();
        // Since we mocked the class, we need to mock the instance methods if used in constructor or init
        // QuizView constructor calls super() and binds methods.

        // We'll mimic the BaseView properties if needed, but since it's mocked, 
        // usage of 'this.elements' in QuizView might need manual setup if it relies on BaseView logic.
        // However, QuizView defines its own 'elements' in constructor usually or assumes them.
        // Actually, looking at QuizView source (conceptual), it likely queries elements.

        // Real QuizView constructor queries elements. We should ensure they exist (which we did above).

        // We need to restore BaseView mock implementation enough to let QuizView work if it extends it.
        // If BaseView is a class, jest.mock auto-mocks it. 
        // But 'extends BaseView' means QuizView needs the real BaseView or a class structure.
        // Jest mock should handle class extension if configured right, but sometimes it's tricky.
        // Let's assume standard behavior.

        // Wait, BaseView constructor usually does nothing or basic setup.
        BaseView.prototype.show = jest.fn((el: any) => el && el.classList.remove('hidden'));
        BaseView.prototype.hide = jest.fn((el: any) => el && el.classList.add('hidden'));

        quizView = new QuizView();

        // Manually trigger init if it's not in constructor, but usually it is.
        // Re-assign elements if QuizView doesn't find them due to timing (unlikely with jsdom).
        quizView.elements = {
            historySection: document.getElementById('quiz-history-section'),
            statsSection: document.getElementById('quiz-stats-section'),
            popup: document.getElementById('quiz-completion-popup'),
            popupScore: document.querySelector('.result-score'),
            popupMessage: document.querySelector('.result-message'),
            popupActions: document.querySelector('.quiz-actions'),
            results: document.getElementById('quiz-results'),
            // ... add others as needed
        }
    });

    it('should NOT show history and stats sections on initialization', () => {
        // verify classes contain 'hidden'
        expect(quizView.elements.historySection.classList.contains('hidden')).toBe(true);
        expect(quizView.elements.statsSection.classList.contains('hidden')).toBe(true);
    });

    it('should show history and stats when showing results UI', () => {
        const mockResult = {
            score: 100,
            total: 10,
            correct: 10,
            answers: [],
            results: []
        };

        // Call showResultsUI
        quizView.showResultsUI(mockResult);

        // Verify BaseView.show was called for these sections OR they have 'hidden' removed.
        // Since we mocked show, let's check calls.
        expect(quizView.show).toHaveBeenCalledWith(quizView.elements.historySection);
        expect(quizView.show).toHaveBeenCalledWith(quizView.elements.statsSection);
    });

    it('should add a Review Quiz button to the popup', () => {
        const mockResult = {
            score: 80,
            total: 10,
            correct: 8,
            percent: 80
        };

        quizView.showPopup(mockResult);

        const reviewBtn = document.getElementById('btn-quiz-review') as HTMLElement;
        expect(reviewBtn).toBeTruthy();
        expect(reviewBtn.textContent).toContain('Review Quiz');
    });

    it('should hide popup and show history/stats when Review Quiz is clicked', () => {
        const mockResult = { score: 80, total: 10, correct: 8, percent: 80 };
        quizView.showPopup(mockResult);

        const reviewBtn = document.getElementById('btn-quiz-review') as HTMLElement;

        // Spy on hide
        quizView.hide = jest.fn();
        // Since showResultsUI is usually called BEFORE showPopup in the flow, 
        // the stats might already be shown. But the Requirement said "Review Quiz... closes the popup".
        // And "Ensuring these sections are only visible after a quiz is completed".

        // Click the button
        reviewBtn.click();

        expect(quizView.hide).toHaveBeenCalledWith(quizView.elements.popup);
        // It might also show history/stats again just in case, but primary action is closing popup.
    });
});
