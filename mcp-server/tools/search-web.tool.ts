import { z } from 'zod';

const SearchInputSchema = z.object({
    query: z.string().describe('The search query'),
    limit: z.number().optional().describe('Number of results to return (default: 5)'),
});

type SearchInput = z.infer<typeof SearchInputSchema>;

export const searchWebTool = {
    name: 'search_web_serper',
    description: 'Search the web using Serper API',
    inputSchema: {
        type: 'object',
        properties: {
            query: {
                type: 'string',
                description: 'The search query',
            },
            limit: {
                type: 'number',
                description: 'Number of results to return (default: 5)',
            },
        },
        required: ['query'],
    },

    async execute(input: unknown) {
        const validated = SearchInputSchema.parse(input);
        const apiKey = process.env.SERPER_API_KEY;

        if (!apiKey) {
            throw new Error('SERPER_API_KEY not configured');
        }

        const response = await fetch('https://google.serper.dev/search', {
            method: 'POST',
            headers: {
                'X-API-KEY': apiKey,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                q: validated.query,
                num: validated.limit || 5,
            }),
        });

        if (!response.ok) {
            throw new Error(`Serper API error: ${response.statusText}`);
        }

        const data = await response.json();

        return {
            results: data.organic?.map((result: any) => ({
                title: result.title,
                link: result.link,
                snippet: result.snippet,
            })) || [],
            searchQuery: validated.query,
        };
    },
};
