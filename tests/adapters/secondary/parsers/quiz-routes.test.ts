import request from 'supertest';
import express from 'express';
import { ExpressServer } from '../../../../src/adapters/primary/express/server.js';
import { StudyService } from '../../../../src/core/services/StudyService.js';
import { QueueService } from '../../../../src/core/services/QueueService.js';
import { FlashcardCacheService } from '../../../../src/core/services/FlashcardCacheService.js';
import { WebLLMService } from '../../../../src/core/services/WebLLMService.js';
import { QuizStorageService } from '../../../../src/core/services/QuizStorageService.js';
import { FlashcardStorageService } from '../../../../src/core/services/FlashcardStorageService.js';

const SKIP_SANDBOX = process.env.SANDBOX !== 'false';

(SKIP_SANDBOX ? describe.skip : describe)('Quiz API Endpoints', () => {
    let app: express.Application;
    let server: ExpressServer;
    let quizStorage: QuizStorageService;
    let flashcardStorage: FlashcardStorageService;

    beforeAll(() => {
        // Mock StudyService with aiAdapters structure
        const mockStudyService = {
            aiAdapters: {
                ollama: {
                    generateQuizFromTopic: async (topic: string, numQuestions: number) => {
                        return Array.from({ length: numQuestions }, (_, i) => ({
                            id: `q${i + 1}`,
                            question: `Question ${i + 1} about ${topic}?`,
                            options: ['Option A', 'Option B', 'Option C', 'Option D'],
                            correctAnswer: 0
                        }));
                    },
                    generateQuizFromFlashcards: async (flashcards: any[], numQuestions: number) => {
                        return flashcards.slice(0, numQuestions).map((fc, i) => ({
                            id: `q${i + 1}`,
                            question: `What is: ${fc.front}?`,
                            options: [fc.back, 'Wrong 1', 'Wrong 2', 'Wrong 3'],
                            correctAnswer: 0
                        }));
                    }
                }
            },
            searchAdapter: {
                search: async () => []
            },
            generateQuiz: async (topic: string, numQuestions: number) => {
                return Array.from({ length: numQuestions }, (_, i) => ({
                    id: `q${i + 1}`,
                    question: `Question ${i + 1} about ${topic}?`,
                    options: ['Option A', 'Option B', 'Option C', 'Option D'],
                    correctAnswer: 0
                }));
            }
        } as any;

        const mockQueueService = {} as any;
        const mockFlashcardCache = {} as any;
        const mockWebLLMService = {} as any;

        quizStorage = new QuizStorageService();
        flashcardStorage = new FlashcardStorageService();

        server = new ExpressServer(
            mockStudyService,
            mockQueueService,
            mockFlashcardCache,
            mockWebLLMService,
            quizStorage,
            flashcardStorage,
            null, // Redis
            null, // Supabase
            null, // Vector
            null  // Blob
        );
        server.setupRoutes();

        // Get the Express app from server
        app = server.getApp();
    });

    describe('POST /api/quiz - Create from topic', () => {
        it('should create a quiz from a topic', async () => {
            const response = await request(app)
                .post('/api/quiz')
                .send({
                    topic: 'JavaScript',
                    numQuestions: 5
                });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('quizId');
            expect(response.body).toHaveProperty('quiz');
            expect(response.body.quiz.topic).toBe('JavaScript');
            expect(response.body.quiz.questions).toHaveLength(5);
        });

        it('should return 400 if topic is missing', async () => {
            const response = await request(app)
                .post('/api/quiz')
                .send({
                    numQuestions: 5
                });

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error');
        });

        it('should use default num questions if not provided', async () => {
            const response = await request(app)
                .post('/api/quiz')
                .send({
                    topic: 'Python'
                });

            expect(response.status).toBe(200);
            expect(response.body.quiz.questions.length).toBeGreaterThan(0);
        });
    });

    describe('POST /api/quiz - Create from flashcards', () => {
        it('should create a quiz from flashcard IDs', async () => {
            // First create some flashcards
            const flashcard1 = {
                id: 'fc-1',
                front: 'What is React?',
                back: 'A JavaScript library',
                topic: 'React',
                createdAt: Date.now()
            };
            flashcardStorage.storeFlashcard(flashcard1);

            const flashcard2 = {
                id: 'fc-2',
                front: 'What is JSX?',
                back: 'JavaScript XML',
                topic: 'React',
                createdAt: Date.now()
            };
            flashcardStorage.storeFlashcard(flashcard2);

            const response = await request(app)
                .post('/api/quiz')
                .send({
                    flashcardIds: [flashcard1.id, flashcard2.id]
                });

            expect(response.status).toBe(200);
            expect(response.body.quiz.source).toBe('flashcards');
            expect(response.body.quiz.sourceFlashcardIds).toContain(flashcard1.id);
            expect(response.body.quiz.sourceFlashcardIds).toContain(flashcard2.id);
        });

        it('should return 400 if flashcard IDs are empty', async () => {
            const response = await request(app)
                .post('/api/quiz')
                .send({
                    flashcardIds: []
                });

            expect(response.status).toBe(400);
        });
    });

    describe('GET /api/quiz/:id', () => {
        it('should return a quiz by ID', async () => {
            // Create a quiz first
            const createResponse = await request(app)
                .post('/api/quiz')
                .send({ topic: 'Test Topic', numQuestions: 3 });

            const quizId = createResponse.body.quizId;

            const response = await request(app)
                .get(`/api/quiz/${quizId}`);

            expect(response.status).toBe(200);
            expect(response.body.quiz.id).toBe(quizId);
        });

        it('should return 404 for non-existent quiz', async () => {
            const response = await request(app)
                .get('/api/quiz/non-existent-id');

            expect(response.status).toBe(404);
        });
    });

    describe('POST /api/quiz/:id/submit', () => {
        it('should submit quiz answers and return score', async () => {
            // Create a quiz
            const createResponse = await request(app)
                .post('/api/quiz')
                .send({ topic: 'Test', numQuestions: 2 });

            const quizId = createResponse.body.quizId;
            const quiz = createResponse.body.quiz;

            // Submit answers
            const response = await request(app)
                .post(`/api/quiz/${quizId}/submit`)
                .send({
                    answers: [quiz.questions[0].correctAnswer, quiz.questions[1].correctAnswer]
                });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('score');
            expect(response.body).toHaveProperty('totalQuestions');
            expect(response.body.score).toBe(2); // All correct
        });

        it('should calculate score correctly', async () => {
            const createResponse = await request(app)
                .post('/api/quiz')
                .send({ topic: 'Test', numQuestions: 2 });

            const quizId = createResponse.body.quizId;

            // Submit wrong answers
            const response = await request(app)
                .post(`/api/quiz/${quizId}/submit`)
                .send({
                    answers: [0, 0] // Likely wrong
                });

            expect(response.status).toBe(200);
            expect(response.body.score).toBeGreaterThanOrEqual(0);
        });

        it('should return 404 for non-existent quiz', async () => {
            const response = await request(app)
                .post('/api/quiz/non-existent/submit')
                .send({ answers: [] });

            expect(response.status).toBe(404);
        });
    });

    describe('GET /api/quiz/history', () => {
        it('should return quiz history', async () => {
            const response = await request(app)
                .get('/api/quiz/history');

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body.quizzes)).toBe(true);
        });

        it('should include quiz attempts', async () => {
            // Create and submit a quiz
            const createResponse = await request(app)
                .post('/api/quiz')
                .send({ topic: 'History Test', numQuestions: 1 });

            await request(app)
                .post(`/api/quiz/${createResponse.body.quizId}/submit`)
                .send({ answers: [0] });

            const response = await request(app)
                .get('/api/quiz/history');

            const quizWithAttempts = response.body.quizzes.find(
                (q: any) => q.id === createResponse.body.quizId
            );

            expect(quizWithAttempts).toBeDefined();
            expect(quizWithAttempts.attempts).toHaveLength(1);
        });
    });
});
