import type { GraphQLContext } from '../context.js';
import { requireAuth } from '../context.js';
import type { QuizQuestion } from '../../core/domain/models.js';

type CreateQuizInput = {
    topic?: string;
    count?: number;
    cards?: Array<{
        id: string;
        front: string;
        back: string;
        topic?: string;
    }>;
};

type SubmitAnswersArgs = {
    quizId: string;
    answers: string[];
};

export const quizResolvers = {
    Query: {
        quiz: async (_: unknown, { id }: { id: string }, context: GraphQLContext) => {
            const quiz = await context.quizStorage.getQuiz(id);
            if (!quiz) {
                throw new Error(`Quiz with id ${id} not found`);
            }
            return quiz;
        },

        quizHistory: async (_: unknown, __: unknown, context: GraphQLContext) => {
            const history = await context.quizStorage.getHistory();
            return history || [];
        },

        allQuizzes: async (_: unknown, __: unknown, context: GraphQLContext) => {
            const quizzes = await context.quizStorage.getAllQuizzes();
            return quizzes || [];
        },

        queueStats: async (_: unknown, __: unknown, context: GraphQLContext) => {
            // Require auth for queue stats
            requireAuth(context);

            const stats = await context.queueService.getStats();
            return stats;
        },

        job: async (_: unknown, { id }: { id: string }, context: GraphQLContext) => {
            // Require auth for job status
            requireAuth(context);

            const job = await context.queueService.getJob(id);
            if (!job) {
                throw new Error(`Job with id ${id} not found`);
            }
            return job;
        },
    },

    Mutation: {
        createQuiz: async (
            _: unknown,
            { input }: { input: CreateQuizInput },
            context: GraphQLContext
        ): Promise<ReturnType<GraphQLContext['quizStorage']['createQuiz']>> => {
            let questions: QuizQuestion[] = [];

            try {
                if (input.topic) {
                    questions = await context.studyService.generateQuiz(input.topic, input.count || 5);
                }
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                console.warn('Failed to generate quiz questions:', message);
                // Continue with empty questions or handle error
            }

            const quiz = await context.quizStorage.createQuiz({
                topic: input.topic || 'General Quiz',
                source: input.cards ? 'flashcards' : 'topic',
                questions: questions as any
            });

            return quiz;
        },

        submitQuizAnswer: async (
            _: unknown,
            { quizId, answers }: SubmitAnswersArgs,
            context: GraphQLContext
        ): Promise<ReturnType<GraphQLContext['quizStorage']['submitAnswers']>> => {
            const result = await context.quizStorage.submitAnswers(quizId, answers as any);
            return result;
        },
    },
};
