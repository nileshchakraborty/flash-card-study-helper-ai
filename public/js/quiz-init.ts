// @ts-nocheck
/**
 * Quiz creation and management initialization
 * Handles all quiz-related UI interactions
 */

import { storageService } from './services/storage.service.js';
import { apiService } from './services/api.service.js';
import { eventBus } from './utils/event-bus.js';
import { quizModel } from './models/quiz.model.js';
import { deckModel } from './models/deck.model.js';

export function initializeQuizHandlers(quizView: any) {
    let selectedFlashcardIds = new Set<string>();

    // From Flashcards button
    const fromFlashcardsBtn = document.getElementById('quiz-from-flashcards-btn');
    fromFlashcardsBtn?.addEventListener('click', async () => {
        let flashcards = storageService.getAllFlashcards();

        // Fallback to current deck in memory if storage is empty
        if (flashcards.length === 0 && deckModel.cards?.length) {
            flashcards = deckModel.cards;
        }

        if (flashcards.length === 0) {
            fromFlashcardsBtn.setAttribute('disabled', 'true');
            fromFlashcardsBtn.setAttribute('title', 'Create flashcards first');
            alert('No flashcards available. Create some flashcards first!');
            return;
        }

        selectedFlashcardIds = new Set();
        quizView.renderFlashcardSelectionModal(flashcards, selectedFlashcardIds);
    });

    // From Current Deck button (uses all cards in deck/storage)
    const fromDeckBtn = document.getElementById('quiz-from-deck-btn');
    fromDeckBtn?.addEventListener('click', async () => {
        let flashcards = storageService.getAllFlashcards();
        if (flashcards.length === 0) {
            flashcards = deckModel.cards || [];
        }

        if (!flashcards || flashcards.length === 0) {
            alert('No flashcards available. Create some flashcards first!');
            return;
        }

        await createQuizFromFlashcards(flashcards, Math.min(flashcards.length, 10));
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

        const flashcards = storageService.getAllFlashcards().filter(fc => selectedFlashcardIds.has(fc.id));
        const desiredCount = Math.min(selectedFlashcardIds.size, 10);

        await createQuizFromFlashcards(flashcards, desiredCount, () => quizView.hideFlashcardSelectionModal(), quizView);
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

        quizView.showLoading();
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
        } finally {
            quizView.hideLoading();
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

async function createQuizFromFlashcards(flashcards: any[], desiredCount: number, onSuccessClose?: () => void, quizView?: any) {
    try {
        const response = await apiService.createQuiz({
            flashcardIds: flashcards.map(fc => fc.id).filter(Boolean),
            flashcards,
            count: desiredCount
        });

        if (response.success && response.quiz) {
            const quizData = await apiService.getQuiz(response.quiz.id);
            if (quizData.success) {
                storageService.storeQuiz(quizData.quiz);
                refreshAvailableQuizzes(quizView);
                onSuccessClose?.();
                alert(`Quiz created with ${response.quiz.questionCount || response.quiz.questions?.length || 0} questions!`);
                return;
            }
        }
        throw new Error('Quiz API did not return success');
    } catch (error) {
        console.warn('Falling back to local quiz creation:', error?.message || error);
        const localQuiz = buildLocalQuizFromFlashcards(flashcards, desiredCount);
        if (localQuiz.questions.length > 0) {
            storageService.storeQuiz(localQuiz);
            refreshAvailableQuizzes(quizView);
            onSuccessClose?.();
            alert(`Quiz created locally with ${localQuiz.questions.length} questions.`);
        } else {
            alert('Failed to create quiz. Please try again.');
        }
    }
}

// Local fallback quiz builder (simple multiple-choice)
function buildLocalQuizFromFlashcards(flashcards: any[], count: number) {
    if (!flashcards || flashcards.length === 0) return { id: '', topic: '', questions: [] };

    const topic = flashcards[0].topic || 'Quiz';
    const sampled = flashcards.slice(0, count);
    const poolAnswers = flashcards.map(fc => fc.back).filter(Boolean);

    const questions = sampled.map((fc, idx) => {
        const correct = fc.back || 'Answer';
        const distractors = poolAnswers
            .filter(a => a !== correct)
            .sort(() => 0.5 - Math.random())
            .slice(0, 3);
        const options = [...distractors, correct].sort(() => 0.5 - Math.random());
        return {
            id: fc.id || `q-${idx}`,
            question: fc.front || `Question ${idx + 1}?`,
            options,
            correctAnswer: correct
        };
    });

    return {
        id: `local-quiz-${Date.now()}`,
        topic,
        questions,
        source: 'flashcards',
        createdAt: Date.now()
    };
}
