import { put, del, list } from '@vercel/blob';
import { logger } from './LoggerService.js';

/**
 * Vercel Blob storage service for file uploads
 */
export class BlobStorageService {
    private token: string;

    constructor(token: string) {
        this.token = token;
        logger.info('✅ Blob Storage initialized');
    }

    /**
     * Upload content to blob storage
     */
    async upload(
        filename: string,
        content: Buffer | string,
        options: { access?: 'public' | 'private' } = {}
    ): Promise<{ url: string }> {
        try {
            const result = await put(filename, content, {
                access: (options.access || 'public') as any,
                token: this.token
            });

            logger.info(`📤 Uploaded to blob storage: ${filename}`);
            return { url: result.url };
        } catch (error: any) {
            logger.error(`Failed to upload ${filename}:`, error);
            throw new Error(`Blob upload failed: ${error.message}`);
        }
    }

    /**
     * Delete file from blob storage
     */
    async delete(url: string): Promise<void> {
        try {
            await del(url, { token: this.token });
            logger.info(`🗑️  Deleted from blob storage: ${url}`);
        } catch (error: any) {
            logger.error(`Failed to delete ${url}:`, error);
            throw new Error(`Blob deletion failed: ${error.message}`);
        }
    }

    /**
     * List all blobs (for debugging/admin)
     */
    async listAll(): Promise<string[]> {
        try {
            const { blobs } = await list({ token: this.token });
            return blobs.map(blob => blob.url);
        } catch (error: any) {
            logger.error('Failed to list blobs:', error);
            return [];
        }
    }
}
