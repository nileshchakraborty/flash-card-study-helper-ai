import { AuthService } from './src/core/services/AuthService.js';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
    const auth = AuthService.getInstance();
    const token = await auth.encryptToken({ id: 'test-user', email: 'test@example.com', name: 'Test User' });
    console.log(token);
}

main().catch(console.error);
