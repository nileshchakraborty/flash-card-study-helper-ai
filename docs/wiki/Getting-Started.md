# Getting Started with MindFlip AI Backend

This guide will help you get the MindFlip AI backend API up and running quickly.

## Prerequisites

Before you begin, ensure you have:

- **Node.js** ≥ 18.0.0 installed
- **npm** or **yarn** package manager
- **Redis** (optional, for queue management)
- **Ollama** (optional, for local LLM)

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd flash-card-study-helper-ai
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```bash
# Required
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
JWE_SECRET_KEY=your_32_character_secret_key
SERPER_API_KEY=your_serper_api_key

# Optional
PORT=3000
OLLAMA_BASE_URL=http://localhost:11434
REDIS_HOST=localhost
REDIS_PORT=6379
```

### 4. Build the Project

```bash
npm run build
```

### 5. Start the Server

```bash
# Development mode
npm run dev

# Production mode
npm start
```

The API will be available at `http://localhost:3000/api`

## Verify Installation

### Health Check

```bash
curl http://localhost:3000/api/health
```

Expected response:
```json
{
  "ollama": true,
  "serper": true,
  "webllm": true
}
```

### Swagger UI

Open your browser and navigate to:
```
http://localhost:3000/api-docs
```

You should see the interactive API documentation.

## Next Steps

1. **Set up Authentication**: Configure Google OAuth credentials
2. **Test API**: Use Swagger UI to test endpoints
3. **Read Documentation**: 
   - [API Reference](API-Reference.md)
   - [Authentication Guide](Authentication.md)
   - [WebLLM Integration](WebLLM-Integration.md)

## Common Issues

### Port Already in Use

If port 3000 is already in use, change it in `.env`:
```bash
PORT=3001
```

### Redis Connection Error

If Redis is not available, the queue will use in-memory fallback. For production, ensure Redis is running:
```bash
redis-server
```

### Ollama Not Found

If Ollama is not installed, the API will still work but `ollama` runtime will fail. Install Ollama:
```bash
# macOS
brew install ollama

# Linux
curl -fsSL https://ollama.com/install.sh | sh
```

## Getting Help

- Check [Troubleshooting Guide](Troubleshooting.md)
- Review [FAQ](FAQ.md)
- Open an issue on GitHub

