import type { GraphQLContext } from '../context.js';
import { requireAuth } from '../context.js';

export const quizResolvers = {
    Query: {
        quiz: async (_: any, { id }: { id: string }, context: GraphQLContext) => {
            const quiz = await context.quizStorage.getQuiz(id);
            if (!quiz) {
                throw new Error(`Quiz with id ${id} not found`);
            }
            return quiz;
        },

        quizHistory: async (_: any, __: any, context: GraphQLContext) => {
            const history = await context.quizStorage.getHistory();
            return history || [];
        },

        allQuizzes: async (_: any, __: any, context: GraphQLContext) => {
            const quizzes = await context.quizStorage.getAllQuizzes();
            return quizzes || [];
        },

        queueStats: async (_: any, __: any, context: GraphQLContext) => {
            // Require auth for queue stats
            requireAuth(context);

            const stats = await context.queueService.getStats();
            return stats;
        },

        job: async (_: any, { id }: { id: string }, context: GraphQLContext) => {
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
            _: any,
            { input }: { input: any },
            context: GraphQLContext
        ) => {
            let questions: any[] = [];

            try {
                if (input.topic) {
                    questions = await context.studyService.generateQuiz(input.topic, input.count || 5);
                }
            } catch (error) {
                console.warn('Failed to generate quiz questions:', error);
                // Continue with empty questions or handle error
            }

            const quiz = await context.quizStorage.createQuiz({
                topic: input.topic || 'General Quiz',
                source: input.cards ? 'flashcards' : 'topic',
                questions: questions
            });

            return quiz;
        },

        submitQuizAnswer: async (
            _: any,
            { quizId, answers }: { quizId: string; answers: any[] },
            context: GraphQLContext
        ) => {
            const result = await context.quizStorage.submitAnswers(quizId, answers);
            return result;
        },
    },
};
