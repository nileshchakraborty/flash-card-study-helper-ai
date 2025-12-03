# Test Utilities

This directory contains utility scripts for testing and debugging.

## Auth Testing

- **`generate_token.ts`**: Generates a valid JWT token for testing authenticated endpoints
- **`test_auth.ts`**: Tests token encryption/decryption to verify AuthService works correctly

## Usage

### Generate Auth Token

```bash
npx tsx tests/utils/generate_token.ts
```

This will output a JWT token that can be used in API requests:

```bash
curl -H "Authorization: Bearer <token>" http://localhost:3000/graphql
```

### Test Auth Service

```bash
npx tsx tests/utils/test_auth.ts
```

Verifies that token generation and decryption work correctly.

## Notes

- These utilities require `JWE_SECRET_KEY` to be set in `.env`
- Tokens expire after 2 hours (configured in AuthService)
- For production, always use proper OAuth flow instead of manual token generation
