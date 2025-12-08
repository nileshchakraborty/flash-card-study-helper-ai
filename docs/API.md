# API Contract Documentation

**Version**: 2.0  
**Base URL**: `http://localhost:3000` (dev) | `https://mindflipai.vercel.app` (prod)  
**Last Updated**: 2025-12-06

## Table of Contents

1. [Authentication](#authentication)
2. [Flashcard Generation](#flashcard-generation)
3.  [Deck Management](#deck-management)
4. [Quiz](#quiz)
5. [Jobs & Queue](#jobs--queue)
6. [GraphQL](#graphql)
7. [Error Handling](#error-handling)

---

## Authentication

### Login (OAuth)

```http
GET /auth/google
```

**Response**: Redirects to Google OAuth

**Callback**:
```http
GET /auth/google/callback?code=...
```

**Returns**: Redirects to `/` with auth cookie

### Get Current User

```http
GET /api/user
Headers:
  Authorization: Bearer <token>
```

**Response** (200):
```json
{
  "id": "user-123",
  "email": "user@example.com",
  "name": "John Doe"
}
```

---

## Flashcard Generation

###  Generate Flashcards (Async)

```http
POST /api/generate
Headers:
  Authorization: Bearer <token>
  Content-Type: application/json
Body:
{
  "topic": "Machine Learning",
  "count": 10,
  "mode": "standard" | "deep-dive"
}
```

**Response** (202 Accepted):
```json
{
  "success": true,
  "jobId": "77",
  "message": "Job queued for processing",
  "statusUrl": "/api/jobs/77"
}
```

**Error** (401):
```json
{
  "error": "No authorization header"
}
```

**Error** (400):
```json
{
  "error": "Invalid request: topic is required"
}
```

---

## Jobs & Queue

### Get Job Status

```http
GET /api/jobs/:id
Headers:
  Authorization: Bearer <token>
```

**Response** (200) - Processing:
```json
{
  "status": "active",
  "progress": 50,
  "result": null
}
```

**Response** (200) - Completed:
```json
{
  "status": "completed",
  "progress": 100,
  "result": {
    "cards": [
      {
        "id": "card-1",
        "front": "What is Machine Learning?",
        "back": "A subset of AI focused on...",
        "topic": "Machine Learning"
      }
    ]
  }
}
```

**Response** (200) - Failed:
```json
{
  "status": "failed",
  "progress": 0,
  "error": "Failed to communicate with AI service"
}
```

### Get Queue Statistics

```http
GET /api/queue/stats
Headers:
  Authorization: Bearer <token>
```

**Response** (200):
```json
{
  "waiting": 2,
  "active": 1,
  "completed": 45,
  "failed": 3,
  "delayed": 0
}
```

---

## Deck Management

### List Decks

```http
GET /api/decks
Headers:
  Authorization: Bearer <token>
```

**Response** (200):
```json
{
  "history": [
    {
      "id": "deck-123",
      "name": "React Basics",
      "topic": "React",
      "cardCount": 12,
      "createdAt": "2025-12-06T12:00:00Z"
    }
  ]
}
```

### Save Deck

```http
POST /api/decks
Headers:
  Authorization: Bearer <token>
  Content-Type: application/json
Body:
{
  "name": "My Study Deck",
  "topic": "TypeScript",
  "cards": [
    {
      "id": "1",
      "front": "What is TypeScript?",
      "back": "A superset of JavaScript",
      "topic": "TypeScript"
    }
  ]
}
```

**Response** (200):
```json
{
  "success": true,
  "id": "deck-456"
}
```

### Get Single Deck

```http
GET /api/decks/:id
Headers:
  Authorization: Bearer <token>
```

**Response** (200):
```json
{
  "id": "deck-123",
  "name": "React Basics",
  "topic": "React",
  "cards": [...],
  "createdAt": "2025-12-06T12:00:00Z"
}
```

### Delete Deck

```http
DELETE /api/decks/:id
Headers:
  Authorization: Bearer <token>
```

**Response** (200):
```json
{
  "success": true
}
```

---

## Quiz

### Generate Quiz

```http
POST /api/quiz
Headers:
  Authorization: Bearer <token>
  Content-Type: application/json
Body:
{
  "topic": "JavaScript",
  "questionCount": 5
}
```

**Response** (200):
```json
{
  "id": "quiz-789",
  "questions": [
    {
      "id": "q1",
      "question": "What is a closure?",
      "options": [
        "A function inside another function",
        "A loop construct",
        "A variable type",
        "An object method"
      ],
      "correctAnswer": 0
    }
  ]
}
```

### Submit Quiz

```http
POST /api/quiz/:id/submit
Headers:
  Authorization: Bearer <token>
  Content-Type: application/json
Body:
{
  "answers": [0, 2, 1, 3, 0]
}
```

**Response** (200):
```json
{
  "score": 4,
  "total": 5,
  "percentage": 80,
  "results": [
    { "questionId": "q1", "correct": true },
    { "questionId": "q2", "correct": false }
  ]
}
```

---

## GraphQL

### Endpoint

```
POST /graphql
Headers:
  Authorization: Bearer <token>
  Content-Type: application/json
```

### Schema

```graphql
type Query {
  decks: [Deck!]!
  deck(id: ID!): Deck
  user: User
}

type Mutation {
  saveDeck(input: DeckInput!): Deck!
  deleteDeck(id: ID!): Boolean!
}

type Deck {
  id: ID!
  name: String!
  topic: String!
  cards: [Flashcard!]!
  createdAt: DateTime!
}

type Flashcard {
  id: ID!
  front: String!
  back: String!
  topic: String!
}

type User {
  id: ID!
  email: String!
  name: String!
}
```

### Example Query

```graphql
query GetDecks {
  decks {
    id
    name
    topic
    cardCount
    createdAt
  }
}
```

**Response**:
```json
{
  "data": {
    "decks": [
      {
        "id": "deck-123",
        "name": "React Basics",
        "topic": "React",
        "cardCount": 12,
        "createdAt": "2025-12-06T12:00:00Z"
      }
    ]
  }
}
```

---

## Health & Metrics

### Health Check

```http
GET /api/health
```

**Response** (200):
```json
{
  "ollama": true,
  "serper": true
}
```

### System Status

```http
GET /
```

**Response** (200): HTML page

---

## Error Handling

### Standard Error Response

```json
{
  "error": "Description of what went wrong",
  "code": "ERROR_CODE",
  "details": {...}
}
```

### HTTP Status Codes

| Code | Meaning | Example |
|------|---------|---------|
| 200 | Success | Data retrieved |
| 201 | Created | Resource created |
| 202 | Accepted | Job queued |
| 400 | Bad Request | Invalid input |
| 401 | Unauthorized | Missing/invalid token |
| 404 | Not Found | Resource doesn't exist |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Server Error | Internal error |

### Error Examples

**401 Unauthorized**:
```json
{
  "error": "No authorization header"
}
```

**400 Bad Request**:
```json
{
  "error": "Invalid request",
  "details": {
    "topic": "Topic is required",
    "count": "Must be between 1 and 20"
  }
}
```

**429 Rate Limit**:
```json
{
  "error": "Too many requests, please try again later"
}
```

**500 Server Error**:
```json
{
  "error": "Failed to communicate with AI service"
}
```

---

## Rate Limiting

**Limits** (per IP):
- Generation: 10 requests / 15 minutes
- Quiz: 20 requests / 15 minutes
- Other endpoints: 100 requests / 15 minutes

**Headers**:
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1733520000
```

---

## Authentication Details

### JWT Token Structure

```json
{
  "id": "user-123",
  "email": "user@example.com",
  "name": "John Doe",
  "iat": 1733500000,
  "exp": 1733507200
}
```

- **Encryption**: JWE (A256GCM)
- **Expiration**: 2 hours
- **Header**: `Authorization: Bearer <token>`

### Getting a Token (Development)

```bash
# Generate test token
npx tsx scripts/generate-test-token.ts

# Use in API calls
curl -H "Authorization: Bearer <token>" \
  http://localhost:3000/api/decks
```

---

## Polling Pattern

For async operations (flashcard generation):

```typescript
async function waitForJob(jobId: string): Promise<any> {
  const maxAttempts = 60; //  60 seconds
  let attempts = 0;

  while (attempts < maxAttempts) {
    const response = await fetch(`/api/jobs/${jobId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = await response.json();
    
    if (data.status === 'completed') {
      return data.result;
    }
    
    if (data.status === 'failed') {
      throw new Error(data.error);
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    attempts++;
  }
  
  throw new Error('Job timeout');
}
```

---

## CORS Configuration

**Allowed Origins**:
- `http://localhost:*`
- `https://mindflipai.vercel.app`

**Allowed Methods**: GET, POST, PUT, DELETE, OPTIONS

**Allowed Headers**: Authorization, Content-Type

---

## WebSocket (Future)

### GraphQL Subscriptions

```
ws://localhost:3000/subscriptions
```

**Example**:
```graphql
subscription OnJobComplete {
  jobCompleted(jobId: "77") {
    status
    result
  }
}
```

---

## Changelog

### v2.0 (2025-12-06)
- ✅ MCP-first architecture
- ✅ Async flashcard generation with job queue
- ✅ JWE token authentication
- ✅ GraphQL support
- ✅ Rate limiting

### v1.0 (Previous)
- REST API only
- Synchronous generation
- Basic OAuth

---

## Testing

### cURL Examples

```bash
# Generate flashcards
curl -X POST http://localhost:3000/api/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"topic":"React","count":5}'

# Check job status
curl http://localhost:3000/api/jobs/77 \
  -H "Authorization: Bearer $TOKEN"

# List decks
curl http://localhost:3000/api/decks \
  -H "Authorization: Bearer $TOKEN"
```

### Postman Collection

Available at: `/docs/postman_collection.json` (to be created)

---

## Support

- **Documentation**: `/docs/`
- **Issues**: GitHub Issues
- **API Status**: `/api/health`
