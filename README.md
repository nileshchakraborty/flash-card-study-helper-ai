# Flash Card Study Helper AI

An AI-powered flash card study application with swipeable cards, file uploads, and interactive quizzes.

## Features

- **Swipeable Flashcards**: Tinder-like swipe interface for studying
    - Swipe left (or click "Revise") to put cards back in the deck
    - Swipe right (or click "Next") to mark cards as mastered
    - Works on both mobile (touch) and desktop (mouse/buttons)

- **Topic-Based Generation**: Generate flashcards from any topic using AI
    - Enter a topic and number of cards
    - AI generates relevant flashcards automatically

- **File Upload**: Convert PDFs and images into flashcards
    - Upload PDFs, PNG, JPG, GIF files
    - Drag and drop support
    - Automatic text extraction and flashcard generation

- **Interactive Quiz**: Test your knowledge
    - Generate quizzes from your flashcards
    - Answer questions and get instant feedback
    - Review correct and incorrect answers

- **Study Plan**: AI-generated study plans based on your progress
    - Automatically creates daily study plans
    - Tracks left/right swipes for revision planning
    - Recreates plans based on your learning progress

## Getting Started

### Prerequisites

- Node.js 14.0.0 or higher

### Installation

1. Clone or download this repository
2. Navigate to the project directory
3. Install dependencies:
   ```bash
   npm install
   ```

4. **Configure Environment Variables**:
    - Copy the example environment file:
      ```bash
      cp .env.example .env
      ```
    - Edit `.env` and set your configuration:
        - `OLLAMA_BASE_URL` - Ollama server URL (default: http://localhost:11434)
        - `OLLAMA_MODEL` - Ollama model to use (default: llama3.2:latest)
        - `SERPER_API_KEY` - Get a free API key from https://serper.dev
        - `PORT` - Server port (default: 3000)
        - `DEBUG_OLLAMA` - Set to 'true' for debug logging (optional)

5. **Install and Setup Ollama** (for AI features):
    - Download and install Ollama from https://ollama.ai
    - Pull a model (recommended: llama3.2 or mistral):
      ```bash
      ollama pull llama3.2
      ```
    - Or use any other model you prefer
    - Make sure Ollama is running (it starts automatically after installation)

### Running the Application

Start the server:

```bash
npm start
```

The application will be available at `http://localhost:3000`

### Development

Run the demo script to see the core functionality:

```bash
npm run demo
```

## Usage

1. **Create Flashcards**:
    - Go to the "Create Cards" tab
    - Enter a topic and generate flashcards, or
    - Upload PDF/image files to convert them

2. **Study**:
    - Go to the "Study" tab
    - Swipe cards left (revise) or right (mastered)
    - View your study plan on the right

3. **Take Quiz**:
    - Go to the "Quiz" tab
    - Set the number of questions
    - Answer questions and review results

## API Endpoints

- `GET /api/flashcards` - Get all flashcards
- `POST /api/flashcards` - Add flashcards manually
- `POST /api/upload` - Upload and convert files
- `POST /api/generate` - Generate flashcards from topic
- `GET /api/quiz?size=5` - Generate a quiz
- `POST /api/quiz/grade` - Grade quiz answers
- `POST /api/swipe` - Record swipe action
- `GET /api/swipe-history` - Get swipe statistics
- `GET /api/study-plan` - Generate study plan
- `POST /api/reset` - Reset the deck
- `GET /api/health` - Check Ollama and library availability

## AI Integration

The application uses **Ollama** for AI-powered flashcard generation:

### Features

- **PDF Parsing**: Uses `pdf-parse` to extract text from PDF files
- **Image OCR**: Uses `tesseract.js` to extract text from images
- **AI Flashcard Generation**: Uses Ollama to intelligently generate flashcards from:
    - Extracted text from PDFs/images
    - Topic-based generation with web search (via Serper API)
    - Web content is cached locally for faster subsequent requests

### Configuration

#### Configuration via .env File

All configuration is done through the `.env` file in the root directory. Copy `.env.example` to `.env` and edit it:

```bash
cp .env.example .env
```

Then edit `.env` with your settings:

```env
# Ollama Configuration
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:latest

# Serper API Configuration (for web search)
SERPER_API_KEY=your_serper_api_key_here

# Server Configuration
PORT=3000

# Debug Mode (optional)
DEBUG_OLLAMA=false
```

**Note:**

- Without `SERPER_API_KEY`, the app will fall back to direct Ollama generation (without web search)
- Get a free Serper API key from https://serper.dev
- The `.env` file is automatically loaded when the server starts

### Supported Models

Any Ollama-compatible model works. Recommended models:

- `llama3.2:latest` - Fast and efficient
- `mistral` - Good balance of speed and quality
- `llama3` - Higher quality, slower
- `codellama` - Good for technical content

### Health Check

Check if Ollama is properly configured:

```bash
curl http://localhost:3000/api/health
```

### Fallback Mode

If Ollama is not available, the app will:

- Still parse PDFs and images
- Use simple sentence-based flashcard conversion
- Show warnings in the console

## Project Structure

```
flash-card-study-helper-ai/
├── server.js              # Backend server with API endpoints
├── main.js                # Core flashcard classes (Node.js)
├── main.ts                # TypeScript version of core classes
├── package.json           # Project configuration
├── public/
│   ├── index.html        # Frontend HTML
│   ├── app.js            # Frontend JavaScript
│   ├── style.css         # Styles
│   └── flashcard-lib.js  # Browser-compatible flashcard classes
└── uploads/              # Uploaded files directory (created automatically)
```

## Technologies

- **Backend**: Node.js with native HTTP server
- **Frontend**: Vanilla JavaScript (ES6 modules)
- **Styling**: CSS3 with modern design
- **File Handling**: Multipart form data parsing
- **AI/ML**:
    - **Ollama** - Local LLM for flashcard generation
    - **pdf-parse** - PDF text extraction
    - **tesseract.js** - OCR for image text extraction
    - **axios** - HTTP client for Ollama and Serper APIs
    - **cheerio** - Web scraping and HTML parsing
- **Web Search**:
    - **Serper API** - Google search API for finding relevant content
    - **Local Caching** - Caches web content for 24 hours

## Browser Support

- Modern browsers with ES6 module support
- Mobile browsers with touch event support
- Desktop browsers with mouse/pointer support

## License

MIT

## Future Enhancements

- Real AI service integration
- User authentication and data persistence
- Spaced repetition algorithm
- Export/import flashcards
- Multiple decks support
- Progress analytics
- Social sharing features

