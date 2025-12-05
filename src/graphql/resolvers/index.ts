import { flashcardResolvers } from './flashcard.resolvers.js';
import { quizResolvers } from './quiz.resolvers.js';
import { jobResolvers } from './job.resolvers.js';
import { GraphQLScalarType, Kind } from 'graphql';

// Custom scalar for JSON
const JSONScalar = new GraphQLScalarType({
    name: 'JSON',
    description: 'The `JSON` scalar type represents JSON values as specified by ECMA-404',
    serialize(value: unknown) {
        return value;
    },
    parseValue(value: unknown) {
        return value;
    },
    parseLiteral(ast) {
        if (ast.kind === Kind.OBJECT || ast.kind === Kind.LIST) {
            return JSON.parse(JSON.stringify(ast));
        }
        return null;
    },
});

// Custom scalar for DateTime
const DateTimeScalar = new GraphQLScalarType({
    name: 'DateTime',
    description: 'The `DateTime` scalar type represents date and time as ISO 8601 string',
    serialize(value: unknown) {
        if (value instanceof Date) {
            return value.toISOString();
        }
        return new Date(value as string | number | Date).toISOString();
    },
    parseValue(value: unknown) {
        return new Date(value as string);
    },
    parseLiteral(ast) {
        if (ast.kind === Kind.STRING) {
            return new Date(ast.value);
        }
        return null;
    },
});

// Combine all resolvers
export const resolvers = {
    JSON: JSONScalar,
    DateTime: DateTimeScalar,

    Query: {
        ...flashcardResolvers.Query,
        ...quizResolvers.Query,
        ...jobResolvers.Query,

        // Health check
        health: () => ({
            status: 'ok',
            timestamp: new Date().toISOString(),
            service: 'graphql'
        }),
    },

    Mutation: {
        ...flashcardResolvers.Mutation,
        ...quizResolvers.Mutation,
    },

    Subscription: {
        ...jobResolvers.Subscription,
    },
};
