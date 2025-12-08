import { z } from 'zod';

const FlashcardsInputSchema = z.object({
    topic: z.string().describe('The topic to generate flashcards about'),
    count: z.number().describe('Number of flashcards to generate'),
    model: z.string().optional().describe('Ollama model to use (default: llama3.2:latest)'),
});

type FlashcardsInput = z.infer<typeof FlashcardsInputSchema>;

export const flashcardsOllamaTool = {
    name: 'generate_flashcards_ollama',
    description: 'Generate flashcards using Ollama LLM',
    inputSchema: {
        type: 'object',
        properties: {
            topic: {
                type: 'string',
                description: 'The topic to generate flashcards about',
            },
            count: {
                type: 'number',
                description: 'Number of flashcards to generate',
            },
            model: {
                type: 'string',
                description: 'Ollama model to use (default: llama3.2:latest)',
            },
        },
        required: ['topic', 'count'],
    },

    async execute(input: unknown) {
        const validated = FlashcardsInputSchema.parse(input);
        const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
        const model = validated.model || process.env.OLLAMA_MODEL || 'llama3.2:latest';

        const systemPrompt = 'You are a helpful study assistant that creates educational flashcards for learning. You create QUESTIONS and ANSWERS, NOT code examples.';

        const prompt = `Create exactly ${validated.count} flashcards about "${validated.topic}".

⚠️ CRITICAL RULES - FOLLOW EXACTLY:
1. Each flashcard = ONE question + ONE answer
2. Questions must be complete sentences ending with "?"
3. Answers must be 1-3 sentence explanations in plain English
4. NEVER include code snippets, variable names, or syntax in questions
5. NEVER copy/paste code as answers
6. Ask ABOUT concepts, not show code

JSON FORMAT:
- Return ONLY a valid JSON array
- Start with [ and end with ]
- No markdown, no code blocks, no explanations
- Format: [{"question": "...", "answer": "..."}]

Now create ${validated.count} flashcards:`;

        const response = await fetch(`${baseUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                prompt: `${systemPrompt}\n\n${prompt}`,
                stream: false,
            }),
        });

        if (!response.ok) {
            throw new Error(`Ollama API error: ${response.statusText}`);
        }

        const data = await response.json();
        const text = data.response;

        // Extract JSON from response
        const flashcards = extractJSON(text);

        return {
            flashcards: flashcards.map((card: any, index: number) => ({
                id: `gen-${Date.now()}-${index}`,
                front: card.question || card.front,
                back: card.answer || card.back,
                topic: validated.topic,
            })),
        };
    },
};

function extractJSON(text: string): any[] {
    // Clean the text
    let cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    // Find the outer array brackets
    const firstBracket = cleaned.indexOf('[');
    const lastBracket = cleaned.lastIndexOf(']');

    if (firstBracket >= 0 && lastBracket > firstBracket) {
        const candidate = cleaned.substring(firstBracket, lastBracket + 1);
        try {
            const result = JSON.parse(candidate);
            return Array.isArray(result) ? result : [result];
        } catch (e) {
            // Fall through to other methods
        }
    }

    // Try parsing as-is
    try {
        const result = JSON.parse(cleaned);
        return Array.isArray(result) ? result : [result];
    } catch (e) {
        // Fall through
    }

    return [];
}
