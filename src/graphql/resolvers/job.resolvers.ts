import { PubSub } from 'graphql-subscriptions';
import type { GraphQLContext } from '../context.js';

type QueueJobStatus = {
    id?: string;
    status: string;
    progress?: number;
    result?: unknown;
    error?: string | null;
};

const pubsub = new PubSub();

export const jobResolvers = {
    Query: {
        job: async (
            _: unknown,
            { id }: { id: string },
            context: GraphQLContext
        ) => {
            // Delegate to existing job query resolver
            const { queueService } = context;
            if (!queueService) {
                throw new Error('Queue service not available');
            }

            const job = await queueService.getJob(id) as QueueJobStatus | { status?: string } | null;
            const normalizedStatus = (job?.status || '').toLowerCase();

            if (!job || normalizedStatus === 'not_found') {
                return null;
            }

            return {
                id: (job as QueueJobStatus).id ?? id,
                status: normalizedStatus ? normalizedStatus.toUpperCase() : 'PENDING',
                result: (job as QueueJobStatus).result ?? null,
                error: (job as QueueJobStatus).error ?? null,
                progress: (job as QueueJobStatus).progress ?? 0
            };
        }
    },

    Subscription: {
        jobUpdated: {
            subscribe: (_: unknown, { jobId }: { jobId: string }) => {
                console.log('[GraphQL Subscription] Client subscribed to job:', jobId);
                return (pubsub as unknown as { asyncIterator: (trigger: string) => AsyncIterator<unknown> }).asyncIterator(`JOB_UPDATED_${jobId}`);
            }
        }
    }
};

// Export pubsub instance for use in QueueService
export { pubsub };
