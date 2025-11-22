// @ts-nocheck
import { apiService } from '../services/api.service.js';
import { eventBus } from '../utils/event-bus.js';
export class QuizModel {
    questions = [];
    currentIndex = 0;
    back = {};
    history = [];
    mode = 'standard'; // standard, web, advanced
    constructor() {
        // Properties are now initialized directly on the class
    }
    startQuiz(questions, mode = 'standard') {
        this.questions = questions;
        this.mode = mode;
        this.currentIndex = 0;
        this.answers = {};
        eventBus.emit('quiz:started', this.getCurrentQuestion());
    }
    getCurrentQuestion() {
        return this.questions[this.currentIndex];
    }
    answerQuestion(questionId, back) {
        this.answers[questionId] = back;
    }
    nextQuestion() {
        if (this.currentIndex < this.questions.length - 1) {
            this.currentIndex++;
            eventBus.emit('quiz:question-changed', this.getCurrentQuestion());
            return true;
        }
        return false;
    }
    prevQuestion() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            eventBus.emit('quiz:question-changed', this.getCurrentQuestion());
            return true;
        }
        return false;
    }
    async submitQuiz(topic = 'General') {
        let score = 0;
        const results = this.questions.map(q => {
            const userAnswer = this.answers[q.id];
            const isCorrect = userAnswer === q.correctAnswer;
            if (isCorrect)
                score++;
            return {
                cardId: q.id,
                question: q.question,
                userAnswer,
                correctAnswer: q.correctAnswer,
                correct: isCorrect,
                expected: q.correctAnswer // Ensure expected is passed for UI
            };
        });
        const quizResult = {
            score,
            total: this.questions.length,
            topic,
            results,
            timestamp: Date.now()
        };
        try {
            const response = await apiService.post('/quiz/history', quizResult);
            quizResult.id = response.id; // Add ID from server
            this.history.unshift(quizResult); // Add to local history
            eventBus.emit('quiz:completed', quizResult);
            eventBus.emit('quiz:history-updated', this.history);
        }
        catch (error) {
            console.error('Failed to save quiz result:', error);
        }
        return quizResult;
    }
    async loadHistory() {
        try {
            const data = await apiService.get('/quiz/history');
            if (data.history) {
                this.history = data.history;
                eventBus.emit('quiz:history-updated', this.history);
            }
        }
        catch (error) {
            console.error('Failed to load quiz history:', error);
        }
    }
}
export const quizModel = new QuizModel();
//# sourceMappingURL=quiz.model.js.map