import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

test.describe('Multi-Source Card Creation', () => {
    test.beforeEach(async ({ page }) => {
        // Enable console logging & request logging
        page.on('console', msg => console.log(`[Browser Console]: ${msg.text()}`));
        page.on('pageerror', err => console.log(`[Browser Error]: ${err}`));
        page.on('request', request => console.log(`[Network Request]: ${request.method()} ${request.url()}`));

        // 1. Navigate to the app initially
        await page.goto('/');

        // 2. Set authentication token in localStorage
        await page.evaluate(() => {
            localStorage.setItem('authToken', 'test-token');
            localStorage.setItem('user', JSON.stringify({
                id: 'test-user-123',
                email: 'test@example.com',
                name: 'Test User'
            }));
        });

        // 3. Reload the page to trigger DOMContentLoaded with auth state
        await page.reload();

        // 4. Wait for app content to be visible
        await expect(page.locator('#app-content')).toBeVisible();
        await expect(page.locator('#landing-page')).toBeHidden();

        // Ensure we are on the Create Cards tab or navigate to it
        const createTabSection = page.locator('#create-tab');
        if (!(await createTabSection.isVisible())) {
            const createTabBtn = page.locator('button[data-tab="create"]');
            await expect(createTabBtn).toBeVisible();
            await createTabBtn.click();
        }

        // Reset modes to default state for clean test start
        await page.evaluate(() => {
            ['files-mode', 'text-mode', 'urls-mode'].forEach(id => {
                document.getElementById(id)?.classList.add('hidden');
            });
            document.getElementById('topic-mode')?.classList.remove('hidden');
        });
    });

    test('should generate cards from raw text and redirect to study', async ({ page }) => {
        // 1. Switch to "Text" sub-tab
        const textTab = page.locator('button[data-target="text-mode"]');
        await textTab.click();

        // 2. Verify Text Form is visible
        const textForm = page.locator('#text-form');
        await expect(textForm).toBeVisible();

        // 3. Fill in the form
        await page.fill('#raw-text-input', 'Photosynthesis is the process...');
        await page.fill('#text-topic', 'Biology 101');

        // 4. Submit
        await page.route('**/api/generate/from-content', async route => {
            console.log('Intercepted /api/generate/from-content request');
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    success: true,
                    cards: [
                        { id: '1', front: 'What is photosynthesis?', back: 'Process used by plants to convert light energy into chemical energy.', topic: 'Biology 101' },
                        { id: '2', front: 'What are the inputs of photosynthesis?', back: 'Sunlight, water, and carbon dioxide.', topic: 'Biology 101' }
                    ]
                })
            });
        });

        // Mock saveDeck and quiz calls (AppController makes these)
        await page.route('**/api/decks', async route => {
            await route.fulfill({ status: 200, body: JSON.stringify({ success: true, id: 'deck-123' }) });
        });
        await page.route('**/api/quiz', async route => {
            await route.fulfill({ status: 200, body: JSON.stringify({ success: true, questions: [] }) });
        });

        const generateBtn = textForm.locator('button[type="submit"]');
        await generateBtn.click();

        // 5. Verify Redirection to Study Tab
        await expect(page.locator('#study-tab')).toBeVisible();

        // 6. Verify Card Content matches generated cards
        await expect(page.locator('.card-front')).toContainText('What is photosynthesis?');
    });

    test('should generate cards from URLs and redirect to study', async ({ page }) => {
        // 1. Switch to "URLs" sub-tab
        const urlsTab = page.locator('button[data-target="urls-mode"]');
        await urlsTab.click();

        // 2. Verify URLs Form is visible
        const urlsForm = page.locator('#urls-form');
        await expect(urlsForm).toBeVisible();

        // 3. Fill in the form
        await page.fill('#urls-input', 'https://example.com/topic1\nhttps://example.com/topic2');
        await page.fill('#urls-topic', 'Web Research');

        // 4. Submit (Intercept API)
        await page.route('**/api/generate/from-content', async route => {
            console.log('Intercepted /api/generate/from-content (URLs) request');
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    success: true,
                    cards: [
                        { id: '3', front: 'Question from URL?', back: 'Answer from URL.', topic: 'Web Research' }
                    ]
                })
            });
        });

        await page.route('**/api/decks', async route => {
            await route.fulfill({ status: 200, body: JSON.stringify({ success: true, id: 'deck-456' }) });
        });
        await page.route('**/api/quiz', async route => {
            await route.fulfill({ status: 200, body: JSON.stringify({ success: true, questions: [] }) });
        });

        const generateBtn = urlsForm.locator('button[type="submit"]');
        await generateBtn.click();

        // 5. Verify Redirection to Study Tab
        await expect(page.locator('#study-tab')).toBeVisible();
        await expect(page.locator('.card-front')).toContainText('Question from URL?');
    });

    test('should upload and generate from .docx file and redirect to study', async ({ page }) => {
        const filesTab = page.locator('button[data-target="files-mode"]');
        await filesTab.click();

        const fileInput = page.locator('#file-input'); // Changed from #file-upload to #file-input based on HTML
        const filePath = path.join(process.cwd(), 'tests/unit/test_data/docx/The Project Gutenberg eBook of American lace.docx');
        await fileInput.setInputFiles(filePath);

        // Wait for file to be selected (logic updates UI)
        await expect(page.locator('#selected-files')).not.toHaveClass(/hidden/);

        // Mock upload response
        await page.route('**/api/upload', async route => {
            console.log('Intercepted /api/upload request');
            await route.fulfill({
                status: 200,
                body: JSON.stringify({
                    success: true,
                    cards: [{ id: 'docx-1', front: 'Lace Question', back: 'Lace Answer', topic: 'Lace' }]
                })
            });
        });

        await page.route('**/api/decks', async route => {
            await route.fulfill({ status: 200, body: JSON.stringify({ success: true, id: 'deck-docx' }) });
        });
        await page.route('**/api/quiz', async route => {
            await route.fulfill({ status: 200, body: JSON.stringify({ success: true, questions: [] }) });
        });

        const uploadBtn = page.locator('#upload-form button[type="submit"]');
        await expect(uploadBtn).toBeEnabled({ timeout: 5000 });

        // Handle confirm dialog
        page.on('dialog', dialog => dialog.accept());

        await uploadBtn.click();

        // Verify redirection
        await expect(page.locator('#study-tab')).toBeVisible();
        await expect(page.locator('.card-front')).toContainText('Lace Question');
    });

    test('should generate cards from large text file content and redirect', async ({ page }) => {
        const textTab = page.locator('button[data-target="text-mode"]');
        await textTab.click();

        const filePath = path.join(process.cwd(), 'tests/unit/test_data/text/test.txt');
        const fileContent = fs.readFileSync(filePath, 'utf-8');

        await page.fill('#raw-text-input', fileContent.substring(0, 1000));
        await page.fill('#text-topic', 'Poetry Life');

        await page.route('**/api/generate/from-content', async route => {
            await route.fulfill({
                status: 200,
                body: JSON.stringify({
                    success: true,
                    cards: [{ id: 'text-1', front: 'Who is Stanton?', back: 'Examples of poets.', topic: 'Poetry Life' }]
                })
            });
        });

        await page.route('**/api/decks', async route => {
            await route.fulfill({ status: 200, body: JSON.stringify({ success: true, id: 'deck-text' }) });
        });
        await page.route('**/api/quiz', async route => {
            await route.fulfill({ status: 200, body: JSON.stringify({ success: true, questions: [] }) });
        });

        const generateBtn = page.locator('#text-form button[type="submit"]');
        await generateBtn.click();

        await expect(page.locator('#study-tab')).toBeVisible();
        await expect(page.locator('.card-front')).toContainText('Who is Stanton?');
    });
});
