import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { storageTool } from '../../../mcp-server/tools/storage.tool.js';
import fs from 'fs/promises';
import path from 'path';

describe('MCP Storage Tool', () => {
    const testDir = path.join(process.cwd(), 'test-storage');
    const testFile = path.join(testDir, 'test.txt');

    beforeEach(async () => {
        // Create test directory
        await fs.mkdir(testDir, { recursive: true });
    });

    afterEach(async () => {
        // Clean up test directory
        try {
            await fs.rm(testDir, { recursive: true, force: true });
        } catch (error) {
            // Ignore cleanup errors
        }
    });

    describe('write_file', () => {
        it('should write content to a file', async () => {
            const result = await storageTool.execute({
                operation: 'write',
                path: testFile,
                content: 'Hello World'
            });

            expect(result).toEqual({ success: true });

            const content = await fs.readFile(testFile, 'utf-8');
            expect(content).toBe('Hello World');
        });

        it('should create parent directories if they dont exist', async () => {
            const nestedFile = path.join(testDir, 'nested', 'deep', 'test.txt');

            const result = await storageTool.execute({
                operation: 'write',
                path: nestedFile,
                content: 'Nested content'
            });

            expect(result).toEqual({ success: true });

            const content = await fs.readFile(nestedFile, 'utf-8');
            expect(content).toBe('Nested content');
        });
    });

    describe('read_file', () => {
        it('should read file content', async () => {
            await fs.writeFile(testFile, 'Test content');

            const result = await storageTool.execute({
                operation: 'read',
                path: testFile
            });

            expect(result).toEqual({ success: true, data: 'Test content' });
        });

        it('should return error for non-existent file', async () => {
            const result = await storageTool.execute({
                operation: 'read',
                path: path.join(testDir, 'missing.txt')
            });

            expect(result).toMatchObject({ success: false });
            expect((result as any).error).toBeDefined();
        });
    });

    describe('list_files', () => {
        it('should list files in directory', async () => {
            await fs.writeFile(path.join(testDir, 'file1.txt'), 'content1');
            await fs.writeFile(path.join(testDir, 'file2.txt'), 'content2');
            await fs.mkdir(path.join(testDir, 'subdir'));

            const result = await storageTool.execute({
                operation: 'list',
                path: testDir
            });

            expect((result as any).success).toBe(true);
            expect((result as any).files).toContain('file1.txt');
            expect((result as any).files).toContain('file2.txt');
            expect((result as any).files).toContain('subdir');
        });

        it('should return error for non-existent directory', async () => {
            const result = await storageTool.execute({
                operation: 'list',
                path: path.join(testDir, 'missing-dir')
            });

            expect(result).toMatchObject({ success: false });
            expect((result as any).error).toBeDefined();
        });
    });

    describe('delete_file', () => {
        it('should delete a file', async () => {
            await fs.writeFile(testFile, 'to be deleted');

            const result = await storageTool.execute({
                operation: 'delete',
                path: testFile
            });

            expect(result).toEqual({ success: true });

            await expect(fs.access(testFile)).rejects.toThrow();
        });
    });
});
