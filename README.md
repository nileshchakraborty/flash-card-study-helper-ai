# Flash Card Study Helper AI

📚 **Overview**
AI‑powered flash‑card study application with swipeable cards, file uploads, and interactive quizzes.

## Features
- **Swipeable Flashcards** – Tinder‑like swipe interface for studying
  - Swipe left (or click “Revise”) to put cards back in the deck
  - Swipe right (or click “Next”) to mark cards as mastered
  - Works on both mobile (touch) and desktop (mouse/buttons)
- **Topic‑Based Generation** – Generate flashcards from any topic using AI
  - Enter a topic and number of cards
  - AI generates relevant flashcards automatically
- **File Upload** – Convert PDFs and images into flashcards
  - Upload PDFs, PNG, JPG, GIF files
  - Drag and drop support
  - Automatic text extraction and flashcard generation
- **Interactive Quiz** – Test your knowledge
  - Generate quizzes from your flashcards
  - Answer questions and get instant feedback
  - Review correct and incorrect answers
- **Study Plan** – AI‑generated study plans based on your progress
  - Automatically creates daily study plans
  - Tracks left/right swipes for revision planning
  - Recreates plans based on your learning progress

> **Note:** The UI now automatically detects when **“Enable Offline AI”** (WebLLM) is active and uses the appropriate runtime – no manual checkbox needed.

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** ≥ 14  
- **Ollama** (for local LLM) – optional if you prefer WebLLM only  

### Installation
```bash
# 1️⃣ Clone the repo
git clone [https://github.com/your-repo/flash-card-study-helper-ai](https://github.com/your-repo/flash-card-study-helper-ai)
cd flash-card-study-helper-ai

# 2️⃣ Install dependencies
npm install

# 3️⃣ Set up environment variables
cp .env.example .env
# Edit .env → set OLLAMA_BASE_URL, OLLAMA_MODEL, SERPER_API_KEY, etc.

# Ollama Setup (optional)
```bash
# Install Ollama (https://ollama.ai)
ollama pull llama3.2   # or any Ollama‑compatible model
```

# Run the Application
```bash
npm start
# Open http://localhost:3000 in your browser
```

### Development
```bash
npm run demo   # runs a quick demo of core functionality
npm run build  # builds the frontend (esbuild)
```

---

## 🎯 Usage

### 1️⃣ Create Flashcards
- Create Cards tab → enter a topic and card count.
- Enable Offline AI (bottom‑right) to use WebLLM; otherwise Ollama is used.
- Click Generate Flashcards → cards appear in the Study tab.

### 2️⃣ Deep Dive Mode
- After finishing a deck, select Deep Dive (radio button).
- Click Move to Harder Questions → the system generates advanced cards based on the current topic.

### 3️⃣ Quiz
- Quiz tab → set number of questions → answer and review results.

### 4️⃣ Study Plan
- The app builds a daily study plan based on your swipe history.

---

## 📡 API Endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | /api/flashcards | Retrieve all flashcards |
| POST | /api/flashcards | Add flashcards manually |
| POST | /api/upload | Upload PDFs/images for conversion |
| POST | /api/generate | Generate flashcards (supports `runtime: 'ollama'` and `runtime: 'webllm'`) |
| GET | /api/quiz?size=5 | Generate a quiz |
| POST | /api/quiz/grade | Grade quiz answers |
| POST | /api/swipe | Record swipe action |
| GET | /api/swipe-history | Swipe statistics |
| GET | /api/study-plan | Generate study plan |
| POST | /api/reset | Reset the deck |
| GET | /api/health | Health check (Ollama & Serper) |

Example – Ollama generation

```bash
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{"topic":"React Hooks","count":3,"runtime":"ollama","knowledgeSource":"ai-only"}'
```

Example – WebLLM generation

```bash
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{"topic":"Kubernetes","count":2,"runtime":"webllm","knowledgeSource":"ai-web"}'
```

---

## 🤖 AI Integration

### Ollama (Server‑side)
Generates flashcards, summaries, search queries, and deep‑dive content.
Configurable via .env (OLLAMA_BASE_URL, OLLAMA_MODEL).

### WebLLM (Browser‑side)
Runs entirely in the browser when Enable Offline AI is active.
The UI now automatically selects runtime: 'webllm' based on the ModelManagerUI state.

### Knowledge Sources

- ai-only – Pure LLM generation.
- web-only – Web search only (no LLM).
- ai-web – Combined LLM + web search (default).

---

## 📊 Metrics Service

All generation attempts are logged to .metrics/generations.jsonl with:

```json
{
  "runtime":"ollama|webllm",
  "knowledgeSource":"ai-only|web-only|ai-web",
  "mode":"standard|deep-dive",
  "topic":"Your Topic",
  "cardCount":5,
  "duration":1234,
  "success":true,
  "timestamp":1763942894820
}
```

Metrics are loaded on server start and used for analytics & future model training.

---

## 🛠️ Project Structure

```bash
flash-card-study-helper-ai/
├── src/
│   ├── adapters/
│   │   ├── secondary/
│   │   │   ├── ollama/          # Ollama adapter
│   │   │   └── serper/          # Web search adapter
│   │   └── primary/
│   │       └── express/         # API server
│   ├── core/
│   │   ├── ports/               # Interfaces
│   │   └── services/
│   │       ├── StudyService.ts  # Orchestrates generation & deep‑dive
│   │       └── MetricsService.ts# Tracks generation metrics
│   └── index.ts                 # Application entry point
├── public/
│   ├── js/
│   │   ├── services/
│   │   │   ├── api.service.ts          # Wrapper for API calls
│   │   │   ├── llm/
│   │   │   │   └── LLMOrchestrator.ts   # Handles WebLLM model loading
│   │   │   └── ConfigurationService.ts # (now deprecated – runtime auto‑detect)
│   │   └── views/
│   │       ├── generator.view.ts       # UI for card generation
│   │       └── quiz.view.ts
│   └── index.html
├── .metrics/                    # JSONL logs
├── .env & .env.example
└── README.md
```

---

## 📦 Future Enhancements (Roadmap)

- Real‑time AI service integration (e.g., OpenAI, Anthropic)
- User authentication & data persistence
- Spaced‑repetition algorithm
- Export / import flashcards
- Multiple decks & sharing
- Advanced analytics & progress dashboards
- Quiz Mode with AI grading 
- Metrics service for tracking generation metrics
- Backend API with health checks

---

## 📝 License

MIT

---

## 📚 Quick Reference – Enabling Offline AI

1. Click Enable Offline AI (bottom‑right).
2. The UI now automatically sets runtime: 'webllm' for the next generation request.
3. No manual checkbox is needed – the change is handled in 
generator.view.ts by checking llmOrchestrator.isModelLoaded().


Enjoy building smarter study sessions! 🎓✨
