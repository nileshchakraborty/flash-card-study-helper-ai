# WebLLM Integration Guide

This guide explains how to integrate WebLLM (browser-based LLM) with the MindFlip AI backend.

## Overview

WebLLM runs in the browser using WebGPU, but the backend manages:
- Session lifecycle
- Business logic orchestration
- Caching and queue management
- WebSocket communication

## Architecture

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

## Integration Steps

### 1. Create a WebLLM Session

```javascript
const response = await fetch('http://localhost:3000/api/webllm/session', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    modelId: 'Llama-3-8B-Instruct-q4f16_1-MLC'
  })
});

const { sessionId, wsUrl } = await response.json();
```

### 2. Initialize WebLLM in Browser

```javascript
import * as webllm from '@mlc-ai/web-llm';

const engine = new webllm.MLCEngine();

engine.setInitProgressCallback((report) => {
  console.log('Progress:', report.progress, report.text);
});

await engine.reload('Llama-3-8B-Instruct-q4f16_1-MLC');
```

### 3. Connect WebSocket

```javascript
const ws = new WebSocket(wsUrl);

ws.onopen = () => {
  console.log('WebSocket connected');
};

ws.onmessage = async (event) => {
  const message = JSON.parse(event.data);
  
  if (message.type === 'progress') {
    // Update UI with progress
    updateProgress(message.progress, message.message);
  } else if (message.type === 'result') {
    // Process result
    handleResult(message.data);
  } else if (message.type === 'generate') {
    // Backend requesting generation
    await handleGenerationRequest(message);
  }
};
```

### 4. Handle Generation Requests

```javascript
async function handleGenerationRequest(message) {
  const { prompt, options } = message;
  
  // Generate using WebLLM
  const result = await engine.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7
  });
  
  // Parse and format result
  const cards = parseFlashcards(result.choices[0].message.content);
  
  // Send result back to backend
  ws.send(JSON.stringify({
    type: 'response',
    cacheKey: `webllm:flashcards:${options.topic}:${options.count}`,
    data: { cards }
  }));
}
```

### 5. Send Generation Request

```javascript
ws.send(JSON.stringify({
  type: 'generate',
  prompt: 'Generate flashcards about Neural Networks',
  options: {
    count: 10,
    topic: 'Neural Networks'
  }
}));
```

## Message Types

### Client → Server

**Generate Request**:
```json
{
  "type": "generate",
  "prompt": "Generate flashcards...",
  "options": { "count": 10, "topic": "Topic" }
}
```

**Response**:
```json
{
  "type": "response",
  "cacheKey": "webllm:flashcards:Topic:10",
  "data": { "cards": [...] }
}
```

### Server → Client

**Progress**:
```json
{
  "type": "progress",
  "progress": 50,
  "message": "Generating..."
}
```

**Result**:
```json
{
  "type": "result",
  "data": { "cards": [...] }
}
```

**Error**:
```json
{
  "type": "error",
  "error": "Error message"
}
```

## Session Management

### Check Session Status

```javascript
const response = await fetch(`http://localhost:3000/api/webllm/session/${sessionId}`, {
  headers: { 'Authorization': `Bearer ${token}` }
});

const session = await response.json();
console.log('Status:', session.status);
```

### Close Session

```javascript
await fetch(`http://localhost:3000/api/webllm/session/${sessionId}`, {
  method: 'DELETE',
  headers: { 'Authorization': `Bearer ${token}` }
});
```

## Best Practices

1. **Reuse Sessions**: Create one session per user session, reuse it for multiple generations
2. **Handle Errors**: Always handle WebSocket errors and reconnection
3. **Progress Updates**: Show progress to users during generation
4. **Cache Results**: Backend automatically caches, but you can also cache client-side
5. **Cleanup**: Close sessions when done to free resources

## Example: Complete Integration

```javascript
class WebLLMClient {
  constructor(token, modelId) {
    this.token = token;
    this.modelId = modelId;
    this.sessionId = null;
    this.ws = null;
    this.engine = null;
  }

  async initialize() {
    // Create session
    const sessionResponse = await fetch('http://localhost:3000/api/webllm/session', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ modelId: this.modelId })
    });
    
    const { sessionId, wsUrl } = await sessionResponse.json();
    this.sessionId = sessionId;

    // Initialize WebLLM
    this.engine = new webllm.MLCEngine();
    await this.engine.reload(this.modelId);

    // Connect WebSocket
    this.ws = new WebSocket(wsUrl);
    this.setupWebSocket();
  }

  setupWebSocket() {
    this.ws.onmessage = async (event) => {
      const message = JSON.parse(event.data);
      
      if (message.type === 'generate') {
        await this.handleGeneration(message);
      }
    };
  }

  async handleGeneration(message) {
    const { prompt, options } = message;
    
    // Generate with WebLLM
    const result = await this.engine.chat.completions.create({
      messages: [{ role: 'user', content: prompt }]
    });
    
    // Parse and send back
    const cards = this.parseFlashcards(result.choices[0].message.content);
    
    this.ws.send(JSON.stringify({
      type: 'response',
      cacheKey: `webllm:flashcards:${options.topic}:${options.count}`,
      data: { cards }
    }));
  }

  async generateFlashcards(topic, count) {
    return new Promise((resolve, reject) => {
      const handler = (event) => {
        const message = JSON.parse(event.data);
        if (message.type === 'result') {
          this.ws.removeEventListener('message', handler);
          resolve(message.data);
        } else if (message.type === 'error') {
          this.ws.removeEventListener('message', handler);
          reject(new Error(message.error));
        }
      };
      
      this.ws.addEventListener('message', handler);
      
      this.ws.send(JSON.stringify({
        type: 'generate',
        prompt: `Generate ${count} flashcards about ${topic}`,
        options: { count, topic }
      }));
    });
  }

  close() {
    if (this.ws) this.ws.close();
    if (this.sessionId) {
      fetch(`http://localhost:3000/api/webllm/session/${this.sessionId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
    }
  }
}

// Usage
const client = new WebLLMClient(token, 'Llama-3-8B-Instruct-q4f16_1-MLC');
await client.initialize();
const cards = await client.generateFlashcards('Neural Networks', 10);
```

## Troubleshooting

### WebSocket Connection Failed

- Check session ID is valid
- Verify authentication token
- Ensure WebSocket URL is correct

### Generation Timeout

- Check WebLLM model is loaded
- Verify WebGPU is available
- Increase timeout if needed

### Session Not Found

- Sessions expire after 30 minutes of inactivity
- Create a new session if expired
- Check session status before use

