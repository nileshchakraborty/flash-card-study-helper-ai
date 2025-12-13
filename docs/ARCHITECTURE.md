# MindFlip AI - System Architecture

**Last Updated**: 2025-12-09  
**Version**: 2.1 (MCP-First Architecture & robust Queue)

## High-Level Architecture

```mermaid
graph TB
    subgraph "Clients"
        WEB[Web Frontend<br/>Reference SPA]
        MOBILE[Mobile App<br/>Expo / React Native]
    end

    subgraph "API Gateway"
        EXPRESS[Express Server<br/>:3000]
        GQL[GraphQL API<br/>/graphql]
        REST[REST API<br/>/api/*]
    end

    subgraph "Core Domain"
        STUDY[Study Service]
        QUIZ[Quiz Service]
        AUTH[Auth Service]
    end

    subgraph "Infrastructure"
        QUEUE[BullMQ Queue]
        CACHE[Flashcard Cache]
        DB[(Local/Supabase DB)]
        VECTOR[(Vector Store)]
    end

    subgraph "AI & External Adapters"
        HYBRID[Hybrid AI Adapter]
        MCP_CLIENT[MCP Client]
        SERPER[Serper Adapter]
    end

    subgraph "External Systems"
        OLLAMA[Ollama (Local)]
        WEBLLM[WebLLM (Browser)]
        SERPER_API[Serper.dev]
        MCP_SERVER[MCP Server]
    end

    %% Wiring
    WEB --> EXPRESS
    MOBILE --> EXPRESS
    
    EXPRESS --> REST
    EXPRESS --> GQL
    
    REST --> AUTH
    GQL --> AUTH
    AUTH --> STUDY
    AUTH --> QUIZ

    STUDY --> QUEUE
    STUDY --> CACHE
    STUDY --> DB
    STUDY --> VECTOR

    %% Async Flow
    QUEUE --> STUDY

    %% AI Integration
    STUDY --> HYBRID
    HYBRID -->|Primary| OLLAMA
    HYBRID -->|Client Edge| WEBLLM
    HYBRID -->|Tools| MCP_CLIENT
    
    MCP_CLIENT --> MCP_SERVER
    MCP_SERVER --> OLLAMA
    MCP_SERVER --> SERPER_API

    SERPER --> SERPER_API
```

## Mobile App Architecture

```mermaid
graph TD
    subgraph "Expo / React Native App"
        APP[App Entry<br/>app/_layout.tsx]
        
        subgraph "Routing (Expo Router)"
            TABS[(tabs)]
            AUTH[auth/]
            QUIZ[quiz/]
            MODAL[modal.tsx]
        end

        subgraph "State Management"
            CTX_AUTH[AuthContext]
            CTX_THEME[ThemeContext]
            HOOKS[Custom Hooks]
        end

        subgraph "Services"
            API[API Client]
            WEBLLM_BRIDGE[WebLLM Bridge]
            STORAGE[AsyncStorage]
        end
    end

    APP --> TABS
    APP --> AUTH
    
    TABS --> CTX_AUTH
    QUIZ --> WEBLLM_BRIDGE
    
    HOOKS --> API
    CTX_AUTH --> STORAGE
```

## Request Flow

### 1. Authenticated Flashcard Generation

```mermaid
sequenceDiagram
    participant Client
    participant Express
    participant Auth
    participant StudyService
    participant Queue
    participant Worker
    participant MCP
    participant Ollama

    Client->>Express: POST /api/generate<br/>{topic, count}
    Express->>Auth: Validate JWT Token
    Auth->>Auth: Decrypt & Verify
    Auth-->>Express: User Payload
    Express->>StudyService: generateFlashcards()
    StudyService->>Queue: Enqueue Job
    Queue-->>Express: {jobId, statusUrl}
    Express-->>Client: 202 Accepted

    Queue->>Worker: Process Job
    Worker->>StudyService: doGenerateFlashcards()
    StudyService->>MCP: Generate via MCP
    MCP->>Ollama: LLM Request
    Ollama-->>MCP: Response
    MCP-->>StudyService: Flashcards
    StudyService-->>Worker: Complete
    Worker->>Queue: Update Status
    
    Client->>Express: GET /api/jobs/{jobId}
    Express-->>Client: {status: completed, result}
```

### 2. MCP Circuit Breaker Flow

```mermaid
flowchart TD
    A[Request to MCP] --> B{Circuit Open?}
    B -->|Yes| C[Direct Ollama]
    B -->|No| D[Try MCP]
    D --> E{Success?}
    E -->|Yes| F[Return Result]
    E -->|No| G{Max Failures?}
    G -->|Yes| H[Open Circuit]
    G -->|No| I[Increment Failure]
    H --> C
    I --> C
    C --> F
    
    F --> J[Reset Failures]
```

## Component Details

### Backend Services

| Service | Port | Purpose | Key Features |
|---------|------|---------|--------------|
| Express Server | 3000 | Main API | REST + GraphQL |
| MCP Server | stdio | Tool orchestration | Ollama, Storage, DB |
| Ollama | 11434 | Local LLM | llama3.2:latest |
| Queue Worker | - | Async processing | BullMQ |

### Data Flow

```
Client Request
    ↓
Auth Middleware → Rate Limiter
    ↓
Service Layer (StudyService)
    ↓
Queue System (BullMQ)
    ↓
Worker Process
    ↓
[Future: LangGraph Orchestration]
    ↓
StudyService (Parallel: AI Summary + Web Content)
    ↓
Hybrid Adapters (MCP-first)
    ↓
MCP Client ↔ MCP Server
    ↓           ↓
Direct      MCP Tools
Fallback    (Ollama, Storage, etc.)
    ↓
External Services
```

### Storage Structure

```
.data/
├── flashcards/          # Deck storage
├── quizzes/             # Quiz sessions
├── metrics/             # Performance data
└── cache/              # LLM cache

.metrics/               # Metrics logs
```

## Security Architecture

```mermaid
graph LR
    A[Client] -->|JWT Token| B[Auth Middleware]
    B -->|Decrypt JWE| C[AuthService]
    C -->|Validate| D{Valid?}
    D -->|Yes| E[Attach User to Request]
    D -->|No| F[401 Unauthorized]
    E --> G[Rate Limiter]
    G --> H[Service Layer]
```

### Auth Flow

1. **Login**: OAuth (Google) → JWT creation
2. **Token**: JWE (encrypted) with 2hr expiration
3. **Validation**: Every protected endpoint
4. **Storage**: Singleton AuthService, consistent secret

## Resilience Patterns

### 1. Circuit Breaker (MCP)
- **Closed**: Normal operation via MCP
- **Open**: Direct Ollama after failures
- **Half-Open**: Test reconnection periodically

### 2. Graceful Degradation
- MCP unavailable → Direct adapters
- Ollama down → Web search + synthesis
- Cache miss → Fresh generation

### 3. Queue-Based Processing
- Async flashcard generation
- Job status tracking
- Retry on failure
- Dead letter queue

## Technology Stack

### Backend
- **Runtime**: Node.js 22.x
- **Framework**: Express.js
- **Language**: TypeScript
- **Queue**: BullMQ (Redis)
- **GraphQL**: Apollo Server
- **Auth**: jose (JWE tokens)

### AI/ML
- **Local LLM**: Ollama (llama3.2:latest)
- **MCP**: Model Context Protocol
- **LangGraph**: Workflow orchestration
- **Web Search**: Serper API

### Mobile App (New)
- **Framework**: React Native with Expo
- **Routing**: Expo Router (File-based routing like Next.js)
- **Styling**: NativeWind (Tailwind CSS for Native)
- **State**: React Hooks + Context
- **AI**: WebLLM Bridge (runs local LLM in WebView)

### Frontend (Reference SPA)
- **Build**: esbuild
- **Framework**: Vanilla JS + TypeScript
- **State**: Event-driven Controller pattern

## Deployment Architecture

```mermaid
graph TB
    subgraph "Production (Vercel)"
        VERCEL[Vercel Instance]
        STATIC[Static Assets]
    end

    subgraph "Development"
        LOCAL[localhost:3000]
        OLLAMA_LOCAL[Ollama :11434]
    end

    subgraph "External APIs"
        SERPER_PROD[Serper API]
    end

    VERCEL --> SERPER_PROD
    LOCAL --> OLLAMA_LOCAL
    LOCAL --> SERPER_PROD
```

## Environment Configuration

```bash
# Required
JWE_SECRET_KEY=<64-char-hex>
SERPER_API_KEY=<api-key>

# Optional
OLLAMA_HOST=http://localhost:11434
NODE_ENV=development
REDIS_URL=redis://localhost:6379

# Testing
TEST_AUTH_TOKEN=<generated-token>
```

## Performance Metrics

- **Auth**: <5ms (token validation)
- **Cache Hit**: <10ms  
- **Ollama**: 2-30s (model dependent)
- **Queue**: <50ms (job enqueue)

## Next Architecture Steps

1. ✅ MCP-first architecture (Complete)
2. ⏳ LangGraph integration (Started)
3. [ ] Distributed caching (Redis)
4. [ ] Horizontal scaling
5. [ ] CDN for static assets
