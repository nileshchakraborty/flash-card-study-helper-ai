import type { Request, Response, NextFunction } from 'express';
import { AuthService } from '../../../../core/services/AuthService.js';

const authService = new AuthService();

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Unauthorized: No token provided' });
        return;
    }

    const token = authHeader.split(' ')[1];

    try {
        const payload = await authService.decryptToken(token);
        (req as any).user = payload;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
};
