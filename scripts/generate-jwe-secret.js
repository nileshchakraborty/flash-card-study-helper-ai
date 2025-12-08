#!/usr/bin/env node
// Generate a JWE secret key for authentication
const crypto = require('crypto');

const secret = crypto.randomBytes(32).toString('hex');

console.log('\n=== JWE Secret Key Generated ===\n');
console.log('Copy this EXACT line to your .env file:\n');
console.log(`JWE_SECRET_KEY=${secret}`);
console.log('\n✅ This is a 64-character hex string (32 bytes)\n');
