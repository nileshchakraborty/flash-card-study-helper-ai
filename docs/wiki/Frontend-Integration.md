# Frontend Integration Guide

The MindFlip AI frontend is a Single Page Application (SPA) built with Vanilla TypeScript and minimal dependencies (TailwindCSS for styling). It serves as a reference implementation for consuming the backend API.

## Architecture

The frontend follows a **Model-View-Controller (MVC)** pattern:

- **Models**: Manage state and business logic (e.g., `DeckModel`, `QuizModel`).
- **Views**: Handle DOM manipulation and UI rendering (e.g., `StudyView`, `QuizView`, `GeneratorView`).
- **Controllers**: Orchestrate interactions between models and views (e.g., `AppController`).

### Event Bus
Components communicate via a global `EventBus` (`utils/event-bus.ts`) to remain decoupled.
- `deck:loaded`: Triggered when a new deck is generated or loaded.
- `quiz:request-start`: Triggered when a quiz is requested.
- `quiz:start-with-cards`: Triggered when a quiz is created from selected flashcards.

## Key Features

### 1. Flashcard Study
- **Swipe Gestures**: On mobile devices, users can swipe cards left (Review) or right (Mastered).
- **Deep Dive**: Users can request "Harder Questions" which triggers an advanced generation flow (Deep Dive mode).

### 2. Quiz System
- **Generative Quizzes**: Created on-the-fly from topics using `POST /api/quiz`.
- **From Flashcards**: Users can select specific cards from their current deck to generate a quiz (`AppController` handles `quiz:start-with-cards`).
- **Prefetched Quizzes**: generated in the background for recommended topics.

### 3. State Persistence
- **Deck History**: The app fetches history from `/api/decks` on initialization (`AppController.loadInitialState`), ensuring users don't lose progress on reload.
- **Local Settings**: User preferences (like LLM runtime) are stored in `localStorage`.

## Directory Structure

```
public/js/
├── controllers/   # AppController
├── models/        # DeckModel, QuizModel
├── services/      # ApiService, StorageService
├── views/         # Component Views
└── utils/         # EventBus, etc.
```

## Adding New Features
1. **Update Model**: Add state or logic.
2. **Update View**: Add DOM elements and bind initial events.
3. **Update Controller**: Listen for events and coordinate Model/API/View updates.
