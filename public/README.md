# MindFlip AI - Frontend

The frontend reference implementation for MindFlip AI, built with **Vanilla TypeScript** and **MVC Architecture**.

## 🏗 Architecture

The frontend follows a strict **Model-View-Controller (MVC)** pattern to ensure separation of concerns and maintainability without the overhead of a heavy framework.

### Directory Structure

```
public/
├── js/
│   ├── controllers/   # Business logic and coordination
│   ├── models/        # Data structures and state management
│   ├── views/         # UI rendering and DOM manipulation
│   ├── services/      # API communication and external services
│   ├── utils/         # Helper functions (EventBus, etc.)
│   └── main.ts        # Entry point
├── css/               # Styles
├── dist/              # Compiled assets (esbuild output)
└── index.html         # Main entry HTML
```

### Key Components

#### 1. Controllers
- **`AppController`**: Main coordinator. Initializes the app, handles routing (tabs), and connects views with services.
- **`QuizController`**: Manages quiz logic, state transitions (question -> result), and user interaction.

#### 2. Views
- **`GeneratorView`**: UI for flashcard generation (Topic/File input).
- **`StudyView`**: Flashcard swipe interface.
- **`QuizView`**: Quiz interface (Questions, Options, Results).
- **`BaseView`**: Abstract base class for common DOM operations.

#### 3. Services
- **`ApiService`**: Handles REST API communication with the backend.
- **`WebLLMService`**: Manages client-side LLM (WebGPU) via WebSocket bridge.
- **`FileProcessingService`**: Handles file uploads and processing.

#### 4. Utils
- **`EventBus`**: Pub/Sub system for decoupled communication between components.

## 🚀 Build System

The frontend uses **esbuild** for fast bundling and TypeScript compilation.

### Commands

```bash
# Build frontend (dev mode with sourcemaps)
npm run build:frontend

# Clean build artifacts
npm run clean:frontend
```

### Configuration
The build configuration is located in `esbuild.config.cjs` in the project root. It handles:
- Bundling `public/js/main.ts` -> `public/dist/main.js`
- Minification (in production)
- Source maps

## 🤖 WebLLM Integration

The frontend integrates **WebLLM** for browser-based AI generation.

- **Runtime**: `WebLLMRuntime` (in `public/js/services/llm/runtimes/`)
- **Communication**: Uses a WebSocket bridge (`/api/webllm/ws`) to coordinate with the backend while running inference locally in the browser's WebGPU.
- **UI**: Users can select models and manage sessions via the UI.

## 🎨 Styling

- **CSS**: Pure CSS with CSS Variables for theming.
- **Theme**: Dark mode optimized.
- **Responsive**: Mobile-first design.
