/**
 * @jest-environment node
 */
import request from 'supertest';
import { describe, it, expect, beforeAll, afterEach, jest } from '@jest/globals';
import { ExpressServer } from '../../src/adapters/primary/express/server.js';
import { FlashcardCacheService } from '../../src/core/services/FlashcardCacheService.js';

// Skip in sandboxed CI unless explicitly enabled
const SKIP_SANDBOX = process.env.SANDBOX !== 'false';
const describeOrSkip = SKIP_SANDBOX ? describe.skip : describe;

describeOrSkip('Chunked upload end-to-end', () => {
  let app: any;
  let server: ExpressServer;
  let flashcardCache: FlashcardCacheService;
  const mockStudyService = {
    processFile: jest.fn(),
    generateFlashcards: jest.fn(),
    generateAdvancedQuiz: jest.fn(),
    processRawText: jest.fn(),
    processUrls: jest.fn()
  } as any;

  beforeAll(() => {
    flashcardCache = new FlashcardCacheService(3600);
    const mockQueue = {} as any;
    const mockWebLLMService = {} as any;
    const mockQuizStorage = {} as any;
    const mockFlashcardStorage = { storeFlashcards: jest.fn() } as any;

    server = new ExpressServer(
      mockStudyService,
      mockQueue,
      flashcardCache,
      mockWebLLMService,
      mockQuizStorage,
      mockFlashcardStorage
    );
    server.setupRoutes();
    app = server.getApp();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('merges chunks and returns cards for files >5MB', async () => {
    // 6.5MB buffer to force two chunks (chunk size 5MB)
    const originalSize = 6.5 * 1024 * 1024;
    const buffer = Buffer.alloc(Math.floor(originalSize), 97); // 'a'

    mockStudyService.processFile.mockResolvedValue([
      { id: '1', front: 'Q', back: 'A', topic: 'Big Topic' }
    ]);

    const uploadId = 'test-upload';

    // First chunk (index 0)
    const res1 = await request(app)
      .post('/api/upload/chunk')
      .set('x-test-auth', 'true')
      .field('uploadId', uploadId)
      .field('index', '0')
      .field('total', '2')
      .field('filename', 'bigfile.txt')
      .field('mimeType', 'text/plain')
      .field('topic', 'Big Topic')
      .attach('chunk', buffer.slice(0, 5 * 1024 * 1024), { filename: 'part0.txt' });

    expect(res1.status).toBe(200);
    expect(res1.body.success).toBe(true);
    expect(res1.body.data.status).toBe('partial');

    // Second chunk (index 1)
    const res2 = await request(app)
      .post('/api/upload/chunk')
      .set('x-test-auth', 'true')
      .field('uploadId', uploadId)
      .field('index', '1')
      .field('total', '2')
      .field('filename', 'bigfile.txt')
      .field('mimeType', 'text/plain')
      .field('topic', 'Big Topic')
      .attach('chunk', buffer.slice(5 * 1024 * 1024), { filename: 'part1.txt' });

    expect(res2.status).toBe(200);
    expect(res2.body.success).toBe(true);
    expect(Array.isArray(res2.body.data.cards)).toBe(true);
    expect(res2.body.data.cards.length).toBe(1);

    // Ensure processFile got the merged buffer (~original size)
    expect(mockStudyService.processFile).toHaveBeenCalledTimes(1);
    const merged = mockStudyService.processFile.mock.calls[0][0] as Buffer;
    expect(merged.length).toBe(buffer.length);
  });
});
