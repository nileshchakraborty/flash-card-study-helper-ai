# Backend API Documentation

## Overview

The Flash Card Study Helper API is a RESTful service built with Express.js following Clean Architecture principles. It provides endpoints for flashcard generation, quiz creation, file processing, and authentication.

**Base URL**: `http://localhost:3000/api`

## Authentication

### OAuth 2.0 (Google)

The API uses Google OAuth 2.0 for user authentication and JWE (JSON Web Encryption) for secure token management.

#### Initiate OAuth Flow
```http
GET /api/auth/google
```

Redirects user to Google OAuth consent screen.

#### OAuth Callback
```http
GET /api/auth/google/callback
```

**Response**: Redirects to `/?token={jwe_token}`

### Using Authentication Token

Include the JWT token in the `Authorization` header for protected endpoints:

```http
Authorization: Bearer <your_jwe_token>
```

## Flashcard Generation

### Generate Flashcards (Async)

Queue a flashcard generation job.

```http
POST /api/generate
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body**:
```json
{
  "topic": "JavaScript Async/Await",
  "count": 10,
  "mode": "standard",
  "knowledgeSource": "ai-web",
  "runtime": "ollama"
}
```

**Parameters**:
- `topic` (string, required): Topic for flashcard generation
- `count` (number, optional, default: 10): Number of cards to generate
- `mode` (string, optional, default: "standard"): Generation mode ("standard" or "deep-dive")
- `knowledgeSource` (string, optional, default: "ai-web"): Source ("ai-only", "web-only", "ai-web")
- `runtime` (string, optional, default: "ollama"): AI runtime ("ollama" or "webllm")

**Response** (202 Accepted):
```json
{
  "success": true,
  "jobId": "job-uuid",
  "message": "Job queued for processing",
  "statusUrl": "/api/jobs/job-uuid"
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

### Check Job Status

Poll the status of a queued flashcard generation job.

```http
GET /api/jobs/:id
Authorization: Bearer <token>
```

**Response** (Job Pending):
```json
{
  "id": "job-uuid",
  "status": "waiting",
  "progress": 0
}
```

**Response** (Job Complete):
```json
{
  "id": "job-uuid",
  "status": "completed",
  "result": {
    "cards": [
      {
        "id": "card-1",
        "front": "What is async/await?",
        "back": "A syntax for handling asynchronous operations...",
        "topic": "JavaScript Async/Await"
      }
    ],
    "recommendedTopics": ["Promises", "Event Loop"]
  }
}
```

### Upload File for Processing

Process PDF or image files to generate flashcards.

```http
POST /api/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Form Data**:
- `file` (file, required): PDF or image file
- `topic` (string, optional, default: "General"): Topic for context

**Response**:
```json
{
  "success": true,
  "cards": [...]
}
```

## Quiz System

### Generate Quiz from Flashcards

```http
POST /api/quiz
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body**:
```json
{
  "cards": [...],
  "topic": "JavaScript"
}
```

**Response**:
```json
{
  "questions": [
    {
      "id": "q1",
      "cardId": "card-1",
      "question": "What is async/await?",
      "correctAnswer": "A syntax for handling...",
      "options": ["..."]
    }
  ]
}
```

### Generate Advanced Quiz

Generate a harder or remedial quiz based on previous results. **Phase 5** enhancement includes web context integration for "harder" mode.

```http
POST /api/quiz/generate-advanced
Content-Type: application/json
```

**Request Body**:
```json
{
  "previousResults": {
    "topic": "JavaScript",
    "questions": [...],
    "userAnswers": [...],
    "correctAnswers": [...]
  },
  "mode": "harder"
}
```

**Parameters**:
- `previousResults` (object, required): Previous quiz data
- `mode` (string, required): "harder" or "remedial"

**Response**:
```json
{
  "success": true,
  "quiz": [
    {
      "id": "q1",
      "question": "Advanced question with web context...",
      "options": [...],
      "correctAnswer": "..."
    }
  ]
}
```

**Note**: In "harder" mode, the system performs cache-first web search to enhance questions with real-world context.

### Quiz History

#### Get Quiz History
```http
GET /api/quiz/history
```

#### Save Quiz Result
```http
POST /api/quiz/history
Content-Type: application/json
```

**Request Body**:
```json
{
  "score": 8,
  "totalQuestions": 10,
  "topic": "JavaScript",
  "timestamp": 1700000000000
}
```

## Deck Management

### Get Deck History
```http
GET /api/decks
```

**Response**:
```json
{
  "history": [
    {
      "id": "deck-123",
      "topic": "JavaScript",
      "cards": [...],
      "timestamp": 1700000000000
    }
  ]
}
```

### Save Deck
```http
POST /api/decks
Content-Type: application/json
```

**Request Body**:
```json
{
  "topic": "JavaScript",
  "cards": [...]
}
```

## Recommendations System (Phase 5)

### Get Recommendations for Topic

Retrieve AI-generated quiz topics and learning paths related to a subject.

```http
GET /api/recommendations/:topic
```

**Response (Pending)**:
```json
{
  "success": true,
  "topic": "JavaScript",
  "recommendedQuizzes": [],
  "recommendedLearning": [],
  "pending": true
}
```

**Response (Ready)**:
```json
{
  "success": true,
  "topic": "JavaScript",
  "recommendedQuizzes": [
    "JavaScript Closures Deep Dive",
    "Async/Await Patterns",
    "ES6 Features"
  ],
  "recommendedLearning": [
    "Advanced Functions",
    "Promises and Async Programming",
    "Modern JavaScript Ecosystem"
  ]
}
```

### Refresh Recommendations

Trigger fresh generation of recommendations for a topic.

```http
POST /api/recommendations/refresh/:topic
```

**Response**:
```json
{
  "success": true,
  "message": "Recommendation generation triggered"
}
```

**Note**: Recommendations are generated asynchronously in the background. Poll the GET endpoint to retrieve results.

## Client-Side AI Support

### Web Search
```http
POST /api/search
Content-Type: application/json
```

**Request Body**:
```json
{
  "query": "JavaScript async await"
}
```

### Web Scraping
```http
POST /api/scrape
Content-Type: application/json
```

**Request Body**:
```json
{
  "urls": ["https://example.com/article1"]
}
```

## Monitoring

### Health Check
```http
GET /api/health
```

**Response**:
```json
{
  "ollama": true,
  "serper": true
}
```

### Queue Statistics
```http
GET /api/queue/stats
Authorization: Bearer <token>
```

**Response**:
```json
{
  "waiting": 5,
  "active": 2,
  "completed": 150,
  "failed": 3,
  "delayed": 0
}
```

## Rate Limits

| Endpoint Type | Limit |
|--------------|-------|
| API Endpoints | 100 requests / 15 minutes |
| Auth Endpoints | 5 requests / hour |

**Response** (429 Too Many Requests):
```json
{
  "error": "Too many requests"
}
```

## Error Responses

### 401 Unauthorized
```json
{
  "error": "No token provided"
}
```

### 500 Internal Server Error
```json
{
  "error": "Detailed error message"
}
```

## Interactive Documentation

For complete API exploration and testing:

**Swagger UI**: `http://localhost:3000/api-docs`

---

*For more details, see the [Getting Started](Getting-Started.md) guide.*


**Latest updates:** Runtime preference (Ollama/WebLLM) with automatic fallback and flashcard output validation/repair to guarantee correct JSON and requested counts.

**Latest:** Runtime preference (Ollama/WebLLM) with automatic fallback; flashcard validation/repair ensures correct JSON and requested counts; client-side generation will fall back to backend if underfilled.