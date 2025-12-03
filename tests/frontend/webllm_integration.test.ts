import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { GeneratorView } from '../../public/js/views/generator.view.js';
import { apiService } from '../../public/js/services/api.service.js';
import { eventBus } from '../../public/js/utils/event-bus.js';

// Mock dependencies
// apiService is mocked via jest.config.cjs

jest.mock('../../public/js/utils/event-bus.js', () => ({
    eventBus: {
        emit: jest.fn(),
        on: jest.fn(),
        off: jest.fn()
    }
}));

// Mock BaseView since we can't easily import it if it has DOM side effects or complex inheritance
jest.mock('../../public/js/views/base.view.js', () => {
    return {
        BaseView: class {
            getElement(selector: string) {
                return document.querySelector(selector);
            }
            bind(element: any, event: string, handler: any) {
                if (element) element.addEventListener(event, handler);
            }
            show() { }
            hide() { }
        }
    };
});

describe('GeneratorView Integration', () => {
    let view: GeneratorView;
    let mockOrchestrator: any;
    let apiPostSpy: any;

    beforeEach(() => {
        // Setup DOM
        document.body.innerHTML = `
            <form id="topic-form">
                <input id="topic-input" value="Test Topic" />
                <input id="card-count" value="5" />
                <button id="generate-btn" type="submit">Generate</button>
                <input type="checkbox" id="use-browser-llm" />
            </form>
            <div id="loading-overlay"></div>
            <div id="deck-history-list"></div>
        `;

        // Mock LLM Orchestrator on window
        mockOrchestrator = {
            isModelLoaded: jest.fn().mockReturnValue(true),
            generate: jest.fn().mockResolvedValue('[{"question": "Q1", "answer": "A1"}]'),
            getRecommendedStrategy: jest.fn().mockReturnValue({ config: {} }),
            loadModel: jest.fn().mockResolvedValue(undefined)
        };
        (window as any).llmOrchestrator = mockOrchestrator;

        // Spy on API service
        apiPostSpy = jest.spyOn(apiService, 'post').mockResolvedValue({ cards: [{ id: '1', front: 'Q', back: 'A' }] });
        // Also mock get to avoid errors if called
        jest.spyOn(apiService, 'get').mockResolvedValue({ history: [] });

        // Initialize view
        view = new GeneratorView();
    });

    afterEach(() => {
        jest.restoreAllMocks();
        document.body.innerHTML = '';
    });

    it('should use API service when offline mode is disabled', async () => {
        // Remove orchestrator from window to simulate API-only mode
        delete (window as any).llmOrchestrator;

        // Trigger generation
        await view.handleGenerate();

        // Verify API was called
        expect(apiPostSpy).toHaveBeenCalledWith('/generate', expect.objectContaining({
            topic: 'Test Topic',
            count: 5
        }));

        // Verify Orchestrator was NOT called (it doesn't exist)
        expect(mockOrchestrator.generate).not.toHaveBeenCalled();
    });

    it('should use WebLLM when offline mode is enabled', async () => {
        // Check the checkbox
        const checkbox = document.getElementById('use-browser-llm') as HTMLInputElement;
        checkbox.checked = true;

        // Trigger generation
        await view.handleGenerate();

        // Verify Orchestrator WAS called
        expect(mockOrchestrator.generate).toHaveBeenCalled();

        // It SHOULD call /decks to save history
        expect(apiPostSpy).toHaveBeenCalledWith('/decks', expect.anything());
        // Fallback to /generate is allowed if client-side returns fewer cards
    });
});
