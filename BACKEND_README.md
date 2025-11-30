# MindFlip AI - Backend API

**A production-ready, self-contained API for AI-powered flashcard generation with REST and GraphQL support.**

This backend service provides a complete, independent API that can be integrated into any frontend application. It implements Clean Architecture principles with robust error handling, caching, queuing, and resilience patterns.

## 🎯 Overview

MindFlip AI Backend supports both **REST** and **GraphQL** APIs, providing:
- **LLM Integration**: Ollama (server-side) and WebLLM (browser-based via WebSocket)
- **Web Search**: Serper.dev integration for real-time knowledge retrieval
- **File Processing**: PDF and image (OCR) support
- **Quiz Generation**: AI-powered quiz creation from flashcards

## 🚀 Quick Start

### Prerequisites

- **Node.js** ≥ 18.0.0
- **Redis** (for queue management) - Optional but recommended
- **Ollama** (optional, for local LLM) - Default model: `llama3.2:latest`

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd flash-card-study-helper-ai

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your configuration
```

### Environment Configuration

Create a `.env` file with the following variables:

```bash
# Server Configuration
PORT=3000
NODE_ENV=production

# Google OAuth (Required for authentication)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# JWE Token Encryption (Required)
JWE_SECRET_KEY=your_32_character_secret_key_here

# Serper API (Required for web search)
SERPER_API_KEY=your_serper_api_key

# Ollama Configuration (Optional)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:latest

# Redis Configuration (Optional, for queue)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# MCP Server (Optional, feature flag)
USE_MCP_SERVER=false

# Cache Configuration
CACHE_SERPER_TTL_SECONDS=3600
CACHE_LLM_TTL_SECONDS=86400
CACHE_SERPER_MAX_ENTRIES=100
CACHE_LLM_MAX_ENTRIES=500
```

### Running the Service

```bash
# Development mode (with hot reload)
npm run dev

# Production mode
npm run build
npm start

# Or using the serve command
npm run serve
```

The API will be available at:
- **REST API Base**: `http://localhost:3000/api`
- **GraphQL API**: `http://localhost:3000/graphql`
- **Swagger UI**: `http://localhost:3000/api-docs`
- **Health Check**: `http://localhost:3000/api/health`

## 📚 API Documentation

### Interactive Documentation

Full interactive API documentation is available via Swagger UI:
- **URL**: `http://localhost:3000/api-docs`
- **OpenAPI Spec**: `swagger.yaml`

### Core Endpoints

#### Authentication

```http
GET  /api/auth/google              # Initiate Google OAuth flow
GET  /api/auth/google/callback     # OAuth callback (returns JWE token)
```

#### Flashcard Generation

```http
POST /api/generate                  # Generate flashcards (async, returns jobId)
GET  /api/jobs/:id                 # Poll job status and retrieve results
POST /api/upload                   # Upload PDF/Image for processing
```

#### Quiz Generation

```http
POST /api/quiz                     # Generate quiz (from topic or flashcards)
POST /api/quiz/generate-advanced    # Generate advanced quiz
GET  /api/quiz/history             # Get quiz history
POST /api/quiz/history             # Save quiz result
```

**Quiz Generation Options:**
- **From Topic**: Provide `topic` and optional `numQuestions`.
- **From Flashcards**: Provide `flashcardIds` array and optional `numQuestions`.

#### WebLLM Management (New)

```http
POST /api/webllm/session           # Create WebLLM session
GET  /api/webllm/session/:id       # Get session status
WS   /api/webllm/ws/:sessionId     # WebSocket connection for WebLLM
POST /api/webllm/generate          # Generate via WebLLM (via WebSocket)
```

#### Storage & History

```http
POST /api/decks                    # Save flashcard deck
GET  /api/decks                    # Get deck history
```

#### GraphQL API ✨ NEW

```http
POST /graphql                      # GraphQL endpoint (queries + mutations)
```

**Key Features:**
- 🔀 Hybrid mode with automatic REST fallback
- 🔐 Full JWT authentication support
- ⚡ Efficient data fetching (request only what you need)
- 📦 Batch multiple operations in single request

**Example Queries:**

```graphql
# Get all decks with cards
query {
  decks {
    id
    topic
    cards {
      front
      back
    }
  }
}

# Generate flashcards (requires auth)
mutation {
  generateFlashcards(input: {
    topic: "React Hooks"
    count: 10
    mode: "standard"
  }) {
    cards {
      front
      back
    }
    jobId
  }
}

# Create quiz
mutation {
  createQuiz(input: {
    topic: "JavaScript"
    source: "topic"
    count: 5
  }) {
    id
    questions {
      question
      options
    }
  }
}
```

**Enable GraphQL Mode (Frontend):**
```javascript
localStorage.setItem('USE_GRAPHQL', 'true');
```

**Full Documentation**: See [docs/graphql-api.md](docs/graphql-api.md)

#### Admin & Monitoring

```http
GET  /api/health                   # Service health check
GET  /api/queue/stats              # Queue statistics
GET  /api-docs                     # Swagger UI
```

## 🏗 Architecture

### Clean Architecture Layers

```
┌─────────────────────────────────────┐
│   Primary Adapters (Express API)   │
├─────────────────────────────────────┤
│   Core Services (Business Logic)   │
│   - StudyService                    │
│   - AuthService                     │
│   - QueueService                    │
│   - ResilienceService               │
├─────────────────────────────────────┤
│   Secondary Adapters                │
│   - OllamaAdapter                   │
│   - WebLLMService (New)             │
│   - SerperAdapter                   │
│   - FileSystemAdapter               │
└─────────────────────────────────────┘
```

### Request Flow

1. **Client** → Express API endpoint
2. **Authentication** → JWE token validation
3. **Rate Limiting** → Request throttling
4. **Cache Check** → Return cached result if available
5. **Queue** → Add job to background queue (if async)
6. **Worker** → Process job with circuit breaker
7. **Adapter** → Call external service (Ollama/Serper)
8. **Response** → Return result to client

### WebLLM Architecture (New)

Since WebLLM requires browser WebGPU, we use a hybrid approach:

```
┌─────────────┐         WebSocket          ┌──────────────┐
│   Client    │ ←────────────────────────→ │   Backend    │
│  (Browser)  │                             │   Service    │
│             │                             │              │
│  WebGPU     │                             │  Session     │
│  Runtime    │                             │  Management  │
│             │                             │  Business    │
│  WebLLM     │                             │  Logic       │
│  Engine     │                             │  Caching     │
└─────────────┘                             └──────────────┘
```

- **Backend**: Manages sessions, business logic, caching, queue
- **Frontend**: Provides WebGPU runtime, connects via WebSocket
- **Communication**: Real-time bidirectional WebSocket

## 🔌 Integration Guide

### Basic Integration

```javascript
// 1. Authenticate
const authResponse = await fetch('http://api.example.com/api/auth/google');
// Redirect to Google OAuth, get token from callback

// 2. Generate Flashcards
const response = await fetch('http://api.example.com/api/generate', {
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

// 3. Poll for Results
let result;
do {
  await new Promise(resolve => setTimeout(resolve, 1000));
  const statusResponse = await fetch(`http://api.example.com/api/jobs/${jobId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  result = await statusResponse.json();
} while (result.status === 'waiting' || result.status === 'active');

// 4. Use Results
if (result.status === 'completed') {
  const flashcards = result.result.cards;
  // Use flashcards in your application
}
```

### GraphQL Integration Example

```javascript
// 1. Authenticate (same as REST)
// ... get token from OAuth flow

// 2. Generate Flashcards via GraphQL
const response = await fetch('http://api.example.com/graphql', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    query: `
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
    `,
    variables: {
      input: {
        topic: 'Neural Networks',
        count: 10,
        mode: 'standard',
        knowledgeSource: 'ai-web'
      }
    }
  })
});

const { data } = await response.json();

// 3. Handle Response
if (data.generateFlashcards.jobId) {
  // Async: Poll for results
  const jobId = data.generateFlashcards.jobId;
  // ... poll via GraphQL job query or REST /api/jobs/:id
} else {
  // Sync: Use cards immediately
  const flashcards = data.generateFlashcards.cards;
}
```

**Advantages of GraphQL:**
- Request exactly the fields you need
- Combine multiple operations in one request
- Type-safe with schema validation
- Automatic REST fallback for reliability
```

### WebLLM Integration

```javascript
// 1. Create WebLLM Session
const sessionResponse = await fetch('http://api.example.com/api/webllm/session', {
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
const ws = new WebSocket(`${wsUrl}/${sessionId}`);

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.type === 'progress') {
    console.log('Progress:', message.progress);
  } else if (message.type === 'result') {
    console.log('Result:', message.data);
  }
};

// 3. Send Generation Request
ws.send(JSON.stringify({
  type: 'generate',
  prompt: 'Generate flashcards about Neural Networks',
  options: { count: 10 }
}));
```

## 🔐 Authentication

The API uses **JWE (JSON Web Encryption)** tokens for secure authentication.

### Getting a Token

1. Redirect user to `/api/auth/google`
2. User authenticates with Google
3. Callback redirects to your app with `?token=<jwe_token>`
4. Store token and include in `Authorization: Bearer <token>` header

### Token Format

```
Authorization: Bearer <jwe_token>
```

### Protected Endpoints

All endpoints except `/api/health` and `/api/auth/*` require authentication.

## 📦 Deployment

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### Environment Variables

Ensure all required environment variables are set in your deployment environment.

### Health Checks

```bash
curl http://localhost:3000/api/health
# Response: {"ollama":true,"serper":true}
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test suite
npm test -- tests/unit/AuthService.test.ts
```

## 📊 Monitoring

### Queue Statistics

```bash
curl -H "Authorization: Bearer <token>" \
  http://localhost:3000/api/queue/stats
```

### Logs

- **Console**: Structured JSON logs (Winston)
- **Files**: `logs/error.log`, `logs/combined.log`

## 🔧 Configuration

### Feature Flags

| Variable | Default | Description |
|----------|---------|-------------|
| `USE_MCP_SERVER` | `false` | Enable MCP server integration |

### Cache Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `CACHE_LLM_TTL_SECONDS` | `86400` | LLM response cache TTL (1 day) |
| `CACHE_SERPER_TTL_SECONDS` | `3600` | Serper result cache TTL (1 hour) |

### Rate Limiting

- **API endpoints**: 100 requests per 15 minutes
- **Auth endpoints**: 5 requests per hour

## 🛠 Development

### Project Structure

```
src/
├── adapters/
│   ├── primary/express/     # Express server, routes, middleware
│   └── secondary/            # External service adapters
│       ├── ollama/           # Ollama LLM adapter
│       ├── webllm/           # WebLLM service (new)
│       ├── serper/           # Serper search adapter
│       └── fs/               # File system adapter
├── core/
│   ├── domain/               # Domain models
│   ├── ports/                # Interface definitions
│   └── services/             # Core business logic
└── index.ts                  # Application entry point
```

### Adding New Endpoints

1. Define route in `src/adapters/primary/express/server.ts`
2. Add OpenAPI spec to `swagger.yaml`
3. Implement business logic in `StudyService` or create new service
4. Add tests in `tests/`

## 📝 License

MIT

## 🤝 Support

For API integration support, see:
- **API Documentation**: `/api-docs` (Swagger UI)
- **GitHub Wiki**: [Wiki Documentation](./docs/wiki/)
- **Examples**: [Integration Examples](./docs/examples/)

