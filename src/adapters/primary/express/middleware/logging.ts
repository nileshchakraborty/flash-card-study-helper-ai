import type { Request, Response, NextFunction } from 'express';
import { generateRequestId } from '../response-helpers.js';

/**
 * Middleware to add request IDs to all requests for tracing
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
    const requestId = req.headers['x-request-id'] as string || generateRequestId();

    // Attach to request for use in handlers
    (req as any).requestId = requestId;

    // Add to response headers
    res.setHeader('X-Request-ID', requestId);

    next();
}

/**
 * Middleware to log request/response details
 */
export function requestLoggingMiddleware(req: Request, res: Response, next: NextFunction): void {
    const start = Date.now();
    const requestId = (req as any).requestId;

    // Log request
    console.log(`[${requestId}] ${req.method} ${req.path}`, {
        query: Object.keys(req.query).length > 0 ? req.query : undefined,
        body: req.method !== 'GET' && req.body ? '(body present)' : undefined
    });

    // Capture response
    const originalSend = res.json;
    res.json = function (data: any) {
        const duration = Date.now() - start;

        console.log(`[${requestId}] ${res.statusCode} ${req.method} ${req.path} (${duration}ms)`);

        return originalSend.call(this, data);
    };

    next();
}
