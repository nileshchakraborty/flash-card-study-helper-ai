#!/usr/bin/env node
/**
 * Generate JWE Secret Key
 * 
 * This script generates a cryptographically secure 256-bit (32-byte) secret key
 * for JWT/JWE token encryption.
 * 
 * Usage:
 *   node scripts/generate-jwe-secret.cjs
 * 
 * Output format:
 *   JWE_SECRET_KEY=<64-character-hex-string>
 * 
 * Add the output to your .env file.
 */

const crypto = require('crypto');

function generateSecret() {
    const secret = crypto.randomBytes(32).toString('hex');

    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║          JWE Secret Key Generator                             ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');
    console.log('✅ Generated 256-bit (32-byte) secret key\n');
    console.log('📋 Copy this EXACT line to your .env file:\n');
    console.log(`   JWE_SECRET_KEY=${secret}\n`);
    console.log('⚠️  IMPORTANT:\n');
    console.log('   - Do NOT include quotes');
    console.log('   - Do NOT add extra spaces');
    console.log('   - Keep this secret secure and private\n');
    console.log('🔄 After adding to .env:\n');
    console.log('   1. Restart your server: npm run dev');
    console.log('   2. Generate test token: npx tsx scripts/generate-test-token.ts\n');

    return secret;
}

if (require.main === module) {
    generateSecret();
}

module.exports = { generateSecret };
