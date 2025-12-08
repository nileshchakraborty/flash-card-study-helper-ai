/**
 * Queue/Jobs API Mock Helper for E2E Tests
 * Simulates the backend queue system used for flashcard generation
 */

export interface JobState {
    id: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress: number;
    result?: any;
    error?: string;
}

/**
 * Create a queue mock that simulates progressive job states
 */
export function createQueueMock(jobId: string, finalResult: any, totalDuration: number = 4000) {
    const startTime = Date.now();

    return {
        getJobState: (): JobState => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(100, Math.floor((elapsed / totalDuration) * 100));

            if (elapsed < totalDuration * 0.3) {
                return {
                    id: jobId,
                    status: 'pending',
                    progress: progress
                };
            } else if (elapsed < totalDuration) {
                return {
                    id: jobId,
                    status: 'processing',
                    progress: progress
                };
            } else {
                return {
                    id: jobId,
                    status: 'completed',
                    progress: 100,
                    result: finalResult
                };
            }
        }
    };
}

/**
 * Setup queue mocking for a Playwright page
 */
export async function setupQueueMock(page: any, topic: string, flashcards: any[]) {
    const jobId = `job-${Date.now()}`;
    const mock = createQueueMock(jobId, { cards: flashcards, topic, recommendedTopics: [] }, 3000);

    // Mock the /api/generate endpoint to return job ID
    await page.route('**/api/generate', async (route: any) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                success: true,
                jobId: jobId,
                message: 'Generation queued'
            })
        });
    });

    // Mock the /api/jobs/:jobId endpoint with progressive states
    await page.route(`**/api/jobs/${jobId}`, async (route: any) => {
        const state = mock.getJobState();
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                success: true,
                job: state
            })
        });
    });

    // Also handle GET /api/jobs/:jobId
    await page.route(new RegExp(`/api/jobs/${jobId}`), async (route: any) => {
        const state = mock.getJobState();
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                success: true,
                job: state
            })
        });
    });

    return jobId;
}

/**
 * Setup quiz creation mock with queue
 */
export async function setupQuizQueueMock(page: any, quiz: any) {
    const jobId = `quiz-job-${Date.now()}`;
    const mock = createQueueMock(jobId, { quiz }, 1500);

    // Mock POST /api/quiz to return job ID
    await page.route('**/api/quiz', async (route: any) => {
        if (route.request().method() === 'POST') {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    success: true,
                    jobId: jobId,
                    message: 'Quiz generation queued'
                })
            });
        } else {
            await route.continue();
        }
    });

    // Mock job status polling
    await page.route(new RegExp(`/api/jobs/${jobId}`), async (route: any) => {
        const state = mock.getJobState();
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                success: true,
                job: state
            })
        });
    });

    // Mock GET /api/quiz/:quizId for fetching created quiz
    await page.route(`**/api/quiz/${quiz.id}`, async (route: any) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                success: true,
                quiz: quiz
            })
        });
    });

    return jobId;
}
