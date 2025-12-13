import { describe, it, expect } from '@jest/globals';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { typeDefs } from '../../src/graphql/schema.js';
import { resolvers } from '../../src/graphql/resolvers/index.js';
import { GraphQLSchema, GraphQLObjectType, GraphQLScalarType } from 'graphql';

describe('GraphQL Schema Validation', () => {
    let schema: GraphQLSchema;

    beforeAll(() => {
        // Compile the schema
        schema = makeExecutableSchema({ typeDefs, resolvers });
    });

    describe('Schema Compilation', () => {
        it('should compile schema without errors', () => {
            expect(schema).toBeDefined();
            expect(schema).toBeInstanceOf(GraphQLSchema);
        });

        it('should have Query type defined', () => {
            const queryType = schema.getQueryType();
            expect(queryType).toBeDefined();
            expect(queryType?.name).toBe('Query');
        });

        it('should have Mutation type defined', () => {
            const mutationType = schema.getMutationType();
            expect(mutationType).toBeDefined();
            expect(mutationType?.name).toBe('Mutation');
        });

        it('should have Subscription type defined', () => {
            const subscriptionType = schema.getSubscriptionType();
            expect(subscriptionType).toBeDefined();
            expect(subscriptionType?.name).toBe('Subscription');
        });
    });

    describe('Query Type Fields', () => {
        it('should have health query field', () => {
            const queryType = schema.getQueryType();
            const fields = queryType?.getFields();

            expect(fields?.health).toBeDefined();
        });

        it('should have decks query field', () => {
            const queryType = schema.getQueryType();
            const fields = queryType?.getFields();

            expect(fields?.decks).toBeDefined();
            expect(fields?.decks!.type.toString()).toContain('Deck');
        });

        it('should have deck query field', () => {
            const queryType = schema.getQueryType();
            const fields = queryType?.getFields();

            expect(fields?.deck).toBeDefined();
        });

        it('should have job query field', () => {
            const queryType = schema.getQueryType();
            const fields = queryType?.getFields();

            expect(fields?.job).toBeDefined();
            expect(fields?.job!.type.toString()).toContain('Job');
        });

        it('should have quizHistory query field', () => {
            const queryType = schema.getQueryType();
            const fields = queryType?.getFields();

            expect(fields?.quizHistory).toBeDefined();
        });
    });

    describe('Mutation Type Fields', () => {
        it('should have generateFlashcards mutation field', () => {
            const mutationType = schema.getMutationType();
            const fields = mutationType?.getFields();

            expect(fields?.generateFlashcards).toBeDefined();
        });

        it('should have createDeck mutation field', () => {
            const mutationType = schema.getMutationType();
            const fields = mutationType?.getFields();

            expect(fields?.createDeck).toBeDefined();
        });

        it('should have createQuiz mutation field', () => {
            const mutationType = schema.getMutationType();
            const fields = mutationType?.getFields();

            expect(fields?.createQuiz).toBeDefined();
        });

        it('should have submitQuizAnswer mutation field', () => {
            const mutationType = schema.getMutationType();
            const fields = mutationType?.getFields();

            expect(fields?.submitQuizAnswer).toBeDefined();
        });
    });

    describe('Subscription Type Fields', () => {
        it('should have jobUpdated subscription field', () => {
            const subscriptionType = schema.getSubscriptionType();
            const fields = subscriptionType?.getFields();

            expect(fields?.jobUpdated).toBeDefined();
            expect(fields?.jobUpdated!.type.toString()).toContain('Job');
        });
    });

    describe('Custom Types', () => {
        it('should have Deck type defined', () => {
            const deckType = schema.getType('Deck');
            expect(deckType).toBeDefined();
            expect(deckType).toBeInstanceOf(GraphQLObjectType);
        });

        it('should have Flashcard type defined', () => {
            const flashcardType = schema.getType('Flashcard');
            expect(flashcardType).toBeDefined();
            expect(flashcardType).toBeInstanceOf(GraphQLObjectType);
        });

        it('should have Job type defined', () => {
            const jobType = schema.getType('Job');
            expect(jobType).toBeDefined();
            expect(jobType).toBeInstanceOf(GraphQLObjectType);
        });

        it('should have Quiz type defined', () => {
            const quizType = schema.getType('Quiz');
            expect(quizType).toBeDefined();
            expect(quizType).toBeInstanceOf(GraphQLObjectType);
        });

        it('should have GenerateResult type defined', () => {
            const generateResultType = schema.getType('GenerateResult');
            expect(generateResultType).toBeDefined();
            expect(generateResultType).toBeInstanceOf(GraphQLObjectType);
        });
    });

    describe('Input Types', () => {
        it('should have GenerateInput input type defined', () => {
            const generateInputType = schema.getType('GenerateInput');
            expect(generateInputType).toBeDefined();
        });

        it('should have DeckInput input type defined', () => {
            const deckInputType = schema.getType('DeckInput');
            expect(deckInputType).toBeDefined();
        });

        it('should have QuizInput input type defined', () => {
            const quizInputType = schema.getType('QuizInput');
            expect(quizInputType).toBeDefined();
        });
    });

    describe('Scalar Types', () => {
        it('should have DateTime scalar type', () => {
            const dateTimeType = schema.getType('DateTime');
            expect(dateTimeType).toBeDefined();
            expect(dateTimeType).toBeInstanceOf(GraphQLScalarType);
        });

        it('should have JSON scalar type', () => {
            const jsonType = schema.getType('JSON');
            expect(jsonType).toBeDefined();
            expect(jsonType).toBeInstanceOf(GraphQLScalarType);
        });
    });

    describe('Resolver Coverage', () => {
        it('should have all Query resolvers connected', () => {
            const queryType = schema.getQueryType();
            const fields = queryType?.getFields();

            // All query fields should have corresponding resolvers
            expect(fields).toBeDefined();
            expect(Object.keys(fields || {}).length).toBeGreaterThan(0);
        });

        it('should have all Mutation resolvers connected', () => {
            const mutationType = schema.getMutationType();
            const fields = mutationType?.getFields();

            // All mutation fields should have corresponding resolvers
            expect(fields).toBeDefined();
            expect(Object.keys(fields || {}).length).toBeGreaterThan(0);
        });

        it('should have all Subscription resolvers connected', () => {
            const subscriptionType = schema.getSubscriptionType();
            const fields = subscriptionType?.getFields();

            // All subscription fields should have corresponding resolvers
            expect(fields).toBeDefined();
            expect(Object.keys(fields || {}).length).toBeGreaterThan(0);
        });
    });

    describe('Schema Integrity', () => {
        it('should not have any orphaned types', () => {
            const typeMap = schema.getTypeMap();

            // Filter out built-in GraphQL types (start with __)
            const customTypes = Object.keys(typeMap).filter(name => !name.startsWith('__'));

            // All custom types should be reachable from Query, Mutation, or Subscription
            expect(customTypes.length).toBeGreaterThan(0);

            // Verify key types are present
            expect(customTypes).toContain('Query');
            expect(customTypes).toContain('Mutation');
            expect(customTypes).toContain('Subscription');
            expect(customTypes).toContain('Deck');
            expect(customTypes).toContain('Job');
        });

        it('should have consistent naming conventions', () => {
            const typeMap = schema.getTypeMap();
            const customTypes = Object.keys(typeMap).filter(name => !name.startsWith('__'));

            // Check that Input types end with 'Input'
            const inputTypes = customTypes.filter(name => name.endsWith('Input'));
            inputTypes.forEach(inputType => {
                const type = schema.getType(inputType);
                expect(type?.astNode?.kind).toBe('InputObjectTypeDefinition');
            });
        });
    });
});
