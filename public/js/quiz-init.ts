// @ts-nocheck
/**
 * Quiz creation and management initialization
 * Handles all quiz-related UI interactions
 */

import { storageService } from './services/storage.service.js';
import { apiService } from './services/api.service.js';
import { eventBus } from './utils/event-bus.js';
import { quizModel } from './models/quiz.model.js';

export function initializeQuizHandlers(quizView: any) {
    let selectedFlashcardIds = new Set<string>();

    // From Flashcards button
    const fromFlashcardsBtn = document.getElementById('quiz-from-flashcards-btn');
    fromFlashcardsBtn?.addEventListener('click', async () => {
        const flashcards = storageService.getAllFlashcards();

        if (flashcards.length === 0) {
            fromFlashcardsBtn.setAttribute('disabled', 'true');
            fromFlashcardsBtn.setAttribute('title', 'Create flashcards first');
            alert('No flashcards available. Create some flashcards first!');
            return;
        }

        selectedFlashcardIds = new Set();
        quizView.renderFlashcardSelectionModal(flashcards, selectedFlashcardIds);
    });

    // Flashcard selection toggle
    document.addEventListener('click', (e: Event) => {
        const target = e.target as HTMLElement;
        const flashcardItem = target.closest('.flashcard-item');

        if (flashcardItem) {
            const flashcardId = flashcardItem.getAttribute('data-flashcard-id');
            if (!flashcardId) return;

            if (selectedFlashcardIds.has(flashcardId)) {
                selectedFlashcardIds.delete(flashcardId);
            } else {
                selectedFlashcardIds.add(flashcardId);
            }

            quizView.renderFlashcardSelectionModal(
                storageService.getAllFlashcards(),
                selectedFlashcardIds
            );
        }
    });

    // Cancel/close modals
    ['cancel-flashcard-selection', 'close-flashcard-modal'].forEach(id => {
        document.getElementById(id)?.addEventListener('click', () => {
            selectedFlashcardIds.clear();
            quizView.hideFlashcardSelectionModal();
        });
    });

    // Confirm flashcard selection
    document.getElementById('confirm-flashcard-selection')?.addEventListener('click', async () => {
        if (selectedFlashcardIds.size === 0) return;

        try {
            const response = await apiService.createQuiz({
                flashcardIds: Array.from(selectedFlashcardIds),
                count: Math.min(selectedFlashcardIds.size, 10)
            });

            if (response.success && response.quiz) {
                const quizData = await apiService.getQuiz(response.quiz.id);
                if (quizData.success) {
                    storageService.storeQuiz(quizData.quiz);
                    refreshAvailableQuizzes(quizView);
                    quizView.hideFlashcardSelectionModal();
                    alert(`Quiz created with ${response.quiz.questionCount || response.quiz.questions?.length || 0} questions!`);
                }
            }
        } catch (error) {
            console.error('Failed to create quiz:', error);
            alert('Failed to create quiz. Please try again.');
        }
    });

    // ...

    // Topic quiz form submit
    document.getElementById('create-quiz-topic-form')?.addEventListener('submit', async (e: Event) => {
        e.preventDefault();

        const topicInput = document.getElementById('quiz-topic-input-new') as HTMLInputElement;
        const countInput = document.getElementById('quiz-topic-count') as HTMLInputElement;

        const topic = topicInput?.value?.trim();
        const count = parseInt(countInput?.value || '5');

        if (!topic) {
            alert('Please enter a topic');
            return;
        }

        try {
            const response = await apiService.createQuiz({
                topic,
                count
            });

            if (response.success && response.quiz) {
                const quizData = await apiService.getQuiz(response.quiz.id);
                if (quizData.success) {
                    storageService.storeQuiz(quizData.quiz);
                    refreshAvailableQuizzes(quizView);
                    quizView.hideTopicQuizForm();
                    alert(`Quiz created with ${response.quiz.questionCount || response.quiz.questions?.length || 0} questions!`);
                }
            }
        } catch (error) {
            console.error('Failed to create quiz:', error);
            alert('Failed to create quiz. Please try again.');
        }
    });

    // ...

    async function refreshAvailableQuizzes(quizView: any) {
        const quizzes = storageService.getAllQuizzes();

        try {
            const response = await apiService.getAllQuizzes();
            if (response.success && response.quizzes) {
                for (const quiz of response.quizzes) {
                    if (!storageService.getQuiz(quiz.id)) {
                        const fullData = await apiService.getQuiz(quiz.id);
                        if (fullData.success) {
                            storageService.storeQuiz(fullData.quiz);
                        }
                    }
                }
            }
        } catch (error) {
            console.warn('Could not load quizzes from API:', error);
        }

        quizView.renderAvailableQuizzes(storageService.getAllQuizzes());
    }
}
