/**
 * WebLLMGenerator - Client-side flashcard generation using WebLLM
 * Mirrors the backend StudyService flow but runs entirely in the browser
 */

import { LLMOrchestrator } from './llm/LLMOrchestrator.js';
import type { KnowledgeSource } from './ConfigurationService.js';
import { apiService } from './api.service.js';

export class WebLLMGenerator {
    constructor(private orchestrator: LLMOrchestrator) { }

    /**
     * Generate flashcards following the same flow as backend StudyService
     */
    async generateFlashcards(
        topic: string,
        count: number,
        knowledgeSource: KnowledgeSource = 'ai-web'
    ): Promise<any[]> {
        console.log(`\n=== WebLLM Knowledge Retrieval for: "${topic}" (Mode: ${knowledgeSource}) ===`);

        // Step 1: AI Summary (skip if web-only)
        let aiSummary = '';
        if (knowledgeSource !== 'web-only') {
            console.log('1. Generating AI summary with WebLLM...');
            try {
                const summaryPrompt = `Summarize what you know about "${topic}" in 3-4 sentences. Focus on key concepts and definitions.`;
                aiSummary = await this.orchestrator.generate(summaryPrompt);
                console.log('   AI Summary:', aiSummary.substring(0, 100) + '...');
            } catch (e) {
                console.warn('   Failed to generate AI summary:', e.message);
            }
        }

        // If AI-only mode, generate directly from AI knowledge
        if (knowledgeSource === 'ai-only') {
            console.log('2. Generating flashcards from WebLLM knowledge (ai-only mode)...');
            return await this.generateFromAIOnly(topic, count);
        }

        // Step 2: Generate Search Query (for web-only or ai-web)
        console.log('2. Generating search query with WebLLM...');
        let searchQuery = topic;
        try {
            const queryPrompt = `Generate a search query for google search to get best knowledge about ${topic}. Return ONLY the query string, no quotes or explanation.`;
            searchQuery = await this.orchestrator.generate(queryPrompt);
            searchQuery = searchQuery.replace(/^"|"$/g, '').trim();
            console.log('   Search Query:', searchQuery);
        } catch (e) {
            console.warn('   Failed to generate search query, using topic as query.');
        }

        // Step 3: Search Web (call backend API for Serper search)
        console.log('3. Searching the web via backend...');
        const searchResults = await this.searchWeb(searchQuery);
        console.log(`   Found ${searchResults.length} results`);

        // Step 4: Scrape Content (use backend API)
        console.log('4. Fetching content from top sources...');
        const content = await this.scrapeContent(searchResults.slice(0, 3));
        console.log(`   Extracted ${content.length} characters of content`);

        // Step 5: Generate Flashcards from Combined Context
        console.log('5. Generating flashcards with WebLLM from combined context...');
        const combinedContext = `Topic: ${topic}\n\nAI Knowledge: ${aiSummary}\n\nWeb Content:\n${content}`;
        const cards = await this.generateFromContext(combinedContext, topic, count);
        console.log(`   ✅ Generated ${cards.length} flashcards`);

        return cards;
    }

    /**
     * Generate flashcards from AI knowledge only (no web search)
     */
    private async generateFromAIOnly(topic: string, count: number): Promise<any[]> {
        const prompt = `You are a helpful study assistant creating educational flashcards. You create QUESTIONS and ANSWERS, NOT code examples.

⚠️ CRITICAL RULES - FOLLOW EXACTLY:
1. Each flashcard = ONE question + ONE answer
2. Questions must be complete sentences ending with "?"
3. Answers must be 1-3 sentence explanations in plain English
4. NEVER include code snippets, variable names, or syntax in questions
5. NEVER copy/paste code as answers
6. Ask ABOUT concepts, not show code

✅ GOOD EXAMPLES:
Q: "What does the append() method do in Python?"
A: "The append() method adds a single element to the end of a list. It modifies the list in-place and returns None."

Q: "How do you open and read a file safely in Python?"
A: "Use the 'with open(filename, mode) as f:' statement. This automatically closes the file even if errors occur."

❌ BAD EXAMPLES (DO NOT DO THIS):
Q: "_list = []"
A: "# create our list..."

JSON FORMAT (STRICT):
- Wrap your answer between the markers exactly as shown
- Do NOT include code fences, explanations, or extra text
- Use this template:
<<<JSON_START>>>
[{"question":"...","answer":"..."}]
<<<JSON_END>>>

Now create ${count} flashcards about: ${topic}`;

        const response = await this.orchestrator.generate(prompt);
        return this.parseLLMResponse(response, topic);
    }

    /**
     * Generate flashcards from combined context (AI + Web or Web only)
     */
    private async generateFromContext(context: string, topic: string, count: number): Promise<any[]> {
        const prompt = `You are a helpful study assistant creating educational flashcards. You explain concepts, you do NOT copy code.

⚠️ TASK: Create ${count} educational flashcards about: ${topic}

Context:
${context.substring(0, 15000)}

⚠️ CRITICAL RULES:
1. Ask questions ABOUT the concepts in the context
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

JSON FORMAT (STRICT):
- Wrap your answer between the markers exactly as shown
- Do NOT include code fences, explanations, or extra text
- Use this template:
<<<JSON_START>>>
[{"question":"...","answer":"..."}]
<<<JSON_END>>>

Create ${count} flashcards now:`;

        const response = await this.orchestrator.generate(prompt);
        return this.parseLLMResponse(response, topic);
    }

    /**
     * Search web using backend Serper API
     */
    private async searchWeb(query: string): Promise<any[]> {
        try {
            // Call backend search endpoint (we'll need to create this)
            const response = await fetch('/api/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query })
            });
            const data = await response.json();
            return data.results || [];
        } catch (e) {
            console.error('Failed to search web:', e);
            return [];
        }
    }

    /**
     * Scrape content from URLs using backend
     */
    private async scrapeContent(results: any[]): Promise<string> {
        const urls = results.map(r => r.link);
        if (urls.length === 0) return '';

        try {
            // Call backend scrape endpoint (we'll need to create this)
            const response = await fetch('/api/scrape', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ urls })
            });
            const data = await response.json();
            return data.content || '';
        } catch (e) {
            console.error('Failed to scrape content:', e);
            return '';
        }
    }

    /**
     * Parse LLM response to extract flashcards
     */
    private parseLLMResponse(response: string, topic: string): any[] {
        const isCodeLike = (text: string) => /import\s+|class\s+|def\s+|function\s|console\.log|System\.out\.println|flashcards_json|randomly selected/i.test(text);
        const normalizeCard = (raw: any) => ({
            question: (raw?.question || raw?.front || '').trim(),
            answer: (raw?.answer || raw?.back || '').trim()
        });
        const isValidCard = (card: { question: string; answer: string }) =>
            !!card.question && !!card.answer && card.question.length > 6 && card.answer.length > 6 && !isCodeLike(card.question + ' ' + card.answer);

        const stripNoise = (str: string) => str
            .replace(/```[a-z]*\n?/gi, '')
            .replace(/```/g, '')
            .replace(/<<<JSON_START>>>/g, '')
            .replace(/<<<JSON_END>>>/g, '')
            .replace(/^[\s\S]*?(\[)/, '$1');

        const tryParse = (str: string) => {
            try {
                let clean = stripNoise(str)
                    .replace(/\{\{/g, '{').replace(/\}\}/g, '}')
                    .replace(/,\s*]/g, ']').replace(/,\s*}/g, '}');
                return JSON.parse(clean);
            } catch (e) {
                return null;
            }
        };

        // 1) Prefer JSON arrays (with or without delimiters)
        const arrayMatches = response.match(/<<<JSON_START>>>[\s\S]*?<<<JSON_END>>>|\[[\s\S]*?\]/g) || [];
        for (const match of arrayMatches) {
            const parsed = tryParse(match);
            if (parsed && Array.isArray(parsed)) {
                const filtered = parsed.map(normalizeCard).filter(isValidCard);
                if (filtered.length) {
                    return filtered.map((card, index) => ({
                        id: `webllm-${Date.now()}-${index}`,
                        front: card.question,
                        back: card.answer,
                        topic
                    }));
                }
            }
        }

        // 2) Any JSON object containing question/answer arrays
        const objectMatches = response.match(/\{[\s\S]*?\}/g) || [];
        for (const match of objectMatches) {
            const parsed = tryParse(match);
            if (parsed) {
                if (Array.isArray(parsed)) {
                    const filtered = parsed.map(normalizeCard).filter(isValidCard);
                    if (filtered.length) {
                        return filtered.map((card, index) => ({
                            id: `webllm-${Date.now()}-${index}`,
                            front: card.question,
                            back: card.answer,
                            topic
                        }));
                    }
                }

                const keys = Object.keys(parsed);
                const qKey = keys.find(k => k.toLowerCase().includes('question') || k.toLowerCase().includes('front'));
                const aKey = keys.find(k => k.toLowerCase().includes('answer') || k.toLowerCase().includes('back'));
                if (qKey && aKey && Array.isArray((parsed as any)[qKey])) {
                    const filtered = (parsed as any)[qKey]
                        .map((q: string, i: number) => normalizeCard({ question: q, answer: (parsed as any)[aKey][i] || '' }))
                        .filter(isValidCard);
                    if (filtered.length) {
                        return filtered.map((card, index) => ({
                            id: `webllm-${Date.now()}-${index}`,
                            front: card.question,
                            back: card.answer,
                            topic
                        }));
                    }
                }
                if ((parsed as any).questions && Array.isArray((parsed as any).questions)) {
                    const filtered = (parsed as any).questions.map(normalizeCard).filter(isValidCard);
                    if (filtered.length) {
                        return filtered.map((card, index) => ({
                            id: `webllm-${Date.now()}-${index}`,
                            front: card.question,
                            back: card.answer,
                            topic
                        }));
                    }
                }
            }
        }

        // 3) Regex fallback for inline objects
        const cards: any[] = [];
        const objectRegex = /\{\s*\"question\"\s*:\s*\"((?:[^\"\\]|\\.)*)\"\s*,\s*\"answer\"\s*:\s*\"((?:[^\"\\]|\\.)*)\"\s*\}/g;
        let match;
        while ((match = objectRegex.exec(response)) !== null) {
            try {
                const card = normalizeCard({
                    question: JSON.parse(`\"${match[1]}\"`),
                    answer: JSON.parse(`\"${match[2]}\"`)
                });
                if (isValidCard(card)) cards.push(card);
            } catch (e) { }
        }

        return cards.map((card: any, index: number) => ({
            id: `webllm-${Date.now()}-${index}`,
            front: card.question,
            back: card.answer,
            topic
        }));
    }
}
