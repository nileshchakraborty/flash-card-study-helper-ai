import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('PDF Upload Reproduction', () => {

    test.beforeEach(async ({ page }) => {
        // Auth setup
        await page.setExtraHTTPHeaders({ 'x-test-auth': 'true' });
        await page.context().addCookies([{
            name: 'auth_token',
            value: 'test-token-123',
            domain: 'localhost',
            path: '/',
            httpOnly: false
        }]);

        await page.goto('/');

        // Force app visible (same as frontend.spec.ts)
        await page.evaluate(() => {
            localStorage.setItem('user', JSON.stringify({
                id: 'test-user-123',
                email: 'test@example.com',
                name: 'Test User'
            }));
            const appContent = document.getElementById('app-content');
            if (appContent) {
                appContent.classList.remove('hidden');
                document.getElementById('landing-page')?.classList.add('hidden');

                // Recursively show all children (same as frontend.spec.ts)
                const allElements = appContent.querySelectorAll('*');
                allElements.forEach((el) => {
                    if (el.classList.contains('hidden')) {
                        el.classList.remove('hidden');
                    }
                });
            }
        });
        await page.waitForTimeout(1000); // Wait for init
    });

    test('should fail to upload PDF purely client-side or error out', async ({ page }) => {
        // Set viewport to desktop to ensure nav is visible
        await page.setViewportSize({ width: 1280, height: 720 });

        // Skip tab switching as we unhide everything in beforeEach
        // 2. Locate file input
        const fileInput = page.locator('input[type="file"]');
        // Unhide it for test reliability
        await fileInput.evaluate((el) => {
            el.classList.remove('hidden');
            el.style.display = 'block';
        });

        // 3. Upload file
        const filePath = path.join(process.cwd(), 'tests/unit/test_pdf/The Project Gutenberg eBook of A Christmas Carol in Prose.pdf');
        await fileInput.setInputFiles(filePath);

        // 4. Click Upload/Generate button
        const uploadBtn = page.locator('#upload-form button[type="submit"]');
        await expect(uploadBtn).toBeVisible();
        // It should become enabled
        await expect(uploadBtn).toBeEnabled({ timeout: 5000 });
        await uploadBtn.click();

        // 5. Monitor for "Processing files..." loading state
        const loadingOverlay = page.locator('#loading-overlay');
        await expect(loadingOverlay).toBeVisible({ timeout: 5000 });

        // 6. Expect explicit failure or success
        // If the bug exists (client-side worker missing), an alert or console error will occur.
        // We'll listen for dialogs (alerts)
        let alertMessage = '';
        page.on('dialog', dialog => {
            alertMessage = dialog.message();
            console.log('Dialog opened:', alertMessage);
            dialog.dismiss();
        });

        // Wait for result. If it fails as expected, we should see an error dialog or console error.
        // We give it some time to process
        try {
            // It might fail quickly if worker is missing
            await page.waitForTimeout(5000);

            // Check if loading disappeared (meaning it finished or crashed)
            await expect(loadingOverlay).toBeHidden();
        } catch (e) {
            console.log('Loading overlay did not disappear in time or other error:', e);
        }

        // Assert that we probably got an error about the worker or parsing
        console.log('Alert message detected:', alertMessage);

        // If the user report is "upload is not working", we expect it NOT to succeed.
        // Success would be "Flashcards created..."
        const successMessage = 'Flashcards created from PDF/images';

        if (alertMessage.includes(successMessage)) {
            throw new Error('Unexpected Success: The PDF upload worked, but we expected it to fail for reproduction.');
        }

        // Broad check for failure
        const failureKeywords = ['Failed', 'error', 'worker', 'pdf'];
        const isFailure = failureKeywords.some(k => alertMessage.toLowerCase().includes(k)) || alertMessage === '';

        // If no alert came up, maybe it silently failed or is stuck loading.
        // If it's stuck loading, that's also a 'failure'.

        // Let's assert we see a failure message or the test timed out/failed to produce cards
        expect(alertMessage).not.toContain(successMessage);
    });
});
