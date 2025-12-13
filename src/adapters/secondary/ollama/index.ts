import axios from 'axios';
import type { Flashcard, QuizQuestion } from '../../../core/domain/models.js';
import type { CacheService } from '../../../core/services/CacheService.js';
import { CacheService as CacheServiceClass } from '../../../core/services/CacheService.js';
import type { LLMAdapter } from '../../../core/services/AdapterManager.js';

export class OllamaAdapter implements LLMAdapter {
  readonly name = 'ollama';
  private baseUrl: string;
  private model: string;
  private cache?: CacheService<any>;

  // Warmup & cold start tracking
  private isWarmedUp = false;
  private isWarmingUp = false;
  private lastCallTime = 0;
  private static readonly COLD_START_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
  private static readonly COLD_START_TIMEOUT_MS = 3 * 60 * 1000; // 3 min timeout for cold starts

  constructor(cache?: CacheService<any>) {
    // Normalize OLLAMA_BASE_URL: strip trailing slashes and /api/ suffix
    // Support generic LLM_* variables first, fallback to OLLAMA_*
    const rawUrl = process.env.LLM_BASE_URL || process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    this.baseUrl = this.normalizeBaseUrl(rawUrl);
    this.model = process.env.LLM_MODEL || process.env.OLLAMA_MODEL || 'llama3.2:latest';
    this.cache = cache;
  }

  /**
   * Normalize base URL by removing trailing slashes and `/api/` suffix
   * Examples:
   *   https://ollama.com/api/ -> https://ollama.com
   *   http://localhost:11434/ -> http://localhost:11434
   *   https://ollama.com/api -> https://ollama.com
   */
  private normalizeBaseUrl(url: string): string {
    let normalized = url.trim();

    // Remove trailing slashes
    while (normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }

    // Remove /api or /api/ suffix (we'll add it back in API calls)
    if (normalized.endsWith('/api')) {
      normalized = normalized.slice(0, -4);
    }

    return normalized;
  }

  /**
   * Check if Ollama is available (quick health check)
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/tags`, { timeout: 2000 });
      return response.status === 200;
    } catch (error) {
      console.log('[OllamaAdapter] Not available:', error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  /**
   * Get the current warmup status for the LLM
   */
  getStatus(): { isWarmedUp: boolean; isWarmingUp: boolean; model: string } {
    return {
      isWarmedUp: this.isWarmedUp,
      isWarmingUp: this.isWarmingUp,
      model: this.model
    };
  }

  /**
   * Check if this is a cold start (no recent LLM activity)
   */
  private isColdStart(): boolean {
    if (!this.isWarmedUp) return true;
    const timeSinceLastCall = Date.now() - this.lastCallTime;
    return timeSinceLastCall > OllamaAdapter.COLD_START_THRESHOLD_MS;
  }

  /**
   * Pre-warm the LLM model by sending a small test prompt.
   * This loads the model into GPU/RAM for faster subsequent calls.
   */
  async warmup(): Promise<{ success: boolean; durationMs: number; error?: string }> {
    if (this.isWarmingUp) {
      console.log('[OllamaAdapter] Warmup already in progress...');
      return { success: false, durationMs: 0, error: 'Warmup already in progress' };
    }

    if (this.isWarmedUp && !this.isColdStart()) {
      console.log('[OllamaAdapter] Model already warm, skipping warmup.');
      return { success: true, durationMs: 0 };
    }

    this.isWarmingUp = true;
    const start = Date.now();

    try {
      console.log(`[OllamaAdapter] 🔥 Warming up model "${this.model}"...`);

      // Send a small test prompt to load the model
      await axios.post(`${this.baseUrl}/api/generate`, {
        model: this.model,
        prompt: 'Say "ready" in one word.',
        stream: false
      }, {
        timeout: OllamaAdapter.COLD_START_TIMEOUT_MS
      });

      const durationMs = Date.now() - start;
      this.isWarmedUp = true;
      this.lastCallTime = Date.now();
      this.isWarmingUp = false;

      console.log(`[OllamaAdapter] ✅ Warmup complete in ${durationMs}ms`);
      return { success: true, durationMs };

    } catch (error: any) {
      const durationMs = Date.now() - start;
      this.isWarmingUp = false;
      const errorMsg = error?.message || 'Unknown error';
      console.error(`[OllamaAdapter] ❌ Warmup failed after ${durationMs}ms: ${errorMsg}`);
      return { success: false, durationMs, error: errorMsg };
    }
  }

  async generateFlashcards(topic: string, count: number, llmConfig?: any): Promise<Flashcard[]> {
    // Check cache
    const cacheKey = `ollama:flashcards:${topic}:${count}`;
    if (this.cache && !llmConfig) { // Skip cache if custom config
      const cached = await this.cache.get(cacheKey);
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

    const response = await this.callOllama(prompt, systemPrompt, { ...llmConfig, format: 'json' });
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

    // Store in cache (only if standard config)
    if (this.cache && result.length > 0 && !llmConfig) {
      await this.cache.set(cacheKey, result);
    }

    return result;
  }

  async generateFlashcardsFromText(text: string, topic: string, count: number, pageInfo?: any, llmConfig?: any): Promise<Flashcard[]> {
    // Check cache
    const textHash = CacheServiceClass.hashKey(text.substring(0, 10000));
    const cacheKey = `ollama:flashcards-text:${textHash}:${topic}:${count}`;
    if (this.cache && !llmConfig) {
      const cached = await this.cache.get(cacheKey);
      if (cached !== undefined) return cached;
    }

    const systemPrompt = `You are a careful study assistant. You must ONLY use the provided source text to create flashcards. Do not add outside knowledge.`;
    const prompt = `SOURCE TEXT (truncated to 10k chars):
${text.substring(0, 10000)}

TASK: Create ${count} educational flashcards grounded strictly in the source text above.

RULES:
1) Every question must reflect a fact/concept present in the source text (no external facts).
2) Answers must be 1-3 sentences, concise, and derived from the source text.
3) Questions end with "?".
4) If a detail is unclear or absent in the text, skip it.
5) Output JSON only: [{"question": "...", "answer": "..."}]

Begin now.`;

    const response = await this.callOllama(prompt, systemPrompt, { ...llmConfig, format: 'json' });
    const result = this.extractJSON(response).map((card: any, index: number) => ({
      id: `file-${Date.now()}-${index}`,
      front: card.question || card.front,
      back: card.answer || card.back,
      topic: topic,
      source: pageInfo ? { page: pageInfo.page } : undefined
    }));

    // Store in cache
    if (this.cache && result.length > 0 && !llmConfig) {
      await this.cache.set(cacheKey, result);
    }

    return result;
  }

  async generateBriefAnswer(question: string, context: string, llmConfig?: any): Promise<string> {
    const systemPrompt = "You are a concise tutor. Explain the answer simply.";
    const prompt = `Question: ${question} \nContext: ${context} \n\nProvide a brief, 2 - sentence explanation.`;
    return this.callOllama(prompt, systemPrompt, llmConfig);
  }

  async generateSummary(topic: string, llmConfig?: any): Promise<string> {
    // Check cache
    const cacheKey = `ollama:summary:${topic}`;
    if (this.cache && !llmConfig) {
      const cached = await this.cache.get(cacheKey);
      if (cached !== undefined) return cached;
    }

    const systemPrompt = "You are a knowledgeable expert. Provide a concise summary.";
    const prompt = `Summarize what you know about "${topic}" in 3-4 sentences. Focus on key concepts and definitions.`;
    const result = await this.callOllama(prompt, systemPrompt, llmConfig);

    // Store in cache
    if (this.cache && result && !llmConfig) {
      await this.cache.set(cacheKey, result);
    }

    return result;
  }

  async generateSearchQuery(topic: string, parentTopic?: string, llmConfig?: any): Promise<string> {
    // Check cache
    const cacheKey = `ollama:query:${topic}:${parentTopic || ''}`;
    if (this.cache && !llmConfig) {
      const cached = await this.cache.get(cacheKey);
      if (cached !== undefined) return cached;
    }

    const systemPrompt = "You are a search engine expert. Generate a single, optimal Google search query.";
    let prompt = `Generate a search query for google search to get best knowledge about ${topic}. Return ONLY the query string, no quotes or explanation.`;

    if (parentTopic) {
      prompt = `Generate a search query for "${topic}" specifically in the context of "${parentTopic}". 
      Example: If topic is "Streams" and parent is "Java", query should be "Java Streams API tutorial".
      Return ONLY the query string, no quotes or explanation.`;
    }

    const response = await this.callOllama(prompt, systemPrompt, llmConfig);
    const result = response.replace(/^"|"$/g, '').trim();

    // Store in cache
    if (this.cache && result && !llmConfig) {
      await this.cache.set(cacheKey, result);
    }

    return result;
  }

  async generateSubTopics(topic: string, llmConfig?: any): Promise<string[]> {
    // Check cache
    const cacheKey = `ollama:subtopics:${topic}`;
    if (this.cache && !llmConfig) {
      const cached = await this.cache.get(cacheKey);
      if (cached !== undefined) return cached;
    }

    const systemPrompt = "You are an expert curriculum designer.";
    const prompt = `Identify 3-5 advanced sub-topics for "${topic}" that would be suitable for a deep dive study session.
    
    Return ONLY a valid JSON array of strings. Example: ["Subtopic 1", "Subtopic 2", "Subtopic 3"]`;

    const response = await this.callOllama(prompt, systemPrompt, { ...llmConfig, format: 'json' });
    const result = this.extractJSON(response);

    // Store in cache
    if (this.cache && result && result.length > 0 && !llmConfig) {
      await this.cache.set(cacheKey, result);
    }

    return result;
  }

  async generateAdvancedQuiz(previousResults: any, mode: 'harder' | 'remedial', context?: string, llmConfig?: any): Promise<QuizQuestion[]> {
    const { topic, wrongAnswers } = previousResults;
    let systemPrompt = '';
    let prompt = '';

    if (mode === 'harder') {
      systemPrompt = `You are an expert examiner. Create a challenging quiz about: ${topic}.`;
      prompt = `Create 5 advanced multiple-choice questions.${context ? `\n\nUse this context for inspiration:\n${context.substring(0, 2000)}` : ''}\n\nReturn ONLY a JSON array with "id", "question", "options"(array), "correctAnswer", "explanation".`;
    } else {
      systemPrompt = `You are a patient tutor. Create a remedial quiz.`;
      prompt = `Student missed: ${wrongAnswers.join(', ')}. Create 5 questions to reinforce these concepts. Return ONLY a JSON array with "id", "question", "options"(array), "correctAnswer", "explanation".`;
    }

    const response = await this.callOllama(prompt, systemPrompt, { ...llmConfig, format: 'json' });
    const result = this.extractJSON(response);

    // Ensure option count for advanced quizzes too
    return this.ensureOptionCount(result);
  }

  async generateQuizFromFlashcards(flashcards: Flashcard[], count: number, llmConfig?: any): Promise<QuizQuestion[]> {
    // Check cache
    const flashcardIds = flashcards.map(fc => fc.id).sort().join(',');
    const cacheKey = `ollama:quiz:flashcards:${CacheServiceClass.hashKey(flashcardIds)}:${count}`;

    if (this.cache && !llmConfig) {
      const cached = await this.cache.get(cacheKey);
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
        4. DISTRACTOR RULES:
           - MUST be related to the topic (e.g., if asking about Python lists, distractors should be about other Python data structures or list methods, not about cooking or history).
           - MUST be clearly incorrect for the specific question.
           - AVOID "All of the above" or "None of the above".
           - HARD MODE: Distractors should be plausible misconceptions or semantically similar to the correct answer. For example, if the answer is "ArrayList", distractors could be "LinkedList", "Vector", "Array" (related concepts), NOT "String" or "Integer" (too easy).
        5. Mix difficulty: Easy (direct recall), Medium (application), Hard (synthesis)
        6. Questions should test understanding, not just memorization
        7. STRICT VARIETY RULE: You MUST generate UNIQUE options for every single question. Do NOT copy-paste the same set of options. If Question 1 has options [A, B, C, D], Question 2 MUST have completely different options [E, F, G, H].
        8. NEGATIVE CONSTRAINT: Never use "Option A", "Option B" etc. as placeholders. Use real content.
        
        9. CONCISENESS RULE: Keep options short and punchy (max 10-15 words). Do NOT use long paragraphs as options.
        10. HOMOGENEITY RULE: All options must be grammatically and structurally similar. If the correct answer is a verb phrase, all distractors must be verb phrases.
        11. NO HINTS RULE: Do NOT repeat keywords from the question in the correct answer if they are not present in the distractors. If the question asks "What is the primary benefit...", do NOT start the answer with "The primary benefit is...". Just state the benefit.
        
        DETECTION RULES:
        - If a question is inherently binary (yes/no, true/false), use only 2 options.
        - FOR ALL OTHER QUESTIONS, YOU MUST PROVIDE EXACTLY 4 OPTIONS. NO EXCEPTIONS.
        
        JSON Format (return ONLY valid JSON, no markdown):
        [
          {
            "id": "q1",
            "question": "What is the capital of France?",
            "options": ["Paris", "London", "Berlin", "Madrid"],
            "correctAnswer": "Paris",
            "explanation": "Python is an interpreted language, not compiled",
            "difficulty": "medium"
          }
        ]
        
        Create ${count} questions now:
        `;

    const start = Date.now();
    console.log(`[OllamaAdapter] Generating quiz from flashcards (${count} questions)...`);
    const response = await this.callOllama(prompt, systemPrompt, { ...llmConfig, format: 'json' });
    console.log(`[OllamaAdapter] Quiz generation completed in ${Date.now() - start}ms`);
    console.log(`[OllamaAdapter] Raw LLM response (first 500 chars):`, response.substring(0, 500));

    const result = this.extractJSON(response);
    console.log(`[OllamaAdapter] Extracted ${result.length} questions from LLM response`);

    // Check if questions have valid structure
    const validQuestions = result.filter((q: any) =>
      q.question &&
      q.correctAnswer &&
      q.options &&
      Array.isArray(q.options) &&
      q.options.length >= 2
    );

    // If LLM returned good data, verify and return
    if (validQuestions.length >= Math.min(count, 2)) {
      console.log(`[OllamaAdapter] ${validQuestions.length} valid questions found, proceeding with verification`);
      const topic = flashcards[0]?.topic || 'General Knowledge';
      const verified = await this.verifyAndRefineQuiz(validQuestions, topic, llmConfig);
      const finalQuiz = this.ensureOptionCount(verified);

      // Cache if successful
      if (this.cache && finalQuiz.length > 0 && !llmConfig) {
        await this.cache.set(cacheKey, finalQuiz);
      }
      return finalQuiz;
    }

    // FALLBACK: LLM failed to generate valid quiz - convert flashcards directly
    console.log(`[OllamaAdapter] LLM returned invalid quiz data. Using direct flashcard conversion fallback.`);
    const fallbackQuiz = this.convertFlashcardsToQuiz(flashcards, count);

    // Cache the fallback result
    if (this.cache && fallbackQuiz.length > 0 && !llmConfig) {
      await this.cache.set(cacheKey, fallbackQuiz);
    }

    return fallbackQuiz;
  }

  /**
   * Fallback method: Convert flashcards directly to quiz questions
   * Uses flashcard.front as question, flashcard.back as correct answer,
   * and generates distractors from other flashcards' answers
   */
  private convertFlashcardsToQuiz(flashcards: Flashcard[], count: number): QuizQuestion[] {
    console.log(`[OllamaAdapter] Converting ${flashcards.length} flashcards to ${count} quiz questions`);

    // Shuffle and select flashcards
    const shuffled = this.shuffleArray([...flashcards]);
    const selected = shuffled.slice(0, Math.min(count, flashcards.length));

    // Collect all possible distractors (other flashcard backs)
    const allAnswers = flashcards.map(fc => fc.back);

    return selected.map((fc, idx) => {
      const correctAnswer = fc.back;

      // Generate distractors from other flashcard answers
      const distractors = allAnswers
        .filter(a => a.toLowerCase().trim() !== correctAnswer.toLowerCase().trim())
        .slice(0, 3);

      // If we don't have enough distractors from flashcards, add generic ones
      const genericDistractors = [
        `An alternative to ${fc.topic || 'this concept'}`,
        `A different interpretation`,
        `Not applicable in this context`,
        `Requires further clarification`
      ];

      while (distractors.length < 3 && genericDistractors.length > 0) {
        const d = genericDistractors.shift();
        if (d && !distractors.includes(d)) {
          distractors.push(d);
        }
      }

      // Combine and shuffle options
      const options = this.shuffleArray([correctAnswer, ...distractors.slice(0, 3)]);

      return {
        id: `fc-${idx + 1}`,
        question: fc.front,
        options,
        correctAnswer,
        explanation: `This answer comes from the flashcard about ${fc.topic || 'this topic'}.`,
        difficulty: 'medium' as const
      };
    });
  }

  async verifyAndRefineQuiz(quiz: QuizQuestion[], topic: string, llmConfig?: any): Promise<QuizQuestion[]> {
    const systemPrompt = "You are a strict quality control editor for educational content.";
    let prompt = `
      Review the following multiple - choice quiz about "${topic}":
      ${JSON.stringify(quiz, null, 2)}

    TASK:
    1. Check if "correctAnswer" is actually correct.
      2. Check if distractors(wrong options) are RELATED to the topic but CLEARLY WRONG.
      3. If a distractor is completely unrelated(e.g., "Banana" for a coding question), REPLACE it with a plausible technical term that is related to the topic.
      4. Ensure there are no duplicate options within a question.
      5. Ensure DIVERSITY: Check that different questions do not share the exact same set of options.If they do, change the distractors for one of them to be unique.
      6. Ensure COUNT: Each question MUST have exactly 4 options(unless it's True/False). If a question has fewer than 4 options, GENERATE MISSING DISTRACTORS to reach exactly 4.
      7. Ensure QUALITY: Distractors should be "close" to the correct answer.If the answer is a specific function name, distractors should be other similar function names.
      8. Ensure CONCISENESS: If options are too long(sentences / paragraphs), shorten them to key phrases.
      9. FIX HOMOGENEITY: If one option stands out(e.g.much longer / shorter or different grammatical structure), REWRITE it to match the style of the others.
      10. REMOVE HINTS: If the correct answer repeats keywords from the question, REPHRASE it to use synonyms so it's not a dead giveaway.

      Return the CORRECTED JSON Object with a "questions" key.
      Example: { "questions": [...] }
    `;

    let currentQuiz = quiz;
    const MAX_RETRIES = 1;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        // 1. Run AI Verification
        console.log(`[OllamaAdapter] Starting verification attempt ${attempt} for topic "${topic}"...`);
        const start = Date.now();
        const response = await this.callOllama(prompt, systemPrompt, { ...llmConfig, format: 'json' });
        console.log(`[OllamaAdapter] Verification attempt ${attempt} completed in ${Date.now() - start} ms`);
        let verified = this.extractJSON(response);

        // Unwrap { questions: [...] } if present
        if (verified && verified.length === 1 && verified[0].questions && Array.isArray(verified[0].questions)) {
          verified = verified[0].questions;
        } else if (verified && !Array.isArray(verified) && verified.questions) {
          // Just in case extractJSON returns object directly (future proofing)
          verified = verified.questions;
        }

        if (verified && verified.length > 0) {
          currentQuiz = this.ensureOptionCount(verified);
        }

        // 2. Code-level Diversity Check
        const allOptions = new Set<string>();
        let hasDuplicates = false;

        for (const q of currentQuiz) {
          const optionsStr = [...q.options].sort().join('|');
          if (allOptions.has(optionsStr)) {
            hasDuplicates = true;
            break;
          }
          allOptions.add(optionsStr);
        }

        if (!hasDuplicates) {
          console.log(`Quiz verification passed on attempt ${attempt}.`);
          return currentQuiz;
        }

        console.warn(`Attempt ${attempt}: Found duplicate options across questions.Retrying...`);
        prompt += `\n\nCRITICAL ERROR: You generated questions with IDENTICAL options.This is forbidden.REWRITE the options for questions that share the same choices so they are unique.`;

      } catch (e) {
        console.warn(`Quiz verification attempt ${attempt} failed: `, e);
      }
    }

    console.warn('Max retries reached. Returning best effort.');
    return this.ensureOptionCount(currentQuiz);
  }

  private ensureOptionCount(quiz: QuizQuestion[]): QuizQuestion[] {
    return quiz.map((q, qIndex) => {
      // Ensure options array exists
      let options = (q.options && Array.isArray(q.options)) ? [...q.options] : [];
      const correctAnswer = q.correctAnswer || '';

      if (options.length === 0) {
        console.warn(`Question ${qIndex + 1} ("${q.id || 'unknown'}") has no options.`);
      }

      // Skip True/False questions
      const isBoolean = options.length === 2 &&
        options.some(o => o?.toLowerCase() === 'true') &&
        options.some(o => o?.toLowerCase() === 'false');

      if (isBoolean) return { ...q, options };

      // STEP 1: Ensure correctAnswer is in options
      const seenLower = new Set<string>();
      const uniqueOptions: string[] = [];

      // Add correctAnswer FIRST if valid
      if (correctAnswer && typeof correctAnswer === 'string' && correctAnswer.trim()) {
        const correctLower = correctAnswer.toLowerCase().trim();
        uniqueOptions.push(correctAnswer);
        seenLower.add(correctLower);
      }

      // Add other options, removing duplicates
      for (const opt of options) {
        if (!opt || typeof opt !== 'string') continue;
        const normalized = opt.toLowerCase().trim();
        if (normalized && !seenLower.has(normalized)) {
          seenLower.add(normalized);
          uniqueOptions.push(opt);
        }
      }

      if (uniqueOptions.length < options.length) {
        console.warn(`Question ${qIndex + 1}: Removed ${options.length - uniqueOptions.length + (correctAnswer ? 1 : 0)} duplicate options.`);
      }

      // STEP 2: Generate topic-relevant fallbacks if we don't have enough options
      // Extract context from the question itself
      const questionText = q.question || '';
      const topic = this.extractTopicFromQuestion(questionText);

      // Topic-aware fallbacks based on question content
      const topicalFallbacks = this.generateTopicalFallbacks(topic, correctAnswer, questionText, seenLower);

      // Add topical fallbacks first
      for (const fallback of topicalFallbacks) {
        if (uniqueOptions.length >= 4) break;
        const fallbackLower = fallback.toLowerCase().trim();
        if (!seenLower.has(fallbackLower)) {
          uniqueOptions.push(fallback);
          seenLower.add(fallbackLower);
        }
      }

      // STEP 3: Last resort - generic fallbacks
      const genericFallbacks = [
        "None of the above",
        "All of the above",
        "Cannot be determined from the given information",
        "The answer depends on context"
      ];

      for (const fallback of genericFallbacks) {
        if (uniqueOptions.length >= 4) break;
        const fallbackLower = fallback.toLowerCase().trim();
        if (!seenLower.has(fallbackLower)) {
          uniqueOptions.push(fallback);
          seenLower.add(fallbackLower);
        }
      }

      // Shuffle options so correctAnswer isn't always first
      const shuffled = this.shuffleArray([...uniqueOptions]);

      if (shuffled.length < 4) {
        console.warn(`Question ${qIndex + 1} has only ${shuffled.length} unique options after all fallbacks.`);
      }

      // Ensure correctAnswer is still valid after processing
      let finalCorrectAnswer = correctAnswer;
      if (!shuffled.some(o => o.toLowerCase().trim() === correctAnswer.toLowerCase().trim())) {
        console.error(`Question ${qIndex + 1}: correctAnswer "${correctAnswer}" not in final options!`);
        // Force add it
        if (correctAnswer) {
          shuffled[0] = correctAnswer;
          finalCorrectAnswer = correctAnswer;
        }
      }

      return { ...q, options: shuffled, correctAnswer: finalCorrectAnswer };
    });
  }

  private extractTopicFromQuestion(question: string): string {
    // Extract key nouns/concepts from the question
    const words = question.toLowerCase()
      .replace(/[?.,!]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3)
      .filter(w => !['what', 'which', 'where', 'when', 'does', 'have', 'this', 'that', 'they', 'there', 'about', 'from'].includes(w));
    return words.slice(0, 3).join(' ') || 'general';
  }

  private generateTopicalFallbacks(topic: string, correctAnswer: string, question: string, existing: Set<string>): string[] {
    // Generate plausible distractor answers based on question context
    const fallbacks: string[] = [];

    // Extract key concepts from question and answer
    const questionWords = question.toLowerCase()
      .replace(/[?.,!'"]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 4 && !['what', 'which', 'where', 'when', 'does', 'have', 'this', 'that', 'they', 'there', 'about', 'from', 'with', 'your', 'their', 'would', 'could', 'should', 'being'].includes(w));

    const answerWords = correctAnswer.toLowerCase()
      .replace(/[?.,!'"]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3);

    const topicWords = topic.split(' ').filter(w => w.length > 2);

    // Create varied distractors based on the topic and question
    const templates = [
      // Negate or modify the correct answer concept
      correctAnswer ? `Not ${correctAnswer.split(' ').slice(0, 3).join(' ')}` : null,
      // Use question keywords with different context
      questionWords.length > 0 ? `A concept unrelated to ${questionWords[0]}` : null,
      // Topic variations
      topicWords.length > 0 ? `An alternative approach to ${topicWords.join(' ')}` : null,
      // Answer word variations
      answerWords.length > 1 ? `${answerWords[1] || answerWords[0]} in a different context` : null,
      // Generic but contextual
      `A common misunderstanding about ${topic || 'this topic'}`,
      `An outdated view on ${questionWords.slice(-2).join(' ') || topic}`,
      `The opposite interpretation`,
      `A similar but incorrect concept`
    ].filter(t => t !== null) as string[];

    for (const template of templates) {
      const lower = template.toLowerCase().trim();
      if (template && !existing.has(lower)) {
        fallbacks.push(template);
        existing.add(lower);
      }
    }

    return fallbacks;
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled: T[] = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = shuffled[i] as T;
      shuffled[i] = shuffled[j] as T;
      shuffled[j] = temp;
    }
    return shuffled;
  }

  /**
   * Generate quiz questions directly from a topic (without flashcards)
   */
  async generateQuizFromTopic(topic: string, count: number, context?: string, llmConfig?: any): Promise<QuizQuestion[]> {
    // Check cache
    const contextHash = context ? CacheServiceClass.hashKey(context.substring(0, 1000)) : '';
    const cacheKey = `ollama: quiz: topic:${topic}:${count}:${contextHash} `;

    if (this.cache && !llmConfig) {
      const cached = await this.cache.get(cacheKey);
      if (cached !== undefined) return cached;
    }

    const systemPrompt = "You are an expert quiz designer creating educational multiple-choice tests.";

    const prompt = `
        Create ${count} multiple - choice quiz questions about: "${topic}"
        ${context ? `\n\nContext/Background Information:\n${context}\n` : ''}
        
        CRITICAL REQUIREMENTS:
    1. Each question MUST have exactly 4 options: 1 correct answer + 3 plausible wrong answers(distractors)
    2. For True / False questions, use only 2 options: ["True", "False"]
    3. The "correctAnswer" MUST be one of the "options" array
    4. Make distractors challenging but clearly wrong to someone who knows the topic
    5. Mix difficulty levels: Easy, Medium, Hard
    6. Questions should test understanding and application, not just definitions
        
        DETECTION RULES:
    - If a question is inherently binary(yes / no, true / false, did X happen, is X true), use only 2 options
      - For all other questions(what, how, which one, identify, etc.), provide 4 options
        
        JSON Format(return ONLY valid JSON, no markdown, no code blocks):
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

    const start = Date.now();
    console.log(`[OllamaAdapter] Generating quiz from topic "${topic}" (${count} questions)...`);
    const response = await this.callOllama(prompt, systemPrompt, { ...llmConfig, format: 'json' });
    console.log(`[OllamaAdapter] Topic quiz generation completed in ${Date.now() - start}ms`);
    const result = this.extractJSON(response);

    // Store in cache (only if standard config)
    if (this.cache && result.length > 0 && !llmConfig) {
      await this.cache.set(cacheKey, result);
    }

    return result;
  }

  private async callOllama(prompt: string, system: string, config?: { baseUrl?: string, model?: string, apiKey?: string, format?: string }): Promise<string> {
    try {
      const headers: Record<string, string> = {};
      // Use config key if provided, else env var
      const apiKey = config?.apiKey || process.env.LLM_API_KEY || process.env.OLLAMA_API_KEY;
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey} `;
      }

      const baseUrl = config?.baseUrl ? this.normalizeBaseUrl(config.baseUrl) : this.baseUrl;
      const model = config?.model || this.model;

      console.log(`[OllamaAdapter] Sending request to ${model} at ${baseUrl}/api/generate...`);
      const start = Date.now();
      const res = await axios.post(`${baseUrl}/api/generate`, {
        model: model,
        prompt: `${system} \n\n${prompt} `,
        format: config?.format,
        stream: false
      }, { headers });
      console.log(`[OllamaAdapter] Request completed in ${Date.now() - start}ms`);
      return res.data.response;
    } catch (error: any) {
      console.error(`[OllamaAdapter] Request failed: ${error.message} (Status: ${error.response?.status})`);
      throw new Error(`Failed to communicate with AI service: ${error.message}`);
    }
  }

  private extractJSON(text: string): any {
    // 1. Clean the text
    let cleaned = text.replace(/```json\s * /g, '').replace(/```\s*/g, '').trim();

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
