import type { Request, Response, NextFunction } from 'express';
import { AuthService } from '../../../../core/services/AuthService.js';


export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        // TEST AUTH BYPASS: Allow E2E tests to use TEST_AUTH_TOKEN
        // Only enabled in test/development environments
        if (process.env.NODE_ENV !== 'production') {
            const testAuthHeader = req.headers['x-test-auth'];

            if (testAuthHeader === 'true' && process.env.TEST_AUTH_TOKEN) {
                // Use test user for E2E tests
                (req as any).user = {
                    id: 'test-user-123',
                    email: 'test@example.com',
                    name: 'Test User',
                    iat: Math.floor(Date.now() / 1000),
                    exp: Math.floor(Date.now() / 1000) + 7200
                };
                next();
                return;
            }
        }

        const authHeader = req.headers.authorization;

        if (!authHeader) {
            res.status(401).json({ error: 'No authorization header' });
            return;
        }

        const token = authHeader.replace('Bearer ', '');
        // Get AuthService instance inside the function (not at module level)
        // This ensures dotenv.config() has run before the singleton is created
        const authService = AuthService.getInstance();
        const payload = await authService.decryptToken(token);

        // Attach user to request
        (req as any).user = payload;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Invalid or expired token' });
    }
}
