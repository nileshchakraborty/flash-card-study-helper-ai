import type { Request, Response, NextFunction } from 'express';
import { AuthService } from '../../../../core/services/AuthService.js';


export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
    try {
        // Get AuthService instance inside the function (not at module level)
        // This ensures dotenv.config() has run before the singleton is created
        const authService = AuthService.getInstance();

        const token = req.headers.authorization?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        // Decrypt token using JWE
        const user = await authService.decryptToken(token);
        (req as any).user = user;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}
