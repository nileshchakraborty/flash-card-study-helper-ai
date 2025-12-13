import type { Response } from 'express';

/**
 * Standard error response format for API
 */
export interface ErrorResponse {
    success: false;
    error: string;
    requestId?: string;
    timestamp?: string;
    code?: string;
}

/**
 * Standard success response format for API
 */
export interface SuccessResponse<T = any> {
    success: true;
    data?: T;
    requestId?: string;
    timestamp?: string;
}

/**
 * Send a standardized error response
 */
export function sendError(
    res: Response,
    statusCode: number,
    message: string,
    options?: {
        requestId?: string;
        code?: string;
        logError?: boolean;
    }
): void {
    const errorResponse: ErrorResponse = {
        success: false,
        error: message,
        requestId: options?.requestId,
        timestamp: new Date().toISOString(),
        code: options?.code
    };

    if (options?.logError !== false) {
        console.error(`[API Error ${statusCode}]`, {
            message,
            requestId: options?.requestId,
            code: options?.code
        });
    }

    res.status(statusCode).json(errorResponse);
}

/**
 * Send a standardized success response
 */
export function sendSuccess<T>(
    res: Response,
    data: T,
    options?: {
        requestId?: string;
        statusCode?: number;
    }
): void {
    const successResponse: SuccessResponse<T> = {
        success: true,
        data,
        requestId: options?.requestId,
        timestamp: new Date().toISOString()
    };

    res.status(options?.statusCode || 200).json(successResponse);
}

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Error codes for common scenarios
 */
export const ErrorCodes = {
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    NOT_FOUND: 'NOT_FOUND',
    RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
    FILE_TOO_LARGE: 'FILE_TOO_LARGE',
    UNSUPPORTED_FILE_TYPE: 'UNSUPPORTED_FILE_TYPE',
    PROCESSING_ERROR: 'PROCESSING_ERROR',
    INTERNAL_ERROR: 'INTERNAL_ERROR'
} as const;
