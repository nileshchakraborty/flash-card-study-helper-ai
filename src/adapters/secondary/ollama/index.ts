import axios from 'axios';
import type { AIServicePort } from '../../../core/ports/interfaces.js';
import type { Flashcard, QuizQuestion } from '../../../core/domain/models.js';

export class OllamaAdapter implements AIServicePort {
  private baseUrl: string;
  private model: string;

  constructor() {
    this.baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    this.model = process.env.OLLAMA_MODEL || 'llama3.2:latest';
  }

  async generateFlashcards(topic: string, count: number): Promise<Flashcard[]> {
    const systemPrompt = `You are a helpful study assistant that creates flashcards.`;
    const prompt = `Create exactly ${count} flashcards about "${topic}".

IMPORTANT: Return ONLY a valid JSON array.
- Do NOT use numbered lists.
- Do NOT use markdown code blocks.
- Start directly with '[' and end with ']'.

Each object must have these exact fields:
- "question": the front of the flashcard (a question or term)
- "answer": the back of the flashcard (the answer or definition)

Example format:
[
  {"question": "What is photosynthesis?", "answer": "The process by which plants convert light into energy"},
  {"question": "What is mitosis?", "answer": "Cell division that produces two identical daughter cells"}
]`;

    const response = await this.callOllama(prompt, systemPrompt);
    console.log('Raw AI response:', response);
    const parsed = this.extractJSON(response);
    console.log('Parsed JSON:', parsed);

    // Handle both array of objects and array of strings
    if (Array.isArray(parsed)) {
      return parsed.map((item: any, index: number) => {
        if (typeof item === 'string') {
          // Convert string to flashcard format
          return {
            id: `gen-${Date.now()}-${index}`,
            front: `What is: ${topic}? (Card ${index + 1})`,
            back: item,
            topic: topic
          } as any;
        }
        // Map question/answer to front/back for frontend compatibility
        return {
          id: `gen-${Date.now()}-${index}`,
          front: item.question || item.front || `Question ${index + 1}`,
          back: item.answer || item.back || item.toString(),
          topic: topic
        } as any;
      });
    }
    return [];
  }

  async generateFlashcardsFromText(text: string, topic: string, count: number, pageInfo?: any): Promise<Flashcard[]> {
    const systemPrompt = `You are a helpful study assistant. Create ${count} flashcards from the provided text about: ${topic}.`;
    const prompt = `Text: ${text.substring(0, 10000)}\n\nReturn ONLY a valid JSON array of objects with "question" and "answer" fields.
    - Do NOT use numbered lists.
    - Do NOT use markdown code blocks.
    - Start directly with '[' and end with ']'.`;

    const response = await this.callOllama(prompt, systemPrompt);
    return this.extractJSON(response).map((card: any, index: number) => ({
      id: `file-${Date.now()}-${index}`,
      front: card.question || card.front,
      back: card.answer || card.back,
      topic: topic,
      source: pageInfo ? { page: pageInfo.page } : undefined
    }));
  }

  async generateBriefAnswer(question: string, context: string): Promise<string> {
    const systemPrompt = "You are a concise tutor. Explain the answer simply.";
    const prompt = `Question: ${question} \nContext: ${context} \n\nProvide a brief, 2 - sentence explanation.`;
    return this.callOllama(prompt, systemPrompt);
  }

  async generateSummary(topic: string): Promise<string> {
    const systemPrompt = "You are a knowledgeable expert. Provide a concise summary.";
    const prompt = `Summarize what you know about "${topic}" in 3-4 sentences. Focus on key concepts and definitions.`;
    return this.callOllama(prompt, systemPrompt);
  }

  async generateSearchQuery(topic: string, parentTopic?: string): Promise<string> {
    const systemPrompt = "You are a search engine expert. Generate a single, optimal Google search query.";
    let prompt = `Generate a search query for google search to get best knowledge about ${topic}. Return ONLY the query string, no quotes or explanation.`;

    if (parentTopic) {
      prompt = `Generate a search query for "${topic}" specifically in the context of "${parentTopic}". 
      Example: If topic is "Streams" and parent is "Java", query should be "Java Streams API tutorial".
      Return ONLY the query string, no quotes or explanation.`;
    }

    const response = await this.callOllama(prompt, systemPrompt);
    return response.replace(/^"|"$/g, '').trim();
  }

  async generateSubTopics(topic: string): Promise<string[]> {
    const systemPrompt = "You are an expert curriculum designer.";
    const prompt = `Identify 3-5 advanced sub-topics for "${topic}" that would be suitable for a deep dive study session.
    
    Return ONLY a valid JSON array of strings. Example: ["Subtopic 1", "Subtopic 2", "Subtopic 3"]`;

    const response = await this.callOllama(prompt, systemPrompt);
    return this.extractJSON(response);
  }

  async generateAdvancedQuiz(previousResults: any, mode: 'harder' | 'remedial'): Promise<QuizQuestion[]> {
    const { topic, wrongAnswers } = previousResults;
    let systemPrompt = '';
    let prompt = '';

    if (mode === 'harder') {
      systemPrompt = `You are an expert examiner.Create a challenging quiz about: ${topic}.`;
      prompt = `Create 5 advanced multiple - choice questions.Return ONLY a JSON array with "id", "question", "options"(array), "correctAnswer", "explanation".`;
    } else {
      systemPrompt = `You are a patient tutor.Create a remedial quiz.`;
      prompt = `Student missed: ${wrongAnswers.join(', ')}. Create 5 questions to reinforce these concepts.Return ONLY a JSON array with "id", "question", "options"(array), "correctAnswer", "explanation".`;
    }

    const response = await this.callOllama(prompt, systemPrompt);
    return this.extractJSON(response);
  }

  async generateQuizFromFlashcards(flashcards: Flashcard[], count: number): Promise<QuizQuestion[]> {
    const systemPrompt = "You are a teacher creating a quiz based SPECIFICALLY on the provided flashcards.";

    // Create a text representation of the flashcards
    const cardsText = flashcards.map(c => `Q: ${c.front}\nA: ${c.back}`).join('\n\n');

    const prompt = `
        Here are the flashcards to test:
        ${cardsText}
        
        Create ${count} multiple-choice questions based ONLY on these flashcards.
        
        IMPORTANT REQUIREMENTS:
        1. Mix the difficulty: Include Easy (direct recall), Medium (application), and Hard (synthesis/inference) questions.
        2. The "correctAnswer" MUST be one of the "options".
        3. Return ONLY a JSON array.
        
        JSON Format:
        [
          {
            "id": "q1",
            "question": "Question text here",
            "options": ["Option A", "Option B", "Option C", "Option D"],
            "correctAnswer": "Option A",
            "explanation": "Why this is correct",
            "difficulty": "easy" | "medium" | "hard"
          }
        ]
        `;

    const response = await this.callOllama(prompt, systemPrompt);
    return this.extractJSON(response);
  }

  private async callOllama(prompt: string, system: string): Promise<string> {
    try {
      const res = await axios.post(`${this.baseUrl}/api/generate`, {
        model: this.model,
        prompt: `${system}\n\n${prompt}`,
        stream: false
      });
      return res.data.response;
    } catch (error) {
      console.error('Ollama call failed:', error);
      throw new Error('Failed to communicate with AI service');
    }
  }

  private extractJSON(text: string): any {
    // 1. Clean the text
    let cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    // Fix common JSON issues before parsing
    // Replace real newlines in strings with \n
    cleaned = cleaned.replace(/(?<=: ")(.*?)(?=")/gs, (match) => {
      return match.replace(/\n/g, '\\n');
    });

    // Find the outer array brackets
    const firstBracket = cleaned.indexOf('[');
    const lastBracket = cleaned.lastIndexOf(']');

    if (firstBracket >= 0 && lastBracket > firstBracket) {
      const candidate = cleaned.substring(firstBracket, lastBracket + 1);
      try {
        const result = JSON.parse(candidate);
        return result;
      } catch (e) {
        // Continue to fallbacks
      }
    }

    // 2. Try parsing as-is
    try {
      const result = JSON.parse(cleaned);
      return Array.isArray(result) ? result : [result];
    } catch (e) {
      // Continue
    }

    // 3. Regex Fallback (Improved)
    const cards: any[] = [];

    // Regex to capture {"question": "...", "answer": "..."} patterns
    // Handles escaped quotes and newlines
    const objectRegex = /\{\s*"question"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"answer"\s*:\s*"((?:[^"\\]|\\.)*)"\s*\}/g;

    let match;
    while ((match = objectRegex.exec(text)) !== null) {
      try {
        // Sanitize before parsing
        const qRaw = match[1].replace(/\n/g, '\\n');
        const aRaw = match[2].replace(/\n/g, '\\n');

        const question = JSON.parse(`"${qRaw}"`);
        const answer = JSON.parse(`"${aRaw}"`);
        cards.push({ question, answer });
      } catch (e) {
        // Last resort fallback
        cards.push({ question: match[1], answer: match[2] });
      }
    }

    // 4. Text Format Fallback (Question: ... Answer: ...)
    // Matches "Question: <text> Answer: <text>" with optional newlines, bold markers, and case insensitivity
    // Also handles numbered lists like "1. **Card:** ... **Answer:** ..."
    const textRegex = /(?:^|\n)\s*(?:\d+\.\s*)?(?:\*\*)?(?:Card|Question)(?:\*\*)?:?\s*(.+?)\s*(?:\*\*)?Answer(?:\*\*)?:?\s*(.+?)(?=(?:\n\s*(?:\d+\.|\[Card|\*\*Card)|$))/gis;

    let textMatch;
    while ((textMatch = textRegex.exec(text)) !== null) {
      const question = textMatch[1].trim();
      const answer = textMatch[2].trim();
      if (question && answer) {
        cards.push({ question, answer });
      }
    }

    if (cards.length > 0) {
      return cards;
    }

    // 5. Last resort: Try to find any JSON objects in the text
    try {
      const matches = text.match(/\{[^{}]+\}/g);
      if (matches) {
        const results = matches.map(m => {
          try { return JSON.parse(m); } catch { return null; }
        }).filter(r => r && r.question && r.answer);

        if (results.length > 0) return results;
      }
    } catch (e) {
      // Ignore
    }

    console.error('Failed to parse JSON from AI response:', text.substring(0, 500) + '...');
    return [];
  }
}
