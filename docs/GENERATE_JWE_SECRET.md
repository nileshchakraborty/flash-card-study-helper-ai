# Generate JWE Secret Key

## Quick Command

Run this command to generate a valid secret:

```bash
node -e "console.log('JWE_SECRET_KEY=' + require('crypto').randomBytes(32).toString('hex'))"
```

## What You'll Get

A line like:
```
JWE_SECRET_KEY=a1b2c3d4e5f6...  (64 hex characters)
```

## How to Use

1. **Run the command** (copy output)
2. **Open `.env` file**
3. **Replace or add** the `JWE_SECRET_KEY=` line
4. **Restart server**: `npm run dev`

## Important

- ✅ Must be **exactly 64 hex characters** (0-9, a-f)
- ✅ Or exactly 32 plain text characters
- ❌ Don't include quotes, spaces, or extra text
- ❌ Don't add the whole command output

## Example `.env`

```bash
# Good ✅
JWE_SECRET_KEY=932f38c5400fed2b5ad8764e9783b0d069620a8c12dadbb46994ac9313d4ad12

# Bad ❌
JWE_SECRET_KEY="932f38c5400fed2b5ad8764e9783b0d069620a8c12dadbb46994ac9313d4ad12"
JWE_SECRET_KEY=JWE_SECRET_KEY=932f38...
TEST_AUTH_TOKEN="..."JWE_SECRET_KEY=932f38...
```

## After Setting the Secret

1. **Restart server**: `npm run dev`
2. **Generate test token**: `npx tsx scripts/generate-test-token.ts`
3. **Test API**: Use the token in curl/Postman

The token will now remain valid across server restarts!
