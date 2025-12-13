// Load environment variables from .env file
import 'dotenv/config';
import { AuthService } from '../src/core/services/AuthService.js';

async function generateTestToken() {
    console.log('\n=== Generating Test Auth Token ===\n');

    try {
        const authService = AuthService.getInstance();

        const testUser = {
            id: 'test-user-123',
            email: 'test@example.com',
            name: 'Test User',
            iat: Math.floor(Date.now() / 1000)
        };

        const token = await authService.encryptToken(testUser);

        console.log('✅ Token generated successfully!\n');
        console.log('Token:', token);
        console.log('\n📋 Add to .env file:');
        console.log(`TEST_AUTH_TOKEN="${token}"`);
        console.log('\n🧪 Test with curl:');
        console.log(`curl -X POST http://localhost:3000/api/generate \\`);
        console.log(`  -H "Authorization: Bearer ${token}" \\`);
        console.log(`  -H "Content-Type: application/json" \\`);
        console.log(`  -d '{"topic":"Machine Learning","count":2}'`);
        console.log('\n⏰ Token valid for: 2 hours');
        console.log('👤 Test user: test@example.com (ID: test-user-123)\n');

        // Verify token works
        const decoded = await authService.decryptToken(token);
        console.log('✅ Token verification passed:', decoded);
        console.log('\n');

    } catch (error) {
        console.error('❌ Error generating token:', error);
        process.exit(1);
    }
}

generateTestToken();
