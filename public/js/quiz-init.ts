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
            const response = await apiService.post('/quiz/create-from-flashcards', {
                flashcardIds: Array.from(selectedFlashcardIds),
                count: Math.min(selectedFlashcardIds.size, 10)
            });

            if (response.success && response.quiz) {
                const quizData = await apiService.get(`/quiz/${response.quiz.id}`);
                if (quizData.success) {
                    storageService.storeQuiz(quizData.quiz);
                    refreshAvailableQuizzes(quizView);
                    quizView.hideFlashcardSelectionModal();
                    alert(`Quiz created with ${response.quiz.questionCount} questions!`);
                }
            }
        } catch (error) {
            console.error('Failed to create quiz:', error);
            alert('Failed to create quiz. Please try again.');
        }
    });

    // From Topic button
    document.getElementById('quiz-from-topic-btn')?.addEventListener('click', () => {
        quizView.showTopicQuizForm();
    });

    // Cancel topic quiz
    document.getElementById('cancel-topic-quiz')?.addEventListener('click', () => {
        quizView.hideTopicQuizForm();
    });

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
            const response = await apiService.post('/quiz/create-from-topic', {
                topic,
                count
            });

            if (response.success && response.quiz) {
                const quizData = await apiService.get(`/quiz/${response.quiz.id}`);
                if (quizData.success) {
                    storageService.storeQuiz(quizData.quiz);
                    refreshAvailableQuizzes(quizView);
                    quizView.hideTopicQuizForm();
                    alert(`Quiz created with ${response.quiz.questionCount} questions!`);
                }
            }
        } catch (error) {
            console.error('Failed to create quiz:', error);
            alert('Failed to create quiz. Please try again.');
        }
    });

    // Quiz item click to start
    document.addEventListener('click', (e: Event) => {
        const target = e.target as HTMLElement;
        const quizItem = target.closest('.quiz-item');

        if (quizItem) {
            const quizId = quizItem.getAttribute('data-quiz-id');
            const quiz = quizId ? storageService.getQuiz(quizId) : null;

            if (quiz) {
                quizModel.startQuiz(quiz.questions, 'standard', quiz.topic);
                // Switch to quiz tab
                document.querySelector('[data-tab="quiz"]')?.dispatchEvent(new Event('click'));
            }
        }
    });

    // Store flashcards when deck loaded
    eventBus.on('deck:loaded', (cards: any[]) => {
        if (cards?.length > 0) {
            storageService.storeFlashcards(cards);
            fromFlashcardsBtn?.removeAttribute('disabled');
        }
    });

    // Refresh quizzes on tab switch
    eventBus.on('tab:switched', (tabName: string) => {
        if (tabName === 'create-quiz') {
            refreshAvailableQuizzes(quizView);
        }
    });

    // Initial load
    refreshAvailableQuizzes(quizView);
}

async function refreshAvailableQuizzes(quizView: any) {
    const quizzes = storageService.getAllQuizzes();

    try {
        const response = await apiService.get('/quiz/list/all');
        if (response.success && response.quizzes) {
            for (const quiz of response.quizzes) {
                if (!storageService.getQuiz(quiz.id)) {
                    const fullData = await apiService.get(`/quiz/${quiz.id}`);
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
