// Mock quiz data for E2E tests
export const mockQuizQuestions = [
    {
        id: 'q1',
        question: 'What is the capital of France?',
        options: ['London', 'Berlin', 'Paris', 'Madrid'],
        correctAnswer: 'Paris',
        explanation: 'Paris has been the capital of France since 987 AD.'
    },
    {
        id: 'q2',
        question: 'What is 2 + 2?',
        options: ['3', '4', '5', '6'],
        correctAnswer: '4',
        explanation: 'Basic arithmetic: 2 + 2 = 4'
    },
    {
        id: 'q3',
        question: 'What color is the sky?',
        options: ['Green', 'Blue', 'Red', 'Yellow'],
        correctAnswer: 'Blue',
        explanation: 'The sky appears blue due to Rayleigh scattering.'
    },
    {
        id: 'q4',
        question: 'How many continents are there?',
        options: ['5', '6', '7', '8'],
        correctAnswer: '7',
        explanation: 'There are 7 continents: Africa, Antarctica, Asia, Europe, North America, Oceania, and South America.'
    },
    {
        id: 'q5',
        question: 'What is the largest planet in our solar system?',
        options: ['Earth', 'Mars', 'Jupiter', 'Saturn'],
        correctAnswer: 'Jupiter',
        explanation: 'Jupiter is the largest planet with a mass more than twice that of all other planets combined.'
    }
];

export const mockQuiz = {
    id: 'quiz-test-123',
    topic: 'General Knowledge',
    questions: mockQuizQuestions,
    source: 'topic',
    createdAt: Date.now()
};

export const mockHarderQuizQuestions = [
    {
        id: 'h1',
        question: 'What is the speed of light in vacuum?',
        options: ['299,792,458 m/s', '300,000,000 m/s', '3 × 10^8 m/s', 'All of the above'],
        correctAnswer: 'All of the above',
        explanation: 'The speed of light is exactly 299,792,458 m/s, approximately 3 × 10^8 m/s.'
    },
    {
        id: 'h2',
        question: 'Who wrote "To Kill a Mockingbird"?',
        options: ['Harper Lee', 'Mark Twain', 'Ernest Hemingway', 'F. Scott Fitzgerald'],
        correctAnswer: 'Harper Lee',
        explanation: 'Harper Lee published this classic novel in 1960.'
    }
];

export const mockHarderQuiz = {
    id: 'quiz-harder-456',
    topic: 'General Knowledge (Advanced)',
    questions: mockHarderQuizQuestions,
    source: 'topic',
    difficulty: 'harder',
    createdAt: Date.now()
};
