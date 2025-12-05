import { AuthService } from './src/core/services/AuthService.js';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
    const auth = AuthService.getInstance();

    // Generate a token
    const token = await auth.encryptToken({ id: 'test-user', email: 'test@example.com', name: 'Test User' });
    console.log('Generated token:', token);

    // Try to decrypt it
    try {
        const payload = await auth.decryptToken(token);
        console.log('✅ Decryption successful!');
        console.log('Payload:', payload);
    } catch (error) {
        console.log('❌ Decryption failed:', error);
    }
}

main().catch(console.error);
