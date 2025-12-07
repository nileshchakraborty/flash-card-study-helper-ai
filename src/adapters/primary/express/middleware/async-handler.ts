import type { Request, Response, NextFunction } from 'express';
import { sendError, ErrorCodes } from '../response-helpers.js';

/**
 * Wrapper for async route handlers with standardized error handling
 * 
 * This wrapper provides consistent error handling across all async Express routes:
 * - Catches all Promise rejections
 * - Logs errors with request context
 * - Returns standardized error responses
 * - Includes request IDs for tracing
 * 
 * @example
 * // Before (manual error handling):
 * app.get('/api/data', async (req, res) => {
 *   try {
 *     const data = await fetchData();
 *     res.json({ success: true, data });
 *   } catch (error) {
 *     res.status(500).json({ error: error.message });
 *   }
 * });
 * 
 * // After (with asyncHandler):
 * app.get('/api/data', asyncHandler(async (req, res) => {
 *   const requestId = (req as any).requestId;
 *   const data = await fetchData();
 *   return sendSuccess(res, { data }, { requestId });
 * }));
 * 
 * @param fn - Async route handler function
 * @returns Express middleware function with error handling
 */
export function asyncHandler(
    fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
    return (req: Request, res: Response, next: NextFunction) => {
        const requestId = (req as any).requestId;

        Promise.resolve(fn(req, res, next)).catch((error) => {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.error('[API Error]', { requestId, message, stack: error.stack });

            sendError(res, 500, message, {
                requestId,
                code: ErrorCodes.INTERNAL_ERROR
            });
        });
    };
}
