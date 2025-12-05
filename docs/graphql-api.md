# GraphQL API Documentation

## Overview

The flashcard study helper now supports both REST and GraphQL APIs. The GraphQL API provides a modern, flexible alternative with features like batching, type safety, and efficient data fetching.

**📚 [View Query Examples](graphql-examples.md)** - Practical examples for all operations

## Quick Start

### Enable GraphQL Mode

```javascript
localStorage.setItem('USE_GRAPHQL', 'true');
location.reload();
```

### Endpoint

```
POST /graphql
```

### Authentication

All mutations requiring user data need authentication via JWT token:

```javascript
fetch('/graphql', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_JWT_TOKEN',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ query: '...' })
});
```

---

## Schema Overview

### Types

**Deck**
```graphql
type Deck {
  id: ID!
  topic: String!
  cards: [Flashcard!]!
  timestamp: DateTime!
}
```

**Flashcard**
```graphql
type Flashcard {
  id: ID!
  front: String!
  back: String!
  topic: String!
}
```

**Quiz**
```graphql
type Quiz {
  id: ID!
  topic: String!
  questions: [QuizQuestion!]!
  mode: String
  createdAt: DateTime!
}
```

**Job**
```graphql
type Job {
  id: ID!
  status: String!
  result: JSON
  error: String
  progress: Int
}
```

---

## Queries

### Health Check

```graphql
query {
  health
}
```

### Get All Decks

```graphql
query {
  decks {
    id
    topic
    cards {
      id
      front
      back
    }
    timestamp
  }
}
```

### Get Specific Deck

```graphql
query GetDeck($id: ID!) {
  deck(id: $id) {
    id
    topic
    cards {
      front
      back
    }
  }
}
```

### Get Quiz History

```graphql
query {
  quizHistory {
    quizId
    score
    total
    timestamp
  }
}
```

### Get Job Status

```graphql
query GetJob($id: ID!) {
  job(id: $id) {
    id
    status
    result
    progress
  }
}
```

---

## Mutations

### Create Deck

```graphql
mutation CreateDeck($input: DeckInput!) {
  createDeck(input: $input) {
    id
    topic
    cards {
      id
      front
      back
    }
  }
}
```

**Variables:**
```json
{
  "input": {
    "topic": "JavaScript Basics",
    "cards": [
      { "front": "What is a closure?", "back": "A function with access to outer scope" }
    ]
  }
}
```

### Generate Flashcards

**⚠️ Requires Authentication**

```graphql
mutation GenerateFlashcards($input: GenerateInput!) {
  generateFlashcards(input: $input) {
    cards {
      front
      back
    }
    jobId
    recommendedTopics
  }
}
```

**Variables:**
```json
{
  "input": {
    "topic": "React Hooks",
    "count": 10,
    "mode": "standard",
    "knowledgeSource": "ai-web"
  }
}
```

**Modes:**
- `standard`: Basic flashcards
- `deep-dive`: Advanced, interconnected flashcards

**Knowledge Sources:**
- `ai-only`: Use AI without web search
- `web-only`: Web search only
- `ai-web`: Combined AI + web (recommended)

### Create Quiz

```graphql
mutation CreateQuiz($input: QuizInput!) {
  createQuiz(input: $input) {
    id
    topic
    questions {
      id
      question
      options
      correctAnswer
    }
  }
}
```

### Submit Quiz Answers

```graphql
mutation SubmitQuiz($quizId: ID!, $answers: [QuizAnswerInput!]!) {
  submitQuizAnswer(quizId: $quizId, answers: $answers) {
    quizId
    score
    total
    timestamp
  }
}
```

**Variables:**
```json
{
  "quizId": "quiz-123",
  "answers": [
    { "questionId": "q1", "answer": "A" },
    { "questionId": "q2", "answer": "B" }
  ]
}
```

---

## Async Operations with Jobs

When generating flashcards, the API may return a `jobId` for async processing:

```graphql
mutation {
  generateFlashcards(input: { topic: "ML", count: 20 }) {
    jobId  # If present, poll this
    cards  # May be empty if async
  }
}
```

**Poll for results:**

```graphql
query CheckJob {
  job(id: "job-abc") {
    status  # "pending", "processing", "completed", "failed"
    progress  # 0-100
    result {
      cards {
        front
        back
      }
    }
  }
}
```

---

## Subscriptions (Real-time Updates)

The API supports real-time updates for long-running operations like flashcard generation.

### Backend Support

The backend is fully configured for WebSocket subscriptions:

```graphql
type Subscription {
  jobUpdated(jobId: ID!): Job!
}
```

### Usage (Current Strategy)

While the backend supports WebSockets, the frontend currently uses **polling** for simplicity and reliability across all environments.

**Polling Pattern:**
1. Mutation returns `jobId`
2. Client polls `job(id: "...")` query every 2 seconds
3. Stop polling when `status` is `COMPLETED` or `FAILED`

**Future WebSocket Usage:**
Once WebSocket integration is enabled on the client:

```graphql
subscription OnJobUpdate($jobId: ID!) {
  jobUpdated(jobId: $jobId) {
    id
    status
    progress
    result
  }
}
```

---

## Error Handling

GraphQL returns errors in a standard format:

```json
{
  "errors": [
    {
      "message": "Authentication required",
      "locations": [{ "line": 2, "column": 3 }],
      "path": ["generateFlashcards"]
    }
  ],
  "data": null
}
```

**Common Errors:**
- `Authentication required`: Missing or invalid JWT token
- `Invalid token`: Expired or malformed token
- `Deck not found`: Invalid deck ID

---

## Feature Flag System

The frontend uses a hybrid approach with automatic fallback:

```typescript
// In apiService
async generateFlashcards(params) {
  if (this.useGraphQL) {
    try {
      return await graphqlService.generateFlashcards(params);
    } catch (error) {
      console.warn('GraphQL failed, falling back to REST');
      return this.post('/generate', params);
    }
  }
  return this.post('/generate', params);
}
```

**Benefits:**
- Graceful degradation
- Zero-downtime migration
- A/B testing capability

---

## Interactive GraphQL Interface

In development mode, access the **Apollo Sandbox** (interactive GraphQL client) at:

```
http://localhost:3000/graphql
```

Apollo Sandbox is the modern replacement for GraphQL Playground, offering:
- Schema exploration
- Query and mutation testing
- Real-time syntax validation
- Auto-completion
- Documentation browser

*Note: The interactive interface is available in both development and production, but production uses a less embedded version for security.*

---

## Best Practices

1. **Use Fragments** for reusable fields:
```graphql
fragment CardFields on Flashcard {
  id
  front
  back
}

query {
  decks {
    cards {
      ...CardFields
    }
  }
}
```

2. **Request only needed fields** to minimize payload
3. **Use variables** instead of string interpolation
4. **Batch related queries** in a single request
5. **Handle errors** properly (check both `data` and `errors`)

---

## Migration Guide

See `implementation_plan.md` for the full migration strategy.

For issues or questions, check `auth_debugging_findings.md` for common authentication problems and solutions.


Note: Backend now validates/repairs generated flashcards and will honor preferredRuntime (Ollama/WebLLM) with fallback.