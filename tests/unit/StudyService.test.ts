/**
 * @jest-environment node
 */
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { StudyService } from '../../src/core/services/StudyService.js';
import type { Flashcard } from '../../src/core/domain/models.js';
import xlsx from 'xlsx';

// Mock external heavy dependencies
jest.mock('pdf-parse', () => ({ default: jest.fn() }));
jest.mock('tesseract.js', () => ({ default: { recognize: jest.fn() } }));
jest.mock('mammoth', () => ({ default: { extractRawText: jest.fn() } }));

jest.mock('xlsx', () => ({
    read: jest.fn(),
    utils: {
        sheet_to_txt: jest.fn()
    }
}));

// Mock adapters
const mockOllamaAdapter = {
    generateFlashcardsFromText: jest.fn<(text: string, topic: string, count: number, opts: any) => Promise<Flashcard[]>>().mockResolvedValue([
        { id: '1', front: 'Q', back: 'A', topic: 'test' }
    ]),
    generateFlashcards: jest.fn(),
    generateSummary: jest.fn(),
    generateSubTopics: jest.fn(),
    generateSearchQuery: jest.fn(),
    generateBriefAnswer: jest.fn(),
    generateQuizFromFlashcards: jest.fn(),
    generateAdvancedQuiz: jest.fn(),
};

const mockSearchAdapter = {
    search: jest.fn()
};

const mockStorageAdapter = {
    saveQuizResult: jest.fn(),
    getQuizHistory: jest.fn(),
    saveDeck: jest.fn(),
    getDeckHistory: jest.fn()
};

describe.skip('StudyService', () => {
    let service: StudyService;

    beforeEach(() => {
        jest.clearAllMocks();
        service = new StudyService(
            { ollama: mockOllamaAdapter as any },
            mockSearchAdapter as any,
            mockStorageAdapter as any
        );
    });

    afterAll(() => {
        // Clean up any resources that might cause open handles
        // For example, if StudyService starts any timers or connections:
        // service.cleanup(); // If such a method exists

        // Force Jest to clean up any pending timers
        jest.clearAllTimers();
    });

    it('should process Excel files (.xlsx) correctly', async () => {
        // Arrange
        const mockFileBuffer = Buffer.from('mock-excel-content');
        const mockSheetName = 'Sheet1';
        const mockSheetContent = 'Row1Col1\tRow1Col2\nRow2Col1\tRow2Col2';

        // Mock xlsx behavior
        const mockWorkbook = {
            SheetNames: [mockSheetName],
            Sheets: {
                [mockSheetName]: {} // Dummy sheet object
            }
        };

        (xlsx.read as jest.Mock).mockReturnValue(mockWorkbook);
        (xlsx.utils.sheet_to_txt as jest.Mock).mockReturnValue(mockSheetContent);

        // Act
        await service.processFile(
            mockFileBuffer,
            'test.xlsx',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Excel Topic'
        );

        // Assert
        expect(xlsx.read).toHaveBeenCalledWith(mockFileBuffer, { type: 'buffer' });
        expect(xlsx.utils.sheet_to_txt).toHaveBeenCalledWith(mockWorkbook.Sheets[mockSheetName]);

        // Verify extracted text passed to generateFlashcardsFromText
        // The expected text format is: SHEET: Sheet1\n<content>\n---\n
        const expectedText = `SHEET: ${mockSheetName}\n${mockSheetContent}\n---\n`;
        expect(mockOllamaAdapter.generateFlashcardsFromText).toHaveBeenCalledWith(
            expectedText,
            'Excel Topic',
            10,
            { filename: 'test.xlsx' }
        );
    });

    it('should handle Excel files with multiple sheets', async () => {
        // Arrange
        const mockWorkbook = {
            SheetNames: ['Sheet1', 'Sheet2'],
            Sheets: {
                'Sheet1': {},
                'Sheet2': {}
            }
        };

        (xlsx.read as jest.Mock).mockReturnValue(mockWorkbook);
        (xlsx.utils.sheet_to_txt as jest.Mock)
            .mockReturnValueOnce('Content1')
            .mockReturnValueOnce('Content2');

        // Act
        await service.processFile(
            Buffer.from(''),
            'multi.xls',
            'application/vnd.ms-excel',
            'Multi Sheet'
        );

        // Assert
        const expectedText = `SHEET: Sheet1\nContent1\n---\nSHEET: Sheet2\nContent2\n---\n`;
        expect(mockOllamaAdapter.generateFlashcardsFromText).toHaveBeenCalledWith(
            expectedText,
            'Multi Sheet',
            10,
            { filename: 'multi.xls' }
        );
    });

    it('should fallback to empty string if sheet is empty', async () => {
        // Arrange
        const mockWorkbook = {
            SheetNames: ['EmptySheet'],
            Sheets: { 'EmptySheet': {} }
        };
        (xlsx.read as jest.Mock).mockReturnValue(mockWorkbook);
        (xlsx.utils.sheet_to_txt as jest.Mock).mockReturnValue(''); // Empty content

        // Act
        await service.processFile(Buffer.from(''), 'empty.xlsx', 'application/xlsx', 'Empty');

        // Assert
        // Should pass empty string to adapter? No, combinedText will be empty.
        expect(mockOllamaAdapter.generateFlashcardsFromText).toHaveBeenCalledWith(
            '',
            'Empty',
            10,
            { filename: 'empty.xlsx' }
        );
    });
});
