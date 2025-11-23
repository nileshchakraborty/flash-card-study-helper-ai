
import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import { GeneratorView } from '../../public/js/views/generator.view.js';
import { LLMOrchestrator } from '../../public/js/services/llm/LLMOrchestrator.js';
import { apiService } from '../../public/js/services/api.service.js';
import { eventBus } from '../../public/js/utils/event-bus.js';

// Mock dependencies
jest.mock('../../public/js/services/llm/LLMOrchestrator.js');
jest.mock('../../public/js/services/api.service.js');
jest.mock('../../public/js/utils/event-bus.js');
jest.mock('../../public/js/services/FileProcessingService.js', () => ({
    FileProcessingService: {
        processFiles: jest.fn().mockResolvedValue('Extracted text content')
    }
}));

describe('WebLLM Integration Tests', () => {
    let generatorView;
    let mockOrchestrator;

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();

        // Setup DOM elements
        document.body.innerHTML = `
      <form id="upload-form">
        <input type="file" id="file-upload" multiple>
        <input type="text" id="upload-topic" value="Test Topic">
        <button type="submit">Upload</button>
      </form>
      <div id="loading-overlay"></div>
      <div id="deck-history-list"></div>
    `;

        // Mock Orchestrator instance
        mockOrchestrator = {
            isModelLoaded: jest.fn().mockReturnValue(true),
            generate: jest.fn().mockResolvedValue('[{"question": "Q1", "answer": "A1"}]'),
            getRecommendedStrategy: jest.fn().mockReturnValue({ config: {} }),
            loadModel: jest.fn().mockResolvedValue(undefined)
        };
        window.llmOrchestrator = mockOrchestrator;

        // Initialize View
        generatorView = new GeneratorView();
    });

    test('should use LLMOrchestrator for file uploads and NOT call backend generation API', async () => {
        // Simulate file selection
        const fileInput = document.getElementById('file-upload');
        const file = new File(['dummy content'], 'test.pdf', { type: 'application/pdf' });
        Object.defineProperty(fileInput, 'files', { value: [file] });

        // Trigger upload
        await generatorView.handleUpload();

        // Verify LLM Orchestrator was called
        expect(mockOrchestrator.generate).toHaveBeenCalled();
        expect(mockOrchestrator.generate).toHaveBeenCalledWith(expect.stringContaining('Extracted text content'));

        // Verify Backend API was NOT called for generation (only for saving deck)
        expect(apiService.post).not.toHaveBeenCalledWith('/api/upload', expect.anything());
        expect(apiService.post).not.toHaveBeenCalledWith('/generate', expect.anything());

        // Verify Deck was saved
        expect(apiService.post).toHaveBeenCalledWith('/decks', expect.objectContaining({
            topic: 'Test Topic',
            cards: expect.arrayContaining([
                expect.objectContaining({ front: 'Q1', back: 'A1' })
            ])
        }));
    });

    test('should fallback to regex parsing if LLM returns text format', async () => {
        // Mock LLM returning text format
        mockOrchestrator.generate.mockResolvedValue(`
      Here are the cards:
      Question: What is X?
      Answer: Y
    `);

        // Simulate file selection
        const fileInput = document.getElementById('file-upload');
        const file = new File(['dummy content'], 'test.txt', { type: 'text/plain' });
        Object.defineProperty(fileInput, 'files', { value: [file] });

        // Trigger upload
        await generatorView.handleUpload();

        // Verify cards were extracted
        expect(eventBus.emit).toHaveBeenCalledWith('deck:loaded', expect.arrayContaining([
            expect.objectContaining({ front: 'What is X?', back: 'Y' })
        ]));
    });
});
