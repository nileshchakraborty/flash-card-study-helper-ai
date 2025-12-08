import { createClient } from '@supabase/supabase-js';
import { logger } from './LoggerService.js';

/**
 * Supabase service for persistent storage
 */
export class SupabaseService {
    private client: ReturnType<typeof createClient> | null = null;
    private isInitialized = false;

    /**
     * Initialize Supabase client from environment variables
     */
    async initialize(): Promise<void> {
        const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

        if (!url || !key) {
            logger.warn('⚠️  Supabase credentials not found, skipping initialization');
            return;
        }

        try {
            this.client = createClient(url, key);
            this.isInitialized = true;
            logger.info('✅ Supabase initialized successfully');
        } catch (error: any) {
            logger.warn('⚠️  Supabase initialization failed:', error.message);
            this.client = null;
            this.isInitialized = false;
        }
    }

    /**
     * Get Supabase client
     */
    getClient() {
        return this.client;
    }

    /**
     * Check if Supabase is available
     */
    isAvailable(): boolean {
        return this.isInitialized && this.client !== null;
    }

    /**
     * Upsert a user profile (id, email, name). Safe to call on every login/signup.
     */
    async upsertUser(user: { id: string; email?: string; name?: string }) {
        if (!this.client) return { data: null, error: 'Supabase not initialized' };
        const payload = {
            id: user.id,
            email: user.email || null,
            name: user.name || null,
            updated_at: new Date().toISOString()
        };
        return await (this.client as any)
            .from('users')
            .upsert(payload, { onConflict: 'id' });
    }

    /**
     * Store flashcards persistently.
     */
    async storeFlashcards(cards: Array<{ id: string; front: string; back: string; topic?: string; sourceType?: string; sourceName?: string }>) {
        if (!this.client || !cards?.length) return { data: null, error: 'Supabase not initialized' };
        const payload = cards.map(c => ({
            id: c.id,
            topic: c.topic || 'General',
            front: c.front,
            back: c.back,
            source_type: c.sourceType || null,
            source_name: c.sourceName || null,
            created_at: new Date().toISOString()
        }));

        return await (this.client as any)
            .from('flashcards')
            .upsert(payload, { onConflict: 'id' });
    }

    /**
     * Retrieve flashcards by topic (best-effort).
     */
    async getFlashcardsByTopic(topic: string, limit = 50) {
        if (!this.client) return { data: null, error: 'Supabase not initialized' };
        return await (this.client as any)
            .from('flashcards')
            .select('*')
            .ilike('topic', topic)
            .limit(limit);
    }

    // Flashcard operations
    async getFlashcards() {
        if (!this.client) return { data: null, error: 'Supabase not initialized' };
        return await this.client.from('flashcards').select();
    }

    async createFlashcard(flashcard: any) {
        if (!this.client) return { data: null, error: 'Supabase not initialized' };
        return await this.client.from('flashcards').insert(flashcard);
    }

    async updateFlashcard(id: string, updates: any) {
        if (!this.client) return { data: null, error: 'Supabase not initialized' };
        // @ts-ignore - Supabase types are restrictive without schema
        return await this.client.from('flashcards').update(updates).eq('id', id);
    }

    async deleteFlashcard(id: string) {
        if (!this.client) return { data: null, error: 'Supabase not initialized' };
        return await this.client.from('flashcards').delete().eq('id', id);
    }

    // Quiz operations
    async getQuizzes() {
        if (!this.client) return { data: null, error: 'Supabase not initialized' };
        return await this.client.from('quizzes').select();
    }

    async createQuiz(quiz: any) {
        if (!this.client) return { data: null, error: 'Supabase not initialized' };
        return await this.client.from('quizzes').insert(quiz);
    }

    async getQuiz(id: string) {
        if (!this.client) return { data: null, error: 'Supabase not initialized' };
        return await this.client.from('quizzes').select().eq('id', id).single();
    }

    // Quiz attempts
    async createQuizAttempt(attempt: any) {
        if (!this.client) return { data: null, error: 'Supabase not initialized' };
        return await this.client.from('quiz_attempts').insert(attempt);
    }

    async getQuizAttempts(quizId: string) {
        if (!this.client) return { data: null, error: 'Supabase not initialized' };
        return await this.client.from('quiz_attempts').select().eq('quiz_id', quizId);
    }
}
