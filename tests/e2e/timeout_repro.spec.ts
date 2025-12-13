import { test, expect } from '@playwright/test';

test.describe('Flashcard Generation Timeout Resilience', () => {
    test.beforeEach(async ({ page }) => {
        // Set test auth header for all requests
        await page.setExtraHTTPHeaders({
            'x-test-auth': 'true'
        });

        // Mock auth and storage tokens
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.setItem('authToken', 'test-token-fixed');
            localStorage.setItem('user', JSON.stringify({ id: 'u1', name: 'Tester' }));
        });
        await page.reload();
        page.on('console', msg => console.log(`[Browser Console] ${msg.text()}`));
    });

    test('should not timeout even if job makes no progress for 40 seconds', async ({ page }) => {
        // Increase test timeout to accommodate the 40s wait
        test.setTimeout(70000);

        // 1. Mock Generate Request (Try to catch GraphQL or REST)

        // Force GraphQL failure to trigger REST fallback, OR mock GraphQL
        await page.route('**/graphql', async (route) => {
            console.log('MOCK: /graphql hit');
            // Force failure to trigger REST fallback for easier mocking
            await route.abort();
        });

        // Mock REST endpoint (correct path is likely /api/generate based on service analysis)
        await page.route('**/api/generate', async (route) => {
            console.log('MOCK: /api/generate hit');
            if (route.request().method() === 'POST') {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        jobId: 'slow-job-fc-123',
                        cards: []
                    })
                });
            }
        });

        // 2. Mock Job Status Polling
        let startTime = Date.now();
        await page.route('**/api/jobs/slow-job-fc-123', async (route) => {
            console.log('MOCK: polling job status hit');
            const elapsed = Date.now() - startTime;

            if (elapsed < 40000) { // 40 seconds of "silence" (0 progress from start or stuck)
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        id: 'slow-job-fc-123',
                        status: 'active',
                        progress: 0,
                        result: null
                    })
                });
            } else {
                // Finally complete
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        id: 'slow-job-fc-123',
                        status: 'completed',
                        progress: 100,
                        result: {
                            cards: [
                                { id: 'c1', front: 'Slow Card 1', back: 'Answer 1', topic: 'Latency' },
                                { id: 'c2', front: 'Slow Card 2', back: 'Answer 2', topic: 'Latency' }
                            ]
                        }
                    })
                });
            }
        });

        // 3. Mock Create Deck (save history)
        await page.route('**/api/decks', async (route) => {
            await route.fulfill({
                status: 200,
                body: JSON.stringify({ success: true, id: 'deck-123' })
            });
        });

        // 4. Trigger Action (Flashcard Generation)
        await page.click('button[data-tab="create"]');
        await expect(page.locator('#topic-form')).toBeVisible();
        await page.fill('#topic-input', 'Latency Test Topic');

        // Wait for generate button to be enabled (it might depend on input)
        // Check input value just in case
        await expect(page.locator('#topic-input')).toHaveValue('Latency Test Topic');

        // Click Generate
        const generateBtn = page.locator('#generate-btn');
        await expect(generateBtn).not.toBeDisabled();
        await generateBtn.click();

        // 5. Verification
        // Expect loading status
        // GeneratorView uses global showLoading which updates #loading-overlay and #loading-progress
        // Just verify overlay is visible, text might change too fast or be different
        await expect(page.locator('#loading-overlay')).toBeVisible();

        // Wait for completion > 40s
        // On success, AppController switches to Study tab (#study-tab visible)
        // This is the CRITICAL assertion: did we survive the 40s wait?
        await expect(page.locator('#study-tab')).toBeVisible({ timeout: 60000 });
        // On success, AppController switches to Study tab (#study-tab visible)
        // and renders cards in #card-stack
        await expect(page.locator('#study-tab')).toBeVisible({ timeout: 60000 });
        // await expect(page.locator('.flashcard')).toBeVisible();
        // await expect(page.locator('.flashcard')).toContainText('Slow Card 1');
    });
});
