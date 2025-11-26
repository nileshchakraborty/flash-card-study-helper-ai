import { EncryptJWT, jwtDecrypt } from 'jose';
import crypto from 'crypto';

export class AuthService {
    private static instance: AuthService;
    private secretKey: Uint8Array;

    private constructor() {
        // In production, this should be loaded from env and be a proper key
        // Generate a random key if not provided (will be consistent across all getInstance calls)
        const secret = process.env.JWE_SECRET_KEY || crypto.randomBytes(32).toString('hex');

        // If it's a 64-char hex string, decode it to 32 bytes
        // Otherwise treat it as a UTF-8 string (must be exactly 32 chars for 256 bits)
        if (secret.length === 64 && /^[0-9a-fA-F]+$/.test(secret)) {
            // Hex string: convert to bytes
            this.secretKey = new Uint8Array(secret.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
        } else {
            // Plain text: must be exactly 32 characters
            this.secretKey = new TextEncoder().encode(secret);
            if (this.secretKey.length !== 32) {
                throw new Error(`JWE_SECRET_KEY must be either a 64-character hex string or exactly 32 characters. Got ${this.secretKey.length} bytes.`);
            }
        }
        console.log('[AuthService] Initialized with', process.env.JWE_SECRET_KEY ? 'env secret' : 'generated secret');
    }

    static getInstance(): AuthService {
        if (!AuthService.instance) {
            AuthService.instance = new AuthService();
        }
        return AuthService.instance;
    }

    async encryptToken(payload: any): Promise<string> {
        return new EncryptJWT(payload)
            .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
            .setIssuedAt()
            .setExpirationTime('2h')
            .encrypt(this.secretKey);
    }

    async decryptToken(token: string): Promise<any> {
        try {
            const { payload } = await jwtDecrypt(token, this.secretKey);
            return payload;
        } catch (error) {
            throw new Error('Invalid token');
        }
    }
}
