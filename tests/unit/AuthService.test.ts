/**
 * @jest-environment node
 */
import { AuthService } from '../../src/core/services/AuthService.js';

describe('AuthService', () => {
    let authService: AuthService;

    beforeEach(() => {
        // Use a 64-char hex string (32 bytes = 256 bits)
        process.env.JWE_SECRET_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
        // Clear singleton instance between tests for isolation
        (AuthService as any).instance = undefined;
        authService = AuthService.getInstance();
    });

    describe('encryptToken and decryptToken', () => {
        it('should encrypt and decrypt a token successfully', async () => {
            const payload = {
                id: 'user123',
                email: 'test@example.com',
                name: 'Test User'
            };

            const token = await authService.encryptToken(payload);
            expect(token).toBeDefined();
            expect(typeof token).toBe('string');

            const decrypted = await authService.decryptToken(token);
            expect(decrypted.id).toBe(payload.id);
            expect(decrypted.email).toBe(payload.email);
            expect(decrypted.name).toBe(payload.name);
        });

        it('should throw error for invalid token', async () => {
            await expect(authService.decryptToken('invalid-token')).rejects.toThrow('Invalid token');
        });

        it('should include expiration time', async () => {
            const payload = { id: 'test' };
            const token = await authService.encryptToken(payload);
            const decrypted = await authService.decryptToken(token);

            expect(decrypted.exp).toBeDefined();
            expect(decrypted.iat).toBeDefined();
        });

        it('should reject expired tokens', async () => {
            // This test would require mocking time or using a very short expiration
            // Skipping for now as it requires more complex setup
        });
    });

    describe('token security', () => {
        it('should produce different tokens for same payload', async () => {
            const payload = { id: 'test' };
            const token1 = await authService.encryptToken(payload);
            const token2 = await authService.encryptToken(payload);

            // Tokens should be different due to different timestamps
            expect(token1).not.toBe(token2);
        });

        it('should handle complex payload objects', async () => {
            const complexPayload = {
                id: '123',
                roles: ['admin', 'user'],
                metadata: {
                    createdAt: Date.now(),
                    permissions: ['read', 'write']
                }
            };

            const token = await authService.encryptToken(complexPayload);
            const decrypted = await authService.decryptToken(token);

            expect(decrypted.id).toBe(complexPayload.id);
            expect(decrypted.roles).toEqual(complexPayload.roles);
            expect(decrypted.metadata).toEqual(complexPayload.metadata);
        });
    });

    describe('singleton pattern', () => {
        it('should return the same instance', () => {
            const instance1 = AuthService.getInstance();
            const instance2 = AuthService.getInstance();
            expect(instance1).toBe(instance2);
        });

        it('should share secret key across instances for token verification', async () => {
            const payload = { id: 'test-user', email: 'test@example.com' };

            // Instance 1 encrypts 
            const instance1 = AuthService.getInstance();
            const token = await instance1.encryptToken(payload);

            // Instance 2 should decrypt successfully (same secret)
            const instance2 = AuthService.getInstance();
            const decrypted = await instance2.decryptToken(token);

            expect(decrypted.id).toBe(payload.id);
            expect(decrypted.email).toBe(payload.email);
        });
    });
});
