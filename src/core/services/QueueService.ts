import { Queue, Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { LoggerService } from './LoggerService.js';

const logger = new LoggerService();

const connection = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    maxRetriesPerRequest: null
});

export interface GenerateJobData {
    topic: string;
    count: number;
    mode?: string;
    knowledgeSource?: string;
    runtime?: string;
    parentTopic?: string;
    userId?: string;
}

export class QueueService {
    private generateQueue: Queue;
    private deadLetterQueue: Queue;

    constructor() {
        this.generateQueue = new Queue('flashcard-generation', { connection });
        this.deadLetterQueue = new Queue('flashcard-generation-dlq', { connection });

        logger.info('QueueService initialized');
    }

    async addGenerateJob(data: GenerateJobData): Promise<string> {
        const job = await this.generateQueue.add('generate', data, {
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 2000 // Start with 2 seconds, then 4s, 8s
            },
            removeOnComplete: {
                age: 3600, // Keep completed jobs for 1 hour
                count: 100
            },
            removeOnFail: false // Keep failed jobs for debugging
        });

        logger.info('Job added to queue', { jobId: job.id, topic: data.topic });
        return job.id!;
    }

    async getJobStatus(jobId: string): Promise<any> {
        const job = await this.generateQueue.getJob(jobId);
        if (!job) {
            return { status: 'not_found' };
        }

        const state = await job.getState();
        const progress = job.progress;
        const returnValue = job.returnvalue;
        const failedReason = job.failedReason;

        return {
            status: state,
            progress,
            result: returnValue,
            error: failedReason,
            data: job.data
        };
    }

    initWorker(processor: (job: Job<GenerateJobData>) => Promise<any>) {
        const worker = new Worker('flashcard-generation', processor, { connection });

        worker.on('completed', (job) => {
            logger.info('Job completed', { jobId: job.id, topic: job.data.topic });
        });

        worker.on('failed', async (job, err) => {
            logger.error('Job failed', { jobId: job?.id, error: err.message });

            // If job has exhausted all retries, move to DLQ
            if (job && job.attemptsMade >= (job.opts.attempts || 1)) {
                await this.deadLetterQueue.add('failed-job', {
                    originalJobId: job.id,
                    data: job.data,
                    error: err.message,
                    timestamp: Date.now()
                });
                logger.warn('Job moved to Dead Letter Queue', { jobId: job.id });
            }
        });

        worker.on('progress', (job, progress) => {
            logger.debug('Job progress', { jobId: job.id, progress });
        });

        logger.info('Worker initialized for flashcard-generation queue');
        return worker;
    }

    async getQueueStats() {
        const [waiting, active, completed, failed, delayed] = await Promise.all([
            this.generateQueue.getWaitingCount(),
            this.generateQueue.getActiveCount(),
            this.generateQueue.getCompletedCount(),
            this.generateQueue.getFailedCount(),
            this.generateQueue.getDelayedCount()
        ]);

        return { waiting, active, completed, failed, delayed };
    }
}
