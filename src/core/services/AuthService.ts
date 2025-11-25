import { EncryptJWT, jwtDecrypt } from 'jose';
import crypto from 'crypto';

export class AuthService {
    private secretKey: Uint8Array;

    constructor() {
        // In production, this should be loaded from env and be a proper key
        // For now, we generate a random key if not provided
        const secret = process.env.JWE_SECRET_KEY || crypto.randomBytes(32).toString('hex');
        this.secretKey = new TextEncoder().encode(secret);
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
