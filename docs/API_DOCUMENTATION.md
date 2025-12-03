# MindFlip AI - Complete API Documentation

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Base URL](#base-url)
4. [Endpoints](#endpoints)
   - [Authentication](#authentication-endpoints)
   - [Flashcard Generation](#flashcard-generation)
   - [Quiz Generation](#quiz-generation)
   - [WebLLM Management](#webllm-management)
   - [File Upload](#file-upload)
   - [Storage & History](#storage--history)
   - [Admin & Monitoring](#admin--monitoring)
   - [GraphQL API](#graphql-api)
5. [WebSocket API](#websocket-api)
6. [Error Handling](#error-handling)
7. [Rate Limiting](#rate-limiting)
8. [Examples](#examples)

## Overview

MindFlip AI Backend provides a RESTful API for AI-powered flashcard generation, quiz creation, and study assistance. The API supports both server-side (Ollama) and client-side (WebLLM via WebSocket) LLM runtimes.

**API Version**: 1.0.0  
**Base URL**: `http://localhost:3000/api`  
**Documentation**: `http://localhost:3000/api-docs` (Swagger UI)

## Authentication

The API uses **JWE (JSON Web Encryption)** tokens for authentication.

### Getting a Token

1. Redirect user to: `GET /api/auth/google`
2. User authenticates with Google
3. Callback redirects with token: `/?token=<jwe_token>`
4. Include token in requests: `Authorization: Bearer <token>`

### Token Format

```
Authorization: Bearer <jwe_token>
```

## Base URL

All endpoints are prefixed with `/api`:

```
http://localhost:3000/api
```

## Endpoints

### Authentication Endpoints

#### `GET /api/auth/google`

Initiate Google OAuth flow.

**Query Parameters**: None  
**Authentication**: Not required  
**Rate Limit**: 5 requests/hour

**Response**: Redirects to Google OAuth

---

#### `GET /api/auth/google/callback`

OAuth callback endpoint.

**Query Parameters**: None  
**Authentication**: Not required  
**Rate Limit**: 5 requests/hour

**Response**: Redirects to `/?token=<jwe_token>`

---

### Flashcard Generation

#### `POST /api/generate`

Generate flashcards for a topic. Returns immediately with a job ID for async processing.

**Authentication**: Required  
**Rate Limit**: 100 requests/15 minutes

**Request Body**:
```json
{
  "topic": "Neural Networks",
  "count": 10,
  "mode": "standard",
  "knowledgeSource": "ai-web",
  "runtime": "ollama",
  "parentTopic": "Machine Learning"
}
```

**Parameters**:
- `topic` (string, required): Topic for flashcard generation
- `count` (number, optional): Number of flashcards (default: 10, max: 50)
- `mode` (string, optional): `"standard"` or `"deep-dive"` (default: "standard")
- `knowledgeSource` (string, optional): `"ai-only"`, `"web-only"`, or `"ai-web"` (default: "ai-web")
- `runtime` (string, optional): `"ollama"` or `"webllm"` (default: "ollama")
- `parentTopic` (string, optional): Parent topic for context

**Response** (200 OK):
```json
{
  "jobId": "job-1234567890",
  "status": "waiting"
}
```

**Response** (200 OK - Cached):
```json
{
  "success": true,
  "cached": true,
  "cards": [...],
  "recommendedTopics": [...]
}
```

---

#### `GET /api/jobs/:id`

Poll job status and retrieve results.

**Authentication**: Required  
**Rate Limit**: 100 requests/15 minutes

**Path Parameters**:
- `id` (string): Job ID from `/api/generate`

**Response** (200 OK - Waiting):
```json
{
  "status": "waiting",
  "jobId": "job-1234567890"
}
```

**Response** (200 OK - Active):
```json
{
  "status": "active",
  "jobId": "job-1234567890",
  "progress": 50
}
```

**Response** (200 OK - Completed):
```json
{
  "status": "completed",
  "jobId": "job-1234567890",
  "result": {
    "cards": [
      {
        "id": "gen-1234567890-0",
        "front": "What is a neural network?",
        "back": "A neural network is a computing system inspired by biological neural networks...",
        "topic": "Neural Networks"
      }
    ],
    "recommendedTopics": ["Deep Learning", "Backpropagation"]
  }
}
```

**Response** (200 OK - Failed):
```json
{
  "status": "failed",
  "jobId": "job-1234567890",
  "error": "Error message"
}
```

---

### Quiz Generation

#### `POST /api/quiz`

Generate quiz questions from provided flashcards.

**Authentication**: Required  
**Rate Limit**: 100 requests/15 minutes

**Request Body**:
```json
{
  "cards": [
    {
      "id": "card-1",
      "front": "What is X?",
      "back": "X is...",
      "topic": "Topic"
    }
  ],
  "count": 5,
  "topic": "General"
}
```

**Response** (200 OK):
```json
{
  "questions": [
    {
      "id": "q1",
      "cardId": "card-1",
      "question": "What is X?",
      "correctAnswer": "X is...",
      "options": ["X is...", "Option 2", "Option 3", "Option 4"]
    }
  ]
}
```

---

#### `POST /api/quiz/generate-advanced`

Generate advanced quiz based on previous results.

**Authentication**: Required  
**Rate Limit**: 100 requests/15 minutes

**Request Body**:
```json
{
  "previousResults": [...],
  "mode": "harder"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "quiz": {
    "questions": [...]
  }
}
```

---

#### `GET /api/quiz/history`

Get quiz history for the authenticated user.

**Authentication**: Required  
**Rate Limit**: 100 requests/15 minutes

**Response** (200 OK):
```json
{
  "history": [
    {
      "id": "quiz-123",
      "topic": "Neural Networks",
      "score": 8,
      "total": 10,
      "timestamp": 1234567890
    }
  ]
}
```

---

#### `POST /api/quiz/history`

Save a quiz result.

**Authentication**: Required  
**Rate Limit**: 100 requests/15 minutes

**Request Body**:
```json
{
  "topic": "Neural Networks",
  "score": 8,
  "total": 10,
  "results": [...]
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "id": "quiz-123"
}
```

---

### WebLLM Management

#### `POST /api/webllm/session`

Create a new WebLLM session for browser-based LLM generation.

**Authentication**: Required  
**Rate Limit**: 100 requests/15 minutes

**Request Body**:
```json
{
  "modelId": "Llama-3-8B-Instruct-q4f16_1-MLC"
}
```

**Response** (200 OK):
```json
{
  "sessionId": "webllm-1234567890-abc123",
  "wsUrl": "ws://localhost:3000/api/webllm/ws?sessionId=webllm-1234567890-abc123",
  "modelId": "Llama-3-8B-Instruct-q4f16_1-MLC",
  "status": "initializing"
}
```

---

#### `GET /api/webllm/session/:id`

Get WebLLM session status.

**Authentication**: Required  
**Rate Limit**: 100 requests/15 minutes

**Path Parameters**:
- `id` (string): Session ID

**Response** (200 OK):
```json
{
  "id": "webllm-1234567890-abc123",
  "modelId": "Llama-3-8B-Instruct-q4f16_1-MLC",
  "status": "ready",
  "createdAt": 1234567890,
  "lastActivity": 1234567890
}
```

**Response** (404 Not Found):
```json
{
  "error": "Session not found"
}
```

---

#### `DELETE /api/webllm/session/:id`

Close a WebLLM session.

**Authentication**: Required  
**Rate Limit**: 100 requests/15 minutes

**Path Parameters**:
- `id` (string): Session ID

**Response** (200 OK):
```json
{
  "success": true
}
```

---

#### `GET /api/webllm/stats`

Get WebLLM service statistics.

**Authentication**: Required  
**Rate Limit**: 100 requests/15 minutes

**Response** (200 OK):
```json
{
  "totalSessions": 5,
  "activeSessions": 2,
  "sessionsByStatus": {
    "ready": 2,
    "generating": 1,
    "initializing": 1,
    "error": 1
  }
}
```

---

### File Upload

#### `POST /api/upload`

Upload a PDF or image file for flashcard generation.

**Authentication**: Required  
**Rate Limit**: 100 requests/15 minutes

**Request**: `multipart/form-data`
- `file` (file, required): PDF or image file
- `topic` (string, optional): Topic for the flashcards

**Response** (200 OK):
```json
{
  "success": true,
  "cards": [
    {
      "id": "gen-123-0",
      "front": "Question",
      "back": "Answer",
      "topic": "Uploaded Topic"
    }
  ]
}
```

---

### Storage & History

#### `POST /api/decks`

Save a flashcard deck.

**Authentication**: Required  
**Rate Limit**: 100 requests/15 minutes

**Request Body**:
```json
{
  "topic": "Neural Networks",
  "cards": [...],
  "timestamp": 1234567890
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "id": "deck-1234567890"
}
```

---

#### `GET /api/decks`

Get deck history.

**Authentication**: Required  
**Rate Limit**: 100 requests/15 minutes

**Response** (200 OK):
```json
{
  "history": [
    {
      "id": "deck-123",
      "topic": "Neural Networks",
      "cards": [...],
      "timestamp": 1234567890
    }
  ]
}
```

---

### Admin & Monitoring

#### `GET /api/health`

Health check endpoint.

**Authentication**: Not required  
**Rate Limit**: None

**Response** (200 OK):
```json
{
  "ollama": true,
  "serper": true,
  "webllm": true
}
```

---

#### `GET /api/queue/stats`

Get queue statistics.

**Authentication**: Required  
**Rate Limit**: 100 requests/15 minutes

**Response** (200 OK):
```json
{
  "waiting": 2,
  "active": 1,
  "completed": 150,
  "failed": 3,
  "delayed": 0
}
```

---

---

## GraphQL API

The application now supports a modern GraphQL API alongside REST.

**Endpoint**: `/graphql`  
**Documentation**: [docs/graphql-api.md](graphql-api.md)

### Key Features
- **Hybrid Mode**: Automatic fallback to REST API if GraphQL fails
- **Full Authentication**: JWT-based auth for protected operations
- **Efficient Queries**: Request only the data you need
- **Batching Support**: Multiple operations in single request
- **Subscriptions**: Real-time updates (via polling or WebSocket)

### Example Query

```graphql
query {
  health
  decks {
    id
    topic
    cards {
      front
      back
    }
  }
}
```

For full documentation, schema details, and examples, please refer to the [GraphQL API Documentation](graphql-api.md).

---

## WebSocket API

### Connection

Connect to WebLLM WebSocket endpoint:

```
ws://localhost:3000/api/webllm/ws?sessionId=<sessionId>
```

**Query Parameters**:
- `sessionId` (required): Session ID from `POST /api/webllm/session`

### Message Format

#### Client → Server

**Generate Request**:
```json
{
  "type": "generate",
  "prompt": "Generate flashcards about Neural Networks",
  "options": {
    "count": 10,
    "topic": "Neural Networks"
  }
}
```

**Response (Client → Server)**:
```json
{
  "type": "response",
  "cacheKey": "webllm:flashcards:Neural Networks:10",
  "data": {
    "cards": [...]
  }
}
```

#### Server → Client

**Progress Update**:
```json
{
  "type": "progress",
  "progress": 50,
  "message": "Generating flashcards with WebLLM..."
}
```

**Result**:
```json
{
  "type": "result",
  "data": {
    "cards": [...],
    "cached": false
  }
}
```

**Error**:
```json
{
  "type": "error",
  "error": "Error message"
}
```

### Generation Types

1. **flashcards**: Generate flashcards from topic
2. **summary**: Generate topic summary
3. **search-query**: Generate search query
4. **quiz**: Generate quiz from flashcards

---

## Error Handling

All errors follow this format:

```json
{
  "error": "Error message"
}
```

### HTTP Status Codes

- `200 OK`: Success
- `202 Accepted`: Job queued (async processing)
- `400 Bad Request`: Invalid request parameters
- `401 Unauthorized`: Missing or invalid authentication token
- `404 Not Found`: Resource not found
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error

---

## Rate Limiting

- **API Endpoints**: 100 requests per 15 minutes per IP
- **Auth Endpoints**: 5 requests per hour per IP

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1234567890
```

---

## Examples

### Complete Flashcard Generation Flow

```javascript
// 1. Authenticate (redirect to OAuth, get token from callback)
const token = 'your-jwe-token';

// 2. Generate flashcards
const response = await fetch('http://localhost:3000/api/generate', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    topic: 'Neural Networks',
    count: 10,
    mode: 'standard',
    knowledgeSource: 'ai-web',
    runtime: 'ollama'
  })
});

const { jobId } = await response.json();

// 3. Poll for results
let result;
do {
  await new Promise(resolve => setTimeout(resolve, 1000));
  const statusResponse = await fetch(`http://localhost:3000/api/jobs/${jobId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  result = await statusResponse.json();
} while (result.status === 'waiting' || result.status === 'active');

// 4. Use results
if (result.status === 'completed') {
  console.log('Flashcards:', result.result.cards);
}
```

### WebLLM Integration

```javascript
// 1. Create session
const sessionResponse = await fetch('http://localhost:3000/api/webllm/session', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    modelId: 'Llama-3-8B-Instruct-q4f16_1-MLC'
  })
});

const { sessionId, wsUrl } = await sessionResponse.json();

// 2. Connect WebSocket
const ws = new WebSocket(wsUrl);

ws.onopen = () => {
  console.log('WebSocket connected');
  
  // 3. Send generation request
  ws.send(JSON.stringify({
    type: 'generate',
    prompt: 'Generate flashcards about Neural Networks',
    options: {
      count: 10,
      topic: 'Neural Networks'
    }
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  if (message.type === 'progress') {
    console.log('Progress:', message.progress, message.message);
  } else if (message.type === 'result') {
    console.log('Result:', message.data);
    
    // Send results back to server for caching
    ws.send(JSON.stringify({
      type: 'response',
      cacheKey: 'webllm:flashcards:Neural Networks:10',
      data: message.data
    }));
  } else if (message.type === 'error') {
    console.error('Error:', message.error);
  }
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onclose = () => {
  console.log('WebSocket closed');
};
```

---

## Additional Resources

- **Swagger UI**: `http://localhost:3000/api-docs`
- **Backend README**: [BACKEND_README.md](../BACKEND_README.md)
- **GitHub Wiki**: See `docs/wiki/` directory

