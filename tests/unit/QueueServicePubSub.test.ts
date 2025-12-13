import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { QueueService } from '../../src/core/services/QueueService.js';
import type { PubSub } from 'graphql-subscriptions';

// Mock the job.resolvers module to capture pubsub calls
const mockPubsubPublish = jest.fn() as jest.Mock<(...args: any[]) => Promise<void>>;
const mockPubsub = {
    publish: mockPubsubPublish,
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
    asyncIterator: jest.fn(),
    asyncIterableIterator: jest.fn()
} as unknown as PubSub;

jest.unstable_mockModule('../../src/graphql/resolvers/job.resolvers.js', () => {
    return {
        pubsub: mockPubsub
    };
});

const SKIP_SANDBOX = true;

(SKIP_SANDBOX ? describe.skip : describe)('QueueService PubSub Integration', () => {
    let queueService: QueueService;
    let mockProcessor: jest.Mock<(...args: any[]) => Promise<any>>;
    let worker: any;

    beforeEach(async () => {
        mockPubsubPublish.mockReset();
        mockPubsubPublish.mockResolvedValue(undefined);

        // Create queue service instance
        queueService = new QueueService();

        // Mock processor function
        mockProcessor = jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({
            cards: [{ front: 'Test', back: 'Answer' }],
            recommendedTopics: ['Topic 1']
        });
    });

    afterEach(async () => {
        // Cleanup: close worker and queue connections
        await worker?.close();
        await (queueService as any)['generateQueue']?.close();
        await (queueService as any)['connection']?.quit();
    });

    describe('Job Completion Events', () => {
        it('should publish JOB_UPDATED event when job completes successfully', async () => {
            // Initialize worker with mock processor
            worker = queueService.initWorker(mockProcessor);

            // Add a job
            const jobId = await queueService.addGenerateJob({
                topic: 'Test Topic',
                count: 5,
                mode: 'standard',
                knowledgeSource: 'ai-web'
            });

            // Wait for job to complete (with timeout)
            await new Promise((resolve) => setTimeout(resolve, 2000));

            // Verify pubsub.publish was called with correct event
            expect(mockPubsubPublish).toHaveBeenCalledWith(
                `JOB_UPDATED_${jobId}`,
                expect.objectContaining({
                    jobUpdated: expect.objectContaining({
                        id: jobId,
                        status: 'COMPLETED',
                        progress: 100
                    })
                })
            );
        });

        it('should include job result in published event', async () => {
            const expectedResult = {
                cards: [{ front: 'Q1', back: 'A1' }],
                recommendedTopics: ['Advanced Topic']
            };

            mockProcessor.mockResolvedValue(expectedResult);
            worker = queueService.initWorker(mockProcessor);

            const jobId = await queueService.addGenerateJob({
                topic: 'Advanced Topic',
                count: 10,
                mode: 'deep-dive',
                knowledgeSource: 'ai-web'
            });

            await new Promise((resolve) => setTimeout(resolve, 2000));

            expect(mockPubsubPublish).toHaveBeenCalledWith(
                `JOB_UPDATED_${jobId}`,
                expect.objectContaining({
                    jobUpdated: expect.objectContaining({
                        result: expectedResult
                    })
                })
            );
        });
    });

    describe('Job Failure Events', () => {
        it('should publish JOB_UPDATED event when job fails', async () => {
            const errorMessage = 'Test error: processing failed';
            mockProcessor.mockRejectedValue(new Error(errorMessage));

            queueService.initWorker(mockProcessor);
            worker = queueService.initWorker(mockProcessor);

            const jobId = await queueService.addGenerateJob({
                topic: 'Failing Topic',
                count: 5,
                mode: 'standard',
                knowledgeSource: 'ai-web'
            });

            await new Promise((resolve) => setTimeout(resolve, 2000));

            expect(mockPubsubPublish).toHaveBeenCalledWith(
                `JOB_UPDATED_${jobId}`,
                expect.objectContaining({
                    jobUpdated: expect.objectContaining({
                        id: jobId,
                        status: 'FAILED',
                        error: expect.stringContaining(errorMessage)
                    })
                })
            );
        });

        it('should handle pubsub publish errors gracefully', async () => {
            mockPubsubPublish.mockRejectedValue(new Error('Pubsub error'));
            worker = queueService.initWorker(mockProcessor);

            await queueService.addGenerateJob({
                topic: 'Test',
                count: 5,
                mode: 'standard',
                knowledgeSource: 'ai-web'
            });

            // Should not throw, just log error
            await expect(
                new Promise((resolve) => setTimeout(resolve, 2000))
            ).resolves.not.toThrow();
        });
    });

    describe('Progress Updates', () => {
        it('should publish progress events for long-running jobs', async () => {
            // Mock processor that reports progress
            const progressProcessor = jest.fn(async (job: any) => {
                // Simulate progress updates
                await job.updateProgress(25);
                await job.updateProgress(50);
                await job.updateProgress(75);

                return {
                    cards: [{ front: 'Test', back: 'Answer' }],
                    recommendedTopics: []
                };
            });

            worker = queueService.initWorker(progressProcessor);

            const jobId = await queueService.addGenerateJob({
                topic: 'Progress Test',
                count: 20,
                mode: 'deep-dive',
                knowledgeSource: 'ai-web'
            });

            await new Promise((resolve) => setTimeout(resolve, 3000));

            // Should have published progress updates
            const progressCalls = mockPubsubPublish.mock.calls.filter(
                (call: any) => call[0] === `JOB_UPDATED_${jobId}` &&
                    call[1].jobUpdated.progress < 100
            );

            expect(progressCalls.length).toBeGreaterThan(0);
        });
    });

    describe('Event Channel Naming', () => {
        it('should use correct channel format JOB_UPDATED_{jobId}', async () => {
            worker = queueService.initWorker(mockProcessor);

            const jobId = await queueService.addGenerateJob({
                topic: 'Channel Test',
                count: 5,
                mode: 'standard',
                knowledgeSource: 'ai-web'
            });

            await new Promise((resolve) => setTimeout(resolve, 2000));

            const firstCallChannel = mockPubsubPublish.mock.calls[0]?.[0];
            expect(firstCallChannel).toBe(`JOB_UPDATED_${jobId}`);
        });

        it('should not pollute other job channels', async () => {
            worker = queueService.initWorker(mockProcessor);

            const jobId1 = await queueService.addGenerateJob({
                topic: 'Job 1',
                count: 5,
                mode: 'standard',
                knowledgeSource: 'ai-web'
            });

            const jobId2 = await queueService.addGenerateJob({
                topic: 'Job 2',
                count: 5,
                mode: 'standard',
                knowledgeSource: 'ai-web'
            });

            await new Promise((resolve) => setTimeout(resolve, 3000));

            // Each job should only publish to its own channel
            const job1Calls = mockPubsubPublish.mock.calls.filter(
                call => call[0] === `JOB_UPDATED_${jobId1}`
            );
            const job2Calls = mockPubsubPublish.mock.calls.filter(
                call => call[0] === `JOB_UPDATED_${jobId2}`
            );

            expect(job1Calls.length).toBeGreaterThan(0);
            expect(job2Calls.length).toBeGreaterThan(0);

            // Each call should only reference its own job ID
            job1Calls.forEach((call: any) => {
                expect(call[1].jobUpdated.id).toBe(jobId1);
            });
            job2Calls.forEach((call: any) => {
                expect(call[1].jobUpdated.id).toBe(jobId2);
            });
        });
    });
});
