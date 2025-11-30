import type { GraphQLContext } from '../context.js';

export const flashcardResolvers = {
    Query: {
        decks: async (_: any, __: any, context: GraphQLContext) => {
            // Get decks from storage
            const decks = await context.flashcardStorage.getDecks();
            return decks;
        },

        deck: async (_: any, { id }: { id: string }, context: GraphQLContext) => {
            const deck = await context.flashcardStorage.getDeck(id);
            if (!deck) {
                throw new Error(`Deck with id ${id} not found`);
            }
            return deck;
        },

        flashcards: async (_: any, { topic }: { topic?: string }, context: GraphQLContext) => {
            if (topic) {
                const deck = await context.flashcardStorage.getDeckByTopic(topic);
                return deck?.cards || [];
            }
            // Return all flashcards from all decks
            const decks = await context.flashcardStorage.getDecks();
            return decks.flatMap(d => d.cards);
        },
    },

    Mutation: {
        generateFlashcards: async (
            _: any,
            { input }: { input: any },
            context: GraphQLContext
        ) => {
            // Require authentication for generation
            if (!context.user) {
                throw new Error('Authentication required for flashcard generation');
            }

            // Use the study service to generate flashcards
            const result = await context.studyService.generateFlashcards(
                input.topic,
                input.count || 10,
                input.mode || 'standard',
                input.knowledgeSource || 'ai-web',
                undefined, // runtime not needed for GraphQL
                input.parentTopic
            );

            return {
                cards: result.cards || [],
                jobId: (result as any).jobId || null,
                recommendedTopics: result.recommendedTopics || []
            };
        },

        createDeck: async (
            _: any,
            { input }: { input: any },
            context: GraphQLContext
        ) => {
            const deck = {
                id: Date.now().toString(),
                topic: input.topic,
                cards: input.cards,
                timestamp: Date.now(),
                userId: context.user?.id
            };

            await context.flashcardStorage.saveDeck(deck);
            return deck;
        },

        deleteDeck: async (
            _: any,
            { id }: { id: string },
            context: GraphQLContext
        ) => {
            const deleted = await context.flashcardStorage.deleteDeck(id);
            return deleted;
        },
    },
};
