// Mock data for E2E tests - bypasses real Ollama generation
export const mockFlashcards = {
    JavaScript: [
        {
            id: 'js-1',
            front: 'What is a closure in JavaScript?',
            back: 'A closure is a function that has access to variables in its outer (enclosing) lexical scope, even after the outer function has returned.',
            difficulty: 'medium',
            tags: ['JavaScript', 'fundamentals']
        },
        {
            id: 'js-2',
            front: 'What is the difference between let and var?',
            back: 'let is block-scoped while var is function-scoped. let does not allow redeclaration in the same scope.',
            difficulty: 'easy',
            tags: ['JavaScript', 'syntax']
        },
        {
            id: 'js-3',
            front: 'What is event bubbling?',
            back: 'Event bubbling is when an event starts at the target element and propagates up to parent elements in the DOM tree.',
            difficulty: 'medium',
            tags: ['JavaScript', 'DOM']
        }
    ],
    React: [
        {
            id: 'react-1',
            front: 'What is JSX?',
            back: 'JSX is a syntax extension for JavaScript that allows you to write HTML-like code in your JavaScript files.',
            difficulty: 'easy',
            tags: ['React', 'syntax']
        },
        {
            id: 'react-2',
            front: 'What are React Hooks?',
            back: 'Hooks are functions that let you use state and other React features in functional components (useState, useEffect, etc.).',
            difficulty: 'medium',
            tags: ['React', 'hooks']
        }
    ],
    TypeScript: [
        {
            id: 'ts-1',
            front: 'What is a type guard in TypeScript?',
            back: 'A type guard is a runtime check that narrows down the type of a variable within a conditional block.',
            difficulty: 'medium',
            tags: ['TypeScript', 'types']
        },
        {
            id: 'ts-2',
            front: 'What is the difference between interface and type?',
            back: 'Both can define object shapes, but interfaces can be extended and merged while types are more flexible with unions and intersections.',
            difficulty: 'medium',
            tags: ['TypeScript', 'types']
        }
    ]
};

export function getMockFlashcards(topic: string) {
    const key = Object.keys(mockFlashcards).find(
        k => k.toLowerCase() === topic.toLowerCase()
    );

    return key ? mockFlashcards[key as keyof typeof mockFlashcards] : mockFlashcards.JavaScript;
}
