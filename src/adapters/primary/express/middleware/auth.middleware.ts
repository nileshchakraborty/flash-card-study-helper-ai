import type { Request, Response, NextFunction } from 'express';
import { AuthService } from '../../../../core/services/AuthService.js';


export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        // Get AuthService instance inside the function (not at module level)
        // This ensures dotenv.config() has run before the singleton is created
        const authService = AuthService.getInstance();

        const authHeader = req.headers.authorization;
        const token = authHeader?.replace('Bearer ', '');

        if (!authHeader) {
            res.status(401).json({ error: 'No authorization header' });
            return;
        }

        if (!token) {
            res.status(401).json({ error: 'Invalid authorization header format' });
            return;
        }

        // Decrypt token using JWE
        const user = await authService.decryptToken(token);
        (req as any).user = user;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Invalid or expired token' });
        return;
    }
}
