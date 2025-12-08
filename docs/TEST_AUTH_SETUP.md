# Test Auth Token Setup

## Quick Setup

1. **Generate a persistent secret key** (one-time):
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" >> .env
```

Then edit `.env` and add:
```bash
JWE_SECRET_KEY=<paste_the_generated_hex_string>
```

2. **Generate test token**:
```bash
npx tsx scripts/generate-test-token.ts
```

3. **Add to .env**:
```bash
TEST_AUTH_TOKEN="<token_from_step_2>"
```

4. **Restart server** to use new secrets:
```bash
npm run dev
```

## Usage

### With Environment Variable
```bash
curl -X POST http://localhost:3000/api/generate \
  -H "Authorization: Bearer $TEST_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"topic":"Machine Learning","count":2}'
```

### Direct Token
Replace `YOUR_TOKEN` with actual token:
```bash
curl -X POST http://localhost:3000/api/generate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"topic":"TypeScript","count":3,"mode":"standard"}'
```

## Test User Details

The test token represents:
- **ID**: `test-user-123`
- **Email**: `test@example.com`
- **Name**: `Test User`
- **Expires**: 2 hours from generation

## Regenerating Token

If token expires (2 hours), just run:
```bash
npx tsx scripts/generate-test-token.ts
```

And update `TEST_AUTH_TOKEN` in `.env`.

## Important Notes

⚠️ **Token Changes on Server Restart** (without JWE_SECRET_KEY):
- If `JWE_SECRET_KEY` is not set, server generates random key on each restart
- Old tokens become invalid when server restarts
- **Solution**: Set `JWE_SECRET_KEY` in `.env` for persistent auth

✅ **With JWE_SECRET_KEY set**:
- Tokens remain valid across server restarts
- More secure for production/development
