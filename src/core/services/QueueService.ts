import { Queue, Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { LoggerService } from './LoggerService.js';

const logger = new LoggerService();

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
    private connection: Redis;

    constructor() {
        this.connection = new Redis({
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            maxRetriesPerRequest: null,
            // Add lazyConnect to avoid immediate connection attempt if not needed immediately
            lazyConnect: true
        });

        this.connection.on('error', (err) => {
            // Silence ECONNREFUSED for clearer logs if we expect fallback, or log as warn
            if ((err as any).code === 'ECONNREFUSED') {
                logger.warn('Redis connection failed (ECONNREFUSED). Ensure Redis is running or expect in-memory fallback if configured.');
            } else {
                logger.error('Redis connection error:', err);
            }
        });

        this.generateQueue = new Queue('flashcard-generation', { connection: this.connection });
        this.deadLetterQueue = new Queue('flashcard-generation-dlq', { connection: this.connection });

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
        const worker = new Worker('flashcard-generation', processor, { connection: this.connection });

        worker.on('completed', async (job) => {
            logger.info('Job completed', { jobId: job.id, topic: job.data.topic });

            // Publish job update for GraphQL subscriptions
            try {
                const { pubsub } = await import('../../graphql/resolvers/job.resolvers.js');
                const jobStatus = {
                    id: job.id,
                    status: 'COMPLETED',
                    result: job.returnvalue,
                    progress: 100
                };
                pubsub.publish(`JOB_UPDATED_${job.id}`, { jobUpdated: jobStatus });
            } catch (error) {
                logger.error('Failed to publish job completion', { error });
            }
        });

        worker.on('failed', async (job, err) => {
            logger.error('Job failed', { jobId: job?.id, error: err.message });

            if (job) {
                // Publish job update for GraphQL subscriptions
                try {
                    const { pubsub } = await import('../../graphql/resolvers/job.resolvers.js');
                    const jobStatus = {
                        id: job.id,
                        status: 'FAILED',
                        error: err.message,
                        progress: job.progress || 0
                    };
                    pubsub.publish(`JOB_UPDATED_${job.id}`, { jobUpdated: jobStatus });
                } catch (error) {
                    logger.error('Failed to publish job failure', { error });
                }

                // If job has exhausted all retries, move to DLQ
                if (job.attemptsMade >= (job.opts.attempts || 1)) {
                    await this.deadLetterQueue.add('failed-job', {
                        originalJobId: job.id,
                        data: job.data,
                        error: err.message,
                        timestamp: Date.now()
                    });
                    logger.warn('Job moved to Dead Letter Queue', { jobId: job.id });
                }
            }
        });

        worker.on('progress', async (job, progress) => {
            logger.debug('Job progress', { jobId: job.id, progress });

            // Publish progress update for GraphQL subscriptions
            try {
                const { pubsub } = await import('../../graphql/resolvers/job.resolvers.js');
                const jobStatus = {
                    id: job.id,
                    status: 'PROCESSING',
                    progress: typeof progress === 'number' ? progress : 0
                };
                pubsub.publish(`JOB_UPDATED_${job.id}`, { jobUpdated: jobStatus });
            } catch (error) {
                logger.error('Failed to publish job progress', { error });
            }
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

    /**
     * GraphQL placeholder methods
     */
    async getStats() {
        return this.getQueueStats();
    }

    async getJob(id: string) {
        return this.getJobStatus(id);
    }
}
