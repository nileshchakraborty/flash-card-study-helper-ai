/**
 * @jest-environment node
 */
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { StudyService } from '../../src/core/services/StudyService.js';
import * as xlsx from 'xlsx';

// Mock external heavy dependencies
jest.mock('pdf-parse', () => ({ default: jest.fn() }));
jest.mock('tesseract.js', () => ({ default: { recognize: jest.fn() } }));
jest.mock('mammoth', () => ({ default: { extractRawText: jest.fn() } }));
jest.mock('xlsx');

// Mock adapters
const mockOllamaAdapter = {
    generateFlashcardsFromText: jest.fn().mockResolvedValue([{ front: 'Q', back: 'A' }]),
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

describe('StudyService', () => {
    let service: StudyService;

    beforeEach(() => {
        jest.clearAllMocks();
        service = new StudyService(
            { ollama: mockOllamaAdapter as any },
            mockSearchAdapter as any,
            mockStorageAdapter as any
        );
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

        (xlsx.read as any).mockReturnValue(mockWorkbook);
        (xlsx.utils.sheet_to_txt as any).mockReturnValue(mockSheetContent);

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

        (xlsx.read as any).mockReturnValue(mockWorkbook);
        (xlsx.utils.sheet_to_txt as any)
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
        (xlsx.read as any).mockReturnValue(mockWorkbook);
        (xlsx.utils.sheet_to_txt as any).mockReturnValue(''); // Empty content

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
