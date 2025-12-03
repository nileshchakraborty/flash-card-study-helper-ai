import DataLoader from 'dataloader';
import type { FlashcardStorageService } from '../../core/services/FlashcardStorageService.js';
import type { QueueService } from '../../core/services/QueueService.js';

/**
 * Data Loaders for GraphQL query batching
 * Prevents N+1 query problems by batching multiple requests into single operations
 */

export interface DataLoaders {
    deckLoader: DataLoader<string, any>;
    jobLoader: DataLoader<string, any>;
}

export function createDataLoaders(services: {
    flashcardStorage: FlashcardStorageService;
    queueService: QueueService;
}): DataLoaders {
    // Deck Loader - batch load decks by IDs
    const deckLoader = new DataLoader<string, any>(
        async (ids: readonly string[]) => {
            console.log(`[DataLoader] Batching ${ids.length} deck requests`);

            // Fetch all decks at once
            const allDecks = await services.flashcardStorage.getDecks();

            // Return decks in the same order as requested IDs
            return ids.map(id =>
                allDecks.find(deck => deck.id === id) || null
            );
        },
        {
            // Cache for the duration of a single request
            cache: true,
            // Maximum batch size
            maxBatchSize: 100
        }
    );

    // Job Loader - batch load jobs by IDs
    const jobLoader = new DataLoader<string, any>(
        async (ids: readonly string[]) => {
            console.log(`[DataLoader] Batching ${ids.length} job requests`);

            // Fetch all jobs
            const jobs = await Promise.all(
                ids.map(id => services.queueService.getJob(id))
            );

            return jobs;
        },
        {
            cache: true,
            maxBatchSize: 50
        }
    );

    return {
        deckLoader,
        jobLoader
    };
}

/**
 * Clear all data loader caches
 * Call this between requests to prevent stale data
 */
export function clearDataLoaderCaches(loaders: DataLoaders): void {
    loaders.deckLoader.clearAll();
    loaders.jobLoader.clearAll();
}
