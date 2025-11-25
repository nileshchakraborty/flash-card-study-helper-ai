# Flash Card Study Helper API

**A backend-focused service for AI-powered flashcard generation and study assistance.**

This project implements a **Clean Architecture**-based API that leverages LLMs (Ollama, WebLLM) and web search (Serper) to generate high-quality educational content. The frontend is provided as a reference implementation to demonstrate the API's capabilities.

## 🏗 Architecture

The system follows **Clean Architecture** principles to ensure separation of concerns, maintainability, and testability:

- **Core (Domain)**: Contains business logic and interfaces.
  - `StudyService`: Orchestrates generation, quiz creation, and deep dive logic.
  - `MetricsService`: Tracks usage and performance metrics.
- **Ports**: Defines interfaces for external dependencies.
  - `StudyUseCase`: Primary port for the application.
  - `LLMPort`, `SearchPort`: Secondary ports for AI and Search services.
- **Adapters**: Implements the ports.
  - **Primary**: Express Server (REST API).
  - **Secondary**: 
    - `OllamaAdapter`: Connects to local Ollama instance.
    - `WebLLMAdapter`: Connects to browser-based LLM (via client bridge).
    - `SerperAdapter`: Connects to Serper.dev for web search.
    - `FileSystemAdapter`: Handles file I/O.

## 📖 API Documentation

Interactive API documentation is available via **Swagger UI**:

- **URL**: `http://localhost:3000/api-docs`
- **Specification**: `swagger.yaml`

Explore and test all endpoints directly from your browser.

## 🚀 Getting Started

### Prerequisites
- **Node.js** ≥ 14
- **Ollama** (optional, for local server-side LLM)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd flash-card-study-helper-ai
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` to set your API keys (e.g., `SERPER_API_KEY`) and configuration.

### Running the Service

Start the backend server:
```bash
npm start
```

- **API Root**: `http://localhost:3000/api`
- **Swagger UI**: `http://localhost:3000/api-docs`
- **Demo Client**: `http://localhost:3000`

## 📡 Key API Endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| **POST** | `/api/generate` | Generate flashcards using AI (Ollama or WebLLM) |
| **POST** | `/api/search` | Perform a web search |
| **POST** | `/api/scrape` | Scrape content from URLs |
| **POST** | `/api/upload` | Upload PDF/Image for processing |
| **POST** | `/api/quiz` | Generate a quiz from flashcards |
| **GET** | `/api/health` | Check service health |

*Refer to the Swagger UI for the complete API reference.*

## 🤖 AI Integration

The service supports multiple AI runtimes:

1.  **Ollama (Server-side)**:
    - Runs locally on the server.
    - Ideal for powerful, private models (e.g., Llama 3).
    - Configured via `.env`.

2.  **WebLLM (Client-side)**:
    - Runs in the user's browser (via WebGPU).
    - Zero-server-cost inference.
    - The API coordinates with the client to offload processing.

## 🛠 Project Structure

```bash
flash-card-study-helper-ai/
├── api/                 # API Definitions
│   └── swagger.yaml     # OpenAPI Specification
├── src/
│   ├── adapters/        # Interface Adapters
│   │   ├── primary/     # Driving Adapters (Express)
│   │   └── secondary/   # Driven Adapters (Ollama, Serper, etc.)
│   ├── core/            # Application Business Rules
│   │   ├── ports/       # Input/Output Ports
│   │   └── services/    # Service Implementations
│   └── index.ts         # Composition Root
└── public/              # Demo Frontend (Reference Implementation)
```

## 📝 License

MIT
