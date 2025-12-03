import { PubSub } from 'graphql-subscriptions';
import type { GraphQLContext } from '../context.js';

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

            const job = await queueService.getJob(id);
            if (!job) {
                return null;
            }

            return {
                id: job.id,
                status: job.status?.toUpperCase() || 'PENDING',
                result: job.returnvalue,
                error: job.failedReason,
                progress: job.progress
            };
        }
    },

    Subscription: {
        jobUpdated: {
            subscribe: (_: unknown, { jobId }: { jobId: string }) => {
                console.log('[GraphQL Subscription] Client subscribed to job:', jobId);
                return pubsub.asyncIterableIterator(`JOB_UPDATED_${jobId}`);
            }
        }
    }
};

// Export pubsub instance for use in QueueService
export { pubsub };
