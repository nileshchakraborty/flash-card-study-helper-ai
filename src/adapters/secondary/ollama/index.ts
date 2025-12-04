import axios from 'axios';
import type { AIServicePort } from '../../../core/ports/interfaces.js';
import type { Flashcard, QuizQuestion } from '../../../core/domain/models.js';
import type { CacheService } from '../../../core/services/CacheService.js';
import { CacheService as CacheServiceClass } from '../../../core/services/CacheService.js';

export class OllamaAdapter implements AIServicePort {
  private baseUrl: string;
  private model: string;
  private cache?: CacheService<any>;

  constructor(cache?: CacheService<any>) {
    // const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV !== undefined;
    // On Vercel, we require OLLAMA_BASE_URL to be set for backend generation.
    // Otherwise, we expect the frontend to use WebLLM (client-side).
    this.baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    this.model = process.env.OLLAMA_MODEL || 'llama3.2:latest';
    this.cache = cache;
  }

  async generateFlashcards(topic: string, count: number): Promise<Flashcard[]> {
    // Check cache
    const cacheKey = `ollama:flashcards:${topic}:${count}`;
    if (this.cache) {
      const cached = this.cache.get(cacheKey);
      if (cached !== undefined) return cached;
    }

    const systemPrompt = `You are a helpful study assistant that creates educational flashcards for learning. You create QUESTIONS and ANSWERS, NOT code examples.`;
    const prompt = `Create exactly ${count} flashcards about "${topic}".

⚠️ CRITICAL RULES - FOLLOW EXACTLY:
1. Each flashcard = ONE question + ONE answer
2. Questions must be complete sentences ending with "?"
3. Answers must be 1-3 sentence explanations in plain English
4. NEVER include code snippets, variable names, or syntax in questions
5. NEVER copy/paste code as answers
6. Ask ABOUT concepts, not show code

✅ GOOD FLASHCARD EXAMPLES:
Q: "What does the append() method do in Python?"
A: "The append() method adds a single element to the end of a list. It modifies the list in-place and returns None."

Q: "How do you open and read a file safely in Python?"
A: "Use the 'with open(filename, mode) as f:' statement. This automatically closes the file even if errors occur, preventing resource leaks."

❌ BAD FLASHCARD EXAMPLES (DO NOT DO THIS):
Q: "_list = []"
A: "# create our list..."

Q: "with open(txt_file_path, 'r') as f:"
A: "for line in f: if ':' in line: ..."

JSON FORMAT:
- Return ONLY a valid JSON array
- Start with [ and end with ]
- No markdown, no code blocks, no explanations
- Format: [{"question": "...", "answer": "..."}]

Now create ${count} flashcards:`;

    const response = await this.callOllama(prompt, systemPrompt);
    console.log('Raw AI response:', response);
    const parsed = this.extractJSON(response);
    console.log('Parsed JSON:', parsed);

    // Handle both array of objects and array of strings
    let result: Flashcard[] = [];
    if (Array.isArray(parsed)) {
      result = parsed.map((item: any, index: number) => {
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

    // Store in cache
    if (this.cache && result.length > 0) {
      this.cache.set(cacheKey, result);
    }

    return result;
  }

  async generateFlashcardsFromText(text: string, topic: string, count: number, pageInfo?: any): Promise<Flashcard[]> {
    // Check cache
    const textHash = CacheServiceClass.hashKey(text.substring(0, 10000));
    const cacheKey = `ollama:flashcards-text:${textHash}:${topic}:${count}`;
    if (this.cache) {
      const cached = this.cache.get(cacheKey);
      if (cached !== undefined) return cached;
    }

    const systemPrompt = `You are a helpful study assistant creating educational flashcards. You explain concepts, you do NOT copy code.`;
    const prompt = `Text: ${text.substring(0, 10000)}

⚠️ TASK: Create ${count} educational flashcards about: ${topic}

⚠️ CRITICAL RULES:
1. Ask questions ABOUT the concepts in the text
2. Provide explanatory answers in plain English  
3. NEVER copy code snippets as questions or answers
4. Questions must end with "?"
5. Answers must be 1-3 sentences explaining the concept

✅ CORRECT EXAMPLE:
Q: "What is the purpose of the 'with' statement when working with files?"
A: "The 'with' statement ensures files are properly closed after use, even if errors occur. This prevents resource leaks."

❌ WRONG (DO NOT DO THIS):
Q: "with open(txt_file_path, 'r') as f:"
A: "for line in f: if ':' in line: question_list.append(line.rstrip())"

JSON FORMAT:
- Return ONLY: [{"question": "...", "answer": "..."}]
- No code blocks, no markdown, pure JSON array

Create ${count} flashcards now:`;

    const response = await this.callOllama(prompt, systemPrompt);
    const result = this.extractJSON(response).map((card: any, index: number) => ({
      id: `file-${Date.now()}-${index}`,
      front: card.question || card.front,
      back: card.answer || card.back,
      topic: topic,
      source: pageInfo ? { page: pageInfo.page } : undefined
    }));

    // Store in cache
    if (this.cache && result.length > 0) {
      this.cache.set(cacheKey, result);
    }

    return result;
  }

  async generateBriefAnswer(question: string, context: string): Promise<string> {
    const systemPrompt = "You are a concise tutor. Explain the answer simply.";
    const prompt = `Question: ${question} \nContext: ${context} \n\nProvide a brief, 2 - sentence explanation.`;
    return this.callOllama(prompt, systemPrompt);
  }

  async generateSummary(topic: string): Promise<string> {
    // Check cache
    const cacheKey = `ollama:summary:${topic}`;
    if (this.cache) {
      const cached = this.cache.get(cacheKey);
      if (cached !== undefined) return cached;
    }

    const systemPrompt = "You are a knowledgeable expert. Provide a concise summary.";
    const prompt = `Summarize what you know about "${topic}" in 3-4 sentences. Focus on key concepts and definitions.`;
    const result = await this.callOllama(prompt, systemPrompt);

    // Store in cache
    if (this.cache && result) {
      this.cache.set(cacheKey, result);
    }

    return result;
  }

  async generateSearchQuery(topic: string, parentTopic?: string): Promise<string> {
    // Check cache
    const cacheKey = `ollama:query:${topic}:${parentTopic || ''}`;
    if (this.cache) {
      const cached = this.cache.get(cacheKey);
      if (cached !== undefined) return cached;
    }

    const systemPrompt = "You are a search engine expert. Generate a single, optimal Google search query.";
    let prompt = `Generate a search query for google search to get best knowledge about ${topic}. Return ONLY the query string, no quotes or explanation.`;

    if (parentTopic) {
      prompt = `Generate a search query for "${topic}" specifically in the context of "${parentTopic}". 
      Example: If topic is "Streams" and parent is "Java", query should be "Java Streams API tutorial".
      Return ONLY the query string, no quotes or explanation.`;
    }

    const response = await this.callOllama(prompt, systemPrompt);
    const result = response.replace(/^"|"$/g, '').trim();

    // Store in cache
    if (this.cache && result) {
      this.cache.set(cacheKey, result);
    }

    return result;
  }

  async generateSubTopics(topic: string): Promise<string[]> {
    // Check cache
    const cacheKey = `ollama:subtopics:${topic}`;
    if (this.cache) {
      const cached = this.cache.get(cacheKey);
      if (cached !== undefined) return cached;
    }

    const systemPrompt = "You are an expert curriculum designer.";
    const prompt = `Identify 3-5 advanced sub-topics for "${topic}" that would be suitable for a deep dive study session.
    
    Return ONLY a valid JSON array of strings. Example: ["Subtopic 1", "Subtopic 2", "Subtopic 3"]`;

    const response = await this.callOllama(prompt, systemPrompt);
    const result = this.extractJSON(response);

    // Store in cache
    if (this.cache && result && result.length > 0) {
      this.cache.set(cacheKey, result);
    }

    return result;
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
    // Check cache
    const flashcardIds = flashcards.map(fc => fc.id).sort().join(',');
    const cacheKey = `ollama:quiz:flashcards:${CacheServiceClass.hashKey(flashcardIds)}:${count}`;

    if (this.cache) {
      const cached = this.cache.get(cacheKey);
      if (cached !== undefined) return cached;
    }

    const systemPrompt = "You are an expert quiz designer creating multiple-choice tests based on flashcard content.";

    // Create a text representation of the flashcards
    const cardsText = flashcards.map(c => `Q: ${c.front}\nA: ${c.back}`).join('\n\n');

    const prompt = `
        Here are the flashcards to test:
        ${cardsText}
        
        Create ${count} multiple-choice questions based ONLY on these flashcards.
        
        CRITICAL REQUIREMENTS:
        1. Each question MUST have exactly 4 options: 1 correct answer + 3 plausible wrong answers (distractors)
        2. For True/False questions, use only 2 options: ["True", "False"]
        3. The "correctAnswer" MUST be one of the "options" array
        4. Make distractors plausible but clearly wrong to someone who studied the material
        5. Mix difficulty: Easy (direct recall), Medium (application), Hard (synthesis)
        6. Questions should test understanding, not just memorization
        
        DETECTION RULES:
        - If a question is inherently binary (yes/no, true/false, exists/doesn't exist), use only 2 options
        - For all other questions, provide 4 options
        
        JSON Format (return ONLY valid JSON, no markdown):
        [
          {
            "id": "q1",
            "question": "What is the capital of France?",
            "options": ["Paris", "London", "Berlin", "Madrid"],
            "correctAnswer": "Paris",
            "explanation": "Paris has been the capital of France since 987 AD",
            "difficulty": "easy"
          },
          {
            "id": "q2",
            "question": "Is Python a compiled language?",
            "options": ["True", "False"],
            "correctAnswer": "False",
            "explanation": "Python is an interpreted language, not compiled",
            "difficulty": "medium"
          }
        ]
        
        Create ${count} questions now:
        `;

    const response = await this.callOllama(prompt, systemPrompt);
    const result = this.extractJSON(response);

    // Store in cache
    if (this.cache && result.length > 0) {
      this.cache.set(cacheKey, result);
    }

    return result;
  }

  /**
   * Generate quiz questions directly from a topic (without flashcards)
   */
  async generateQuizFromTopic(topic: string, count: number, context?: string): Promise<QuizQuestion[]> {
    // Check cache
    const contextHash = context ? CacheServiceClass.hashKey(context.substring(0, 1000)) : '';
    const cacheKey = `ollama:quiz:topic:${topic}:${count}:${contextHash}`;

    if (this.cache) {
      const cached = this.cache.get(cacheKey);
      if (cached !== undefined) return cached;
    }

    const systemPrompt = "You are an expert quiz designer creating educational multiple-choice tests.";

    const prompt = `
        Create ${count} multiple-choice quiz questions about: "${topic}"
        ${context ? `\n\nContext/Background Information:\n${context}\n` : ''}
        
        CRITICAL REQUIREMENTS:
        1. Each question MUST have exactly 4 options: 1 correct answer + 3 plausible wrong answers (distractors)
        2. For True/False questions, use only 2 options: ["True", "False"]
        3. The "correctAnswer" MUST be one of the "options" array
        4. Make distractors challenging but clearly wrong to someone who knows the topic
        5. Mix difficulty levels: Easy, Medium, Hard
        6. Questions should test understanding and application, not just definitions
        
        DETECTION RULES:
        - If a question is inherently binary (yes/no, true/false, did X happen, is X true), use only 2 options
        - For all other questions (what, how, which one, identify, etc.), provide 4 options
        
        JSON Format (return ONLY valid JSON, no markdown, no code blocks):
        [
          {
            "id": "q1",
            "question": "What is the primary purpose of X?",
            "options": ["Option A (correct)", "Option B (plausible)", "Option C (plausible)", "Option D (plausible)"],
            "correctAnswer": "Option A (correct)",
            "explanation": "Brief explanation why this is correct and others are wrong",
            "difficulty": "medium"
          },
          {
            "id": "q2",
            "question": "Is statement Y true?",
            "options": ["True", "False"],
            "correctAnswer": "False",
            "explanation": "Explanation of why it's false",
            "difficulty": "easy"
          }
        ]
        
        Create ${count} questions now:
        `;

    const response = await this.callOllama(prompt, systemPrompt);
    const result = this.extractJSON(response);

    // Store in cache
    if (this.cache && result.length > 0) {
      this.cache.set(cacheKey, result);
    }

    return result;
  }

  private async callOllama(prompt: string, system: string): Promise<string> {
    try {
      const headers: Record<string, string> = {};
      if (process.env.OLLAMA_API_KEY) {
        headers['Authorization'] = `Bearer ${process.env.OLLAMA_API_KEY}`;
      }

      const res = await axios.post(`${this.baseUrl}/api/generate`, {
        model: this.model,
        prompt: `${system}\n\n${prompt}`,
        stream: false
      }, { headers });
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

    // Regex to capture {"question": "...", "answer": "..."} or {"front": "...", "back": "..."} patterns
    // Handles escaped quotes and newlines
    const objectRegex = /\{\s*"(?:question|front)"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"(?:answer|back)"\s*:\s*"((?:[^"\\]|\\.)*)"\s*\}/g;

    let match;
    while ((match = objectRegex.exec(text)) !== null) {
      try {
        // Sanitize before parsing
        const qRaw = (match[1] || '').replace(/\n/g, '\\n');
        const aRaw = (match[2] || '').replace(/\n/g, '\\n');

        const question = JSON.parse(`"${qRaw}"`);
        const answer = JSON.parse(`"${aRaw}"`);
        cards.push({ question, answer });
      } catch (e) {
        // Last resort fallback
        cards.push({ question: match[1], answer: match[2] });
      }
    }

    // Also try to match loose "front": "..." "back": "..." patterns (not in JSON object)
    if (cards.length === 0) {
      const looseRegex = /"front"\s*:\s*"((?:[^"\\]|\\.)*)"\s*[,\s]*"back"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
      let looseMatch;
      while ((looseMatch = looseRegex.exec(text)) !== null) {
        try {
          const qRaw = (looseMatch[1] || '').replace(/\n/g, '\\n');
          const aRaw = (looseMatch[2] || '').replace(/\n/g, '\\n');
          const question = JSON.parse(`"${qRaw}"`);
          const answer = JSON.parse(`"${aRaw}"`);
          cards.push({ question, answer });
        } catch (e) {
          cards.push({ question: looseMatch[1], answer: looseMatch[2] });
        }
      }
    }

    // 4. Text Format Fallback (Question: ... Answer: ...)
    // Matches "Question: <text> Answer: <text>" with optional newlines, bold markers, and case insensitivity
    // Also handles numbered lists like "1. **Card:** ... **Answer:** ..."
    const textRegex = /(?:^|\n)\s*(?:\d+\.\s*)?(?:\*\*)?(?:Card|Question)(?:\*\*)?:?\s*(.+?)\s*(?:\*\*)?Answer(?:\*\*)?:?\s*(.+?)(?=(?:\n\s*(?:\d+\.|\[Card|\*\*Card)|$))/gis;

    let textMatch;
    while ((textMatch = textRegex.exec(text)) !== null) {
      const question = (textMatch[1] || '').trim();
      const answer = (textMatch[2] || '').trim();
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
          try {
            const parsed = JSON.parse(m);
            // Check for both question/answer and front/back formats
            if ((parsed.question && parsed.answer) || (parsed.front && parsed.back)) {
              return {
                question: parsed.question || parsed.front,
                answer: parsed.answer || parsed.back
              };
            }
            return null;
          } catch { return null; }
        }).filter(r => r !== null);

        if (results.length > 0) return results;
      }
    } catch (e) {
      // Ignore
    }

    console.error('Failed to parse JSON from AI response:', text.substring(0, 500) + '...');
    return [];
  }
}
