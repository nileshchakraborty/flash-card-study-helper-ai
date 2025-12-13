import { z } from 'zod';

const OllamaInputSchema = z.object({
    model: z.string().describe('The Ollama model to use (e.g., llama2, mistral)'),
    prompt: z.string().describe('The prompt to send to the model'),
    temperature: z.number().optional().describe('Temperature for generation (0-1)'),
    max_tokens: z.number().optional().describe('Maximum tokens to generate'),
});

// type OllamaInput = z.infer<typeof OllamaInputSchema>;

export const ollamaTool = {
    name: 'generate_with_ollama',
    description: 'Generate text using Ollama LLM',
    inputSchema: {
        type: 'object',
        properties: {
            model: {
                type: 'string',
                description: 'The Ollama model to use (e.g., llama2, mistral)',
            },
            prompt: {
                type: 'string',
                description: 'The prompt to send to the model',
            },
            temperature: {
                type: 'number',
                description: 'Temperature for generation (0-1)',
            },
            max_tokens: {
                type: 'number',
                description: 'Maximum tokens to generate',
            },
        },
        required: ['model', 'prompt'],
    },

    async execute(input: unknown) {
        const validated = OllamaInputSchema.parse(input);
        const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

        const response = await fetch(`${baseUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: validated.model,
                prompt: validated.prompt,
                stream: false,
                options: {
                    temperature: validated.temperature || 0.7,
                    num_predict: validated.max_tokens || 500,
                },
            }),
        });

        if (!response.ok) {
            throw new Error(`Ollama API error: ${response.statusText}`);
        }

        const data = await response.json();
        return {
            text: data.response,
            model: validated.model,
            done: data.done,
        };
    },
};
