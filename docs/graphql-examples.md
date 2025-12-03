# GraphQL Query Examples

This document provides practical examples for using the GraphQL API.

## Table of Contents

- [Health Check](#health-check)
- [Deck Operations](#deck-operations)
- [Flashcard Generation](#flashcard-generation)
- [Quiz Operations](#quiz-operations)
- [Job Polling](#job-polling)

---

## Health Check

### Simple Health Check

```graphql
query {
  health
}
```

**Response:**
```json
{
  "data": {
    "health": {
      "status": "ok",
      "timestamp": "2025-12-02T23:17:00.000Z",
      "service": "graphql"
    }
  }
}
```

---

## Deck Operations

### Get All Decks

```graphql
query GetAllDecks {
  decks {
    id
    topic
    timestamp
    cards {
      id
      front
      back
      topic
    }
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

**Variables:**
```json
{
  "id": "deck-1733185020000"
}
```

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
      {
        "front": "What is a closure?",
        "back": "A function that has access to variables in its outer scope"
      },
      {
        "front": "What is hoisting?",
        "back": "JavaScript's behavior of moving declarations to the top of scope"
      }
    ]
  }
}
```

---

## Flashcard Generation

### Generate Flashcards (Authenticated)

**Important:** This mutation requires authentication via JWT token in the `Authorization` header.

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

**Variables (Standard Mode):**
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

**Variables (Deep Dive Mode):**
```json
{
  "input": {
    "topic": "Machine Learning",
    "count": 15,
    "mode": "deep-dive",
    "knowledgeSource": "ai-web"
  }
}
```

**Response (Async):**
```json
{
  "data": {
    "generateFlashcards": {
      "cards": null,
      "jobId": "job-1733185020000",
      "recommendedTopics": []
    }
  }
}
```

**Response (Sync/Cached):**
```json
{
  "data": {
    "generateFlashcards": {
      "cards": [
        {
          "front": "What is useState?",
          "back": "A React Hook that lets you add state to functional components"
        }
      ],
      "jobId": null,
      "recommendedTopics": ["React Context", "useEffect", "Custom Hooks"]
    }
  }
}
```

---

## Quiz Operations

### Get Quiz History

```graphql
query GetQuizHistory {
  quizHistory {
    quizId
    score
    total
    timestamp
  }
}
```

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

**Variables:**
```json
{
  "input": {
    "topic": "JavaScript",
    "source": "topic",
    "count": 5
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
  "quizId": "quiz-1733185020000",
  "answers": [
    { "questionId": "q1", "answer": "A" },
    { "questionId": "q2", "answer": "B" },
    { "questionId": "q3", "answer": "C" }
  ]
}
```

---

## Job Polling

### Check Job Status

Use this query to poll for the status of async operations (like flashcard generation).

```graphql
query GetJobStatus($id: ID!) {
  job(id: $id) {
    id
    status
    progress
    result
    error
  }
}
```

**Variables:**
```json
{
  "id": "job-1733185020000"
}
```

**Response (Pending):**
```json
{
  "data": {
    "job": {
      "id": "job-1733185020000",
      "status": "WAITING",
      "progress": 0,
      "result": null,
      "error": null
    }
  }
}
```

**Response (Processing):**
```json
{
  "data": {
    "job": {
      "id": "job-1733185020000",
      "status": "ACTIVE",
      "progress": 50,
      "result": null,
      "error": null
    }
  }
}
```

**Response (Completed):**
```json
{
  "data": {
    "job": {
      "id": "job-1733185020000",
      "status": "COMPLETED",
      "progress": 100,
      "result": {
        "cards": [
          {
            "front": "Question",
            "back": "Answer"
          }
        ],
        "recommendedTopics": ["Topic 1", "Topic 2"]
      },
      "error": null
    }
  }
}
```

---

## Combined Operations

### Generate and Poll for Results

**Step 1:** Generate flashcards (returns jobId)

```graphql
mutation {
  generateFlashcards(input: {
    topic: "Python"
    count: 5
    mode: "standard"
  }) {
    jobId
    cards
  }
}
```

**Step 2:** Poll for results every 2 seconds

```graphql
query {
  job(id: "job-1733185020000") {
    status
    progress
    result
  }
}
```

**Step 3:** When status is COMPLETED, save the deck

```graphql
mutation {
  createDeck(input: {
    topic: "Python"
    cards: [
      { front: "What is a list?", back: "A mutable sequence..." }
    ]
  }) {
    id
    topic
  }
}
```

---

## Error Handling

### Authentication Error

```json
{
  "errors": [
    {
      "message": "Authentication required",
      "extensions": {
        "code": "UNAUTHENTICATED"
      }
    }
  ],
  "data": null
}
```

### Validation Error

```json
{
  "errors": [
    {
      "message": "Variable \"$input\" got invalid value...",
      "extensions": {
        "code": "BAD_USER_INPUT"
      }
    }
  ],
  "data": null
}
```

---

## Tips

1. **Use Variables:** Always use variables instead of inline values for better reusability
2. **Request Only What You Need:** GraphQL lets you specify exactly which fields you want
3. **Handle Errors:** Always check the `errors` array in the response
4. **Poll Wisely:** Wait 2 seconds between job status polls to avoid rate limiting
5. **Authenticate:** Include JWT token in `Authorization: Bearer <token>` header for protected operations

---

## Testing with Apollo Sandbox

1. Navigate to `http://localhost:3000/graphql`
2. Use the "Headers" section to add authentication:
   ```json
   {
     "Authorization": "Bearer YOUR_JWT_TOKEN"
   }
   ```
3. Copy any example query from above
4. Click "Run" to execute
5. View the response in the right panel

---

## Additional Resources

- [GraphQL API Documentation](graphql-api.md)
- [Backend README](../BACKEND_README.md)
- [API Documentation](API_DOCUMENTATION.md)


Note: Backend now validates/repairs generated flashcards and will honor preferredRuntime (Ollama/WebLLM) with fallback.