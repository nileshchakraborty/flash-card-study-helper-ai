import type { GraphQLContext } from '../context.js';

export const flashcardResolvers = {
    Query: {
        decks: async (_: unknown, __: unknown, context: GraphQLContext) => {
            // Get decks from storage
            const decks = await context.flashcardStorage.getDecks();
            return decks;
        },

        deck: async (_: unknown, { id }: { id: string }, context: GraphQLContext) => {
            const deck = await context.flashcardStorage.getDeck(id);
            if (!deck) {
                throw new Error(`Deck with id ${id} not found`);
            }
            return deck;
        },

        flashcards: async (_: unknown, { topic }: { topic?: string }, context: GraphQLContext) => {
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
            _: unknown,
            { input }: { input: { topic: string; count?: number; mode?: 'standard' | 'deep-dive'; knowledgeSource?: 'ai-only' | 'web-only' | 'ai-web'; parentTopic?: string } },
            context: GraphQLContext
        ) => {
            // Require authentication for generation
            if (!context.user) {
                throw new Error('Authentication required for flashcard generation');
            }

            // If queue service is available, offload to background job
            if (context.queueService) {
                const jobId = await context.queueService.addGenerateJob({
                    topic: input.topic,
                    count: input.count || 10,
                    mode: input.mode || 'standard',
                    knowledgeSource: input.knowledgeSource || 'ai-web',
                    runtime: 'ollama', // Default to ollama for now
                    parentTopic: input.parentTopic,
                    userId: context.user.id
                });

                return {
                    cards: null,
                    jobId,
                    recommendedTopics: null
                };
            }

            // Fallback to synchronous generation
            const result = await context.studyService.generateFlashcards(
                input.topic,
                input.count || 10,
                input.mode || 'standard',
                input.knowledgeSource || 'ai-web',
                undefined,
                input.parentTopic
            );

            return {
                cards: result.cards || [],
                jobId: null,
                recommendedTopics: result.recommendedTopics || []
            };
        },

        createDeck: async (
            _: unknown,
            { input }: { input: { topic: string; cards: Array<{ front: string; back: string; topic?: string }> } },
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
            _: unknown,
            { id }: { id: string },
            context: GraphQLContext
        ) => {
            const deleted = await context.flashcardStorage.deleteDeck(id);
            return deleted;
        },
    },
};
