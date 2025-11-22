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

IMPORTANT: Return ONLY a valid JSON array. Each object must have these exact fields:
- "question": the front of the flashcard (a question or term)
- "answer": the back of the flashcard (the answer or definition)

Example format:
[
  {"question": "What is photosynthesis?", "answer": "The process by which plants convert light into energy"},
  {"question": "What is mitosis?", "answer": "Cell division that produces two identical daughter cells"}
]

Return ONLY the JSON array, no markdown, no explanation, no code blocks.`;

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
    const prompt = `Text: ${text.substring(0, 10000)}\n\nReturn ONLY a valid JSON array of objects with "question" and "answer" fields. No markdown.`;

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
    try {
      console.log('Attempting to parse:', text.substring(0, 200));
      // Remove markdown code blocks if present
      let cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

      // Try to find JSON array
      const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        try {
          const result = JSON.parse(arrayMatch[0]);
          console.log('Successfully parsed JSON array with', result.length, 'items');
          return result;
        } catch (e) {
          console.warn('Failed to parse matched array, trying to fix...');
        }
      }

      // Try to parse the whole text
      try {
        const result = JSON.parse(cleaned);
        console.log('Successfully parsed entire text');
        return result;
      } catch (e) {
        // If simple parse fails, try to fix common issues
        if (!cleaned.endsWith(']')) {
          if (cleaned.endsWith('}')) {
            cleaned += ']';
          } else if (cleaned.endsWith('"')) {
            cleaned += '}]';
          }
          try {
            const result = JSON.parse(cleaned);
            console.log('Successfully parsed fixed JSON');
            return result;
          } catch (e2) {
            // Continue to regex fallback
          }
        }
      }

      throw new Error('JSON parse failed');
    } catch (e) {
      console.error('Failed to parse JSON from AI response. Error:', e);
      console.log('Attempting regex fallback extraction...');

      // Regex fallback to extract objects looking like {"question": "...", "answer": "..."}
      const cards: any[] = [];
      // Match "question": "..." and "answer": "..." patterns
      // This is a simple heuristic and might need adjustment based on actual output
      const questionRegex = /"(?:question|front)"\s*:\s*"([^"]*)"/g;
      const answerRegex = /"(?:answer|back)"\s*:\s*"([^"]*)"/g;

      let qMatch;
      const questions = [];
      while ((qMatch = questionRegex.exec(text)) !== null) {
        questions.push(qMatch[1]);
      }

      let aMatch;
      const answers = [];
      while ((aMatch = answerRegex.exec(text)) !== null) {
        answers.push(aMatch[1]);
      }

      // Combine found questions and answers
      const count = Math.min(questions.length, answers.length);
      for (let i = 0; i < count; i++) {
        cards.push({
          question: questions[i],
          answer: answers[i]
        });
      }

      if (cards.length > 0) {
        console.log('Successfully extracted', cards.length, 'cards via regex');
        return cards;
      }

      return [];
    }
  }
}
