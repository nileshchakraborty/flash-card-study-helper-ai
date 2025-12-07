import type { Request, Response, NextFunction } from 'express';
import { sendError, ErrorCodes } from '../response-helpers.js';

/**
 * Wrapper for async route handlers with standardized error handling
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
