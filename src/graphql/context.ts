import type { AuthService } from '../core/services/AuthService.js';
import type { StudyUseCase } from '../core/ports/interfaces.js';
import type { QuizStorageService } from '../core/services/QuizStorageService.js';
import type { FlashcardStorageService } from '../core/services/FlashcardStorageService.js';
import type { QueueService } from '../core/services/QueueService.js';
import type { WebLLMService } from '../core/services/WebLLMService.js';

export interface GraphQLContext {
    authService: AuthService;
    studyService: StudyUseCase;
    quizStorage: QuizStorageService;
    flashcardStorage: FlashcardStorageService;
    queueService: QueueService;
    webllmService: WebLLMService;
    user?: {
        id: string;
        email: string;
        name: string;
    };
    token?: string;
}

export async function createContext(
    req: any,
    services: {
        authService: AuthService;
        studyService: StudyUseCase;
        quizStorage: QuizStorageService;
        flashcardStorage: FlashcardStorageService;
        queueService: QueueService;
        webllmService: WebLLMService;
    }
): Promise<GraphQLContext> {
    // Extract token from Authorization header
    const token = req.headers.authorization?.replace('Bearer ', '');

    let user;
    if (token) {
        try {
            // Decrypt and decode token
            const payload = await services.authService.decryptToken(token);
            user = {
                id: payload.id || payload.sub || '',
                email: payload.email || '',
                name: payload.name || ''
            };
        } catch (error: any) {
            // Token is invalid, user remains undefined
            console.warn('[GraphQL Context] Token decryption failed:', error.message);
        }
    }

    return {
        ...services,
        user,
        token
    };
}

// Helper to check if user is authenticated
export function requireAuth(context: GraphQLContext) {
    if (!context.user) {
        throw new Error('Authentication required');
    }
    return context.user;
}
