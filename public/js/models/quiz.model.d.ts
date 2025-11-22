export declare class QuizModel {
    questions: any[];
    currentIndex: number;
    back: Record<string, any>;
    history: any[];
    mode: string;
    constructor();
    startQuiz(questions: any, mode?: string): void;
    getCurrentQuestion(): any;
    answerQuestion(questionId: any, back: any): void;
    nextQuestion(): boolean;
    prevQuestion(): boolean;
    submitQuiz(topic?: string): Promise<{
        score: number;
        total: number;
        topic: string;
        results: {
            cardId: any;
            question: any;
            userAnswer: any;
            correctAnswer: any;
            correct: boolean;
            expected: any;
        }[];
        timestamp: number;
    }>;
    loadHistory(): Promise<void>;
}
export declare const quizModel: QuizModel;
//# sourceMappingURL=quiz.model.d.ts.map