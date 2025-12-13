# Utility Scripts

This directory contains utility scripts for the MindFlip AI project.

## Available Scripts

### `generate-jwe-secret.cjs`
Generate a cryptographically secure JWE secret key for authentication.

**Usage:**
```bash
node scripts/generate-jwe-secret.cjs
```

**Output:** A 64-character hex string to add to your `.env` file as `JWE_SECRET_KEY`

---

### `generate-test-token.ts`
Generate a test authentication token for API testing.

**Usage:**
```bash
npx tsx scripts/generate-test-token.ts
```

**Requirements:** 
- `JWE_SECRET_KEY` must be set in `.env`
- Server should be running (or will use same secret)

**Output:** A valid JWT token that can be used with the `Authorization: Bearer` header

---

## Quick Setup for Testing

1. **Generate secret key:**
   ```bash
   node scripts/generate-jwe-secret.cjs
   ```

2. **Add to `.env`:**
   ```bash
   JWE_SECRET_KEY=<output-from-step-1>
   ```

3. **Start server:**
   ```bash
   npm run dev
   ```

4. **Generate test token:**
   ```bash
   npx tsx scripts/generate-test-token.ts
   ```

5. **Test API:**
   ```bash
   curl -X POST http://localhost:3000/api/generate \
     -H "Authorization: Bearer <token-from-step-4>" \
     -H "Content-Type: application/json" \
     -d '{"topic":"TypeScript","count":3}'
   ```
